import { Options } from 'swagger-jsdoc';
import { version } from '../../package.json';

export const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bravo-1 API',
      version,
      description:
        'Media planning system API with versioned business logic and financial precision',
      contact: {
        name: 'Bravo-1 Team',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v0',
        description: 'Development server (v0)',
      },
      {
        url: 'https://api.bravo-1.com/v0',
        description: 'Production server (v0)',
      },
      {
        url: 'http://localhost:3001/api',
        description: 'Development server (legacy)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // Common schemas
        ValidationError: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
            path: {
              type: 'array',
              items: {
                oneOf: [{ type: 'string' }, { type: 'number' }],
              },
            },
          },
          required: ['field', 'message', 'code'],
        },
        ValidationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            errors: {
              type: 'array',
              items: { $ref: '#/components/schemas/ValidationError' },
            },
            warnings: {
              type: 'array',
              items: { $ref: '#/components/schemas/ValidationError' },
            },
            data: { type: 'object' },
            metadata: {
              type: 'object',
              properties: {
                validatedAt: { type: 'string', format: 'date-time' },
                validationVersion: { type: 'string' },
                processingTimeMs: { type: 'number' },
              },
            },
          },
        },
        // Financial precision types
        DecimalValue: {
          type: 'object',
          properties: {
            value: { type: 'string', description: 'Decimal value with up to 6 decimal places' },
            precision: { type: 'number', enum: [2, 3, 4, 6], description: 'Display precision' },
            context: { type: 'string', enum: ['storage', 'display', 'api'] },
          },
        },
        CalculatedField: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            calculationVersion: { type: 'string' },
            calculatedAt: { type: 'string', format: 'date-time' },
            context: { type: 'string' },
            formula: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts', './src/schemas/*.ts'],
};
