import request from 'supertest';
import express from 'express';
import { setupApiDocs } from './api-docs';

describe('API Documentation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    setupApiDocs(app);
  });

  describe('GET /api-docs', () => {
    it('should serve Swagger UI', async () => {
      const response = await request(app).get('/api-docs');

      expect(response.status).toBe(301); // Swagger UI redirects to /api-docs/
      expect(response.headers.location).toBe('/api-docs/');
    });

    it('should redirect to Swagger UI with trailing slash', async () => {
      const response = await request(app).get('/api-docs/');

      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger-ui');
      expect(response.text).toContain('Bravo-1 API Documentation');
    });
  });

  describe('GET /api-docs/openapi.json', () => {
    it('should return OpenAPI JSON specification', async () => {
      const response = await request(app).get('/api-docs/openapi.json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);

      const spec = response.body;
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('Bravo-1 API');
      expect(spec.info.version).toBeDefined();
      expect(spec.paths).toBeDefined();
    });

    it('should include campaign endpoints in spec', async () => {
      const response = await request(app).get('/api-docs/openapi.json');

      const spec = response.body;
      expect(spec.paths['/api/campaigns']).toBeDefined();
      expect(spec.paths['/api/campaigns']['get']).toBeDefined();
      expect(spec.paths['/api/campaigns']['post']).toBeDefined();
      expect(spec.paths['/api/campaigns/{id}']).toBeDefined();
    });

    it('should include proper schemas', async () => {
      const response = await request(app).get('/api-docs/openapi.json');

      const spec = response.body;
      expect(spec.components.schemas.Campaign).toBeDefined();
      expect(spec.components.schemas.ValidationError).toBeDefined();
    });
  });
});
