# API Documentation

## Overview

Bravo-1 API documentation is automatically generated using OpenAPI 3.0 specification and served via Swagger UI.

## Accessing Documentation

### Live Documentation

- **Swagger UI**: http://localhost:3001/api-docs
- **OpenAPI JSON**: http://localhost:3001/api-docs/openapi.json

### Quick Access

```bash
# Open in browser (macOS/Linux)
./scripts/open-api-docs.sh
```

## Features

### 1. Interactive Documentation

- Browse all API endpoints
- View request/response schemas
- See example payloads
- Test endpoints directly from browser

### 2. Automatic Generation

- Documentation generated from JSDoc comments
- Schemas derived from TypeScript types
- Always up-to-date with code

### 3. Key Components Documented

- **Validation**: Error vs Warning patterns
- **Precision**: Decimal handling with context
- **Versioning**: Calculation engine metadata
- **Bulk Operations**: Batch endpoint patterns

## Adding Documentation

### 1. Document an Endpoint

```typescript
/**
 * @swagger
 * /api/campaigns:
 *   get:
 *     summary: List campaigns
 *     description: Get paginated campaigns
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Campaign'
 */
router.get('/', async (req, res) => {
  // Implementation
});
```

### 2. Define Schemas

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Campaign:
 *       type: object
 *       required:
 *         - name
 *         - campaignNumber
 *       properties:
 *         name:
 *           type: string
 *         budget:
 *           $ref: '#/components/schemas/Budget'
 */
```

### 3. Use Zod Schemas

Future enhancement: Auto-generate from Zod schemas in `shared/src/schemas/`

## Best Practices

1. **Keep Comments Updated**: Update JSDoc when changing endpoints
2. **Use References**: Define reusable schemas in components
3. **Include Examples**: Add example values for complex types
4. **Document Errors**: Include all possible error responses
5. **Tag Endpoints**: Group related endpoints with tags

## Configuration

See `backend/src/config/openapi.ts` for:

- API metadata
- Server URLs
- Common schemas
- Security schemes

## Testing

```bash
# Run API documentation tests
npm test -- api-docs.test.ts
```

## Future Enhancements

1. **Zod Integration**: Auto-generate schemas from Zod definitions
2. **Postman Export**: Generate Postman collections
3. **Client SDK**: Generate TypeScript client from spec
4. **Versioning**: Support multiple API versions
5. **Authentication**: Add JWT bearer token testing
