import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { database } from './config/database';
import { CampaignModel } from './models/Campaign';
import { UserModel } from './models/User';
import { MediaPlanModel } from './models/MediaPlan';
import campaignRoutes from './routes/campaigns';
import userRoutes from './routes/users';
import proposalsRoutes from './routes/proposals';
import executionPlansRoutes from './routes/execution-plans';
import insertionOrdersRoutes from './routes/insertion-orders';
import etlRoutes from './routes/etl';
import { setupApiDocs } from './routes/api-docs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup API documentation (before routes for proper middleware order)
setupApiDocs(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: database.isConnected() ? 'connected' : 'disconnected',
  });
});

// API routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/users', userRoutes);
app.use('/api/etl', etlRoutes);

// OpenAPI compatible routes
app.use('/api/proposals', proposalsRoutes);
app.use('/api/execution-plans', executionPlansRoutes);
app.use('/api/insertion-orders', insertionOrdersRoutes);

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await database.connect();

    // Create database indexes
    const campaignModel = new CampaignModel();
    const userModel = new UserModel();
    const mediaPlanModel = new MediaPlanModel();

    try {
      await campaignModel.createIndexes();
      console.log('Campaign indexes created');
    } catch (error: any) {
      if (error.code !== 86) {
        // Ignore IndexKeySpecsConflict
        throw error;
      }
      console.log('Campaign indexes already exist');
    }

    try {
      await userModel.createIndexes();
      console.log('User indexes created');
    } catch (error: any) {
      if (error.code !== 86) {
        // Ignore IndexKeySpecsConflict
        throw error;
      }
      console.log('User indexes already exist');
    }

    try {
      await mediaPlanModel.createIndexes();
      console.log('Media plan indexes created');
    } catch (error: any) {
      if (error.code !== 86) {
        // Ignore IndexKeySpecsConflict
        throw error;
      }
      console.log('Media plan indexes already exist');
    }

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

startServer();
