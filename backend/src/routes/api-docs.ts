import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerOptions } from '../config/openapi';

export function setupApiDocs(app: Application): void {
  // Generate OpenAPI specification
  const openapiSpecification = swaggerJsdoc(swaggerOptions);

  // Serve OpenAPI JSON
  app.get('/api-docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpecification);
  });

  // Serve Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpecification, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Bravo-1 API Documentation',
      customfavIcon: '/favicon.ico',
    })
  );
}
