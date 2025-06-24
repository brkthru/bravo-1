# Bravo-1 Technical Architecture Document

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Data Architecture](#data-architecture)
6. [Application Layers](#application-layers)
7. [Security Architecture](#security-architecture)
8. [Development & Deployment](#development--deployment)
9. [UI Component Architecture](#ui-component-architecture)
10. [Future Considerations](#future-considerations)

## Executive Summary

Bravo-1 is a modern media planning and campaign management system built as a full-stack TypeScript application. It represents a migration from the PostgreSQL-based media-tool to a MongoDB-based architecture, providing improved scalability, flexibility, and developer experience.

### Key Principles
- **Type Safety First**: End-to-end TypeScript with Zod schemas as single source of truth
- **Developer Experience**: Modern tooling with Vite, hot reload, and comprehensive testing
- **Scalability**: MongoDB for flexible schema evolution and horizontal scaling
- **Maintainability**: Monorepo structure with clear separation of concerns

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  React 18 + TypeScript + Tailwind CSS + AG-Grid + Recharts │
│                    Vite Dev Server (5174)                   │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP/REST
                               │
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│        Express 4 + TypeScript + MongoDB Native Driver        │
│                    Node.js Server (3001)                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ MongoDB Protocol
                               │
┌─────────────────────────────────────────────────────────────┐
│                         Database                             │
│                    MongoDB (Docker: 27017)                   │
│              Collections: campaigns, users, etc.             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18.2.0
- **Language**: TypeScript 5.2.2
- **Styling**: Tailwind CSS 3.3.6 + @tailwindcss/forms
- **UI Components**: 
  - HeadlessUI 1.7.17 (installed, ready for use)
  - Heroicons 2.0.18
  - Custom components with Tailwind
- **Data Grid**: AG-Grid 33.3.2 (Community + Enterprise)
- **Charts**: Recharts 2.8.0
- **State Management**: React Context + TanStack Query 5.15.0
- **Routing**: React Router DOM 6.20.1
- **Build Tool**: Vite 5.0.8

### Backend
- **Runtime**: Node.js
- **Framework**: Express 4.19.2
- **Language**: TypeScript 5.3.3
- **Database Driver**: MongoDB Native 6.3.0
- **Validation**: Zod 3.25.0 (v4 features)
- **Authentication**: bcryptjs 2.4.3 + jsonwebtoken 9.0.2
- **HTTP Client**: Axios 1.6.2
- **Utilities**: Lodash 4.17.21

### Shared
- **Validation**: Zod 3.25.0 as single source of truth
- **Types**: Shared TypeScript interfaces
- **Business Logic**: Common utilities and helpers

### Database
- **Primary**: MongoDB 7.0
- **Deployment**: Docker container (bravo1_mongodb)
- **Collections**:
  - campaigns (13,417 documents)
  - strategies (13,417 documents)
  - lineItems (3,343 documents)
  - mediaBuys (56,020 documents)
  - platformEntities (142,333 documents)
  - users
  - teams

### Development Tools
- **Package Manager**: npm/bun
- **Testing**: 
  - Jest (unit/integration)
  - Playwright (E2E)
  - React Testing Library
- **Linting**: ESLint with TypeScript plugins
- **Code Formatting**: Prettier (implied)
- **Version Control**: Git

## System Architecture

### Deployment Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser       │────▶│   Vite Server   │────▶│  Express API    │
│   (Client)      │     │   (Dev: 5174)   │     │   (Port: 3001)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   MongoDB       │
                                                 │ (Docker: 27017) │
                                                 └─────────────────┘
```

### Monorepo Structure
```
bravo-1/
├── backend/          # Express API server
├── frontend/         # React application
├── shared/           # Shared types and schemas
├── tests/            # E2E tests
├── scripts/          # ETL and utility scripts
└── docs/             # Documentation
```

## Data Architecture

### Schema Design Philosophy
- **Zod as Single Source of Truth**: All data validation and type generation flows from Zod schemas
- **MongoDB Decimal128**: Financial precision compliance (ADR 0019)
- **Discriminated Unions**: Type-safe line item variants
- **Audit Trail**: Git-like versioning system for all entities

### Core Schema Structure
```typescript
// Financial primitives with MongoDB Decimal128
const FinancialAmountSchema = z.object({
  amount: DecimalSchema,
  currency: CurrencySchema.default('USD'),
});

// Campaign with Zoho field suffixes
const CampaignEntitySchema = z.object({
  // Zoho-owned fields
  startDateZoho: DateSchema.optional(),
  endDateZoho: DateSchema.optional(),
  
  // Bravo-owned fields (MediaStrategy)
  startDate: DateSchema,
  endDate: DateSchema,
  price: FinancialAmountSchema,
});

// Discriminated union for line items
const LineItemEntitySchema = z.discriminatedUnion('type', [
  StandardLineItemSchema,
  ManagementFeeLineItemSchema,
  ZeroDollarLineItemSchema,
  ZeroMarginLineItemSchema,
]);
```

### Database Collections
1. **campaigns**: Core campaign entities with embedded strategy data
2. **lineItems**: Separate collection with campaign references
3. **mediaBuys**: Time-based budget allocations
4. **users/teams**: Authentication and authorization
5. **platformEntities**: External platform integrations

## Application Layers

### Frontend Architecture
```
frontend/src/
├── components/       # Reusable UI components
├── contexts/         # React contexts (Theme, User)
├── pages/           # Route-based page components
├── services/        # API client services
├── hooks/           # Custom React hooks
└── utils/           # Helper functions
```

### Backend Architecture
```
backend/src/
├── config/          # Database and app configuration
├── models/          # MongoDB models and schemas
├── routes/          # Express route handlers
├── middleware/      # Express middleware
├── services/        # Business logic layer
└── utils/           # Helper functions
```

### Shared Module Architecture
```
shared/src/
├── schemas/         # Zod schemas (single source of truth)
│   ├── core/       # Primitives (financial, dates, etc.)
│   ├── entities/   # Domain entities
│   ├── api/        # API request/response schemas
│   └── versioning/ # Audit trail schemas
├── types/          # Generated TypeScript types
└── utils/          # Shared utilities
```

## Security Architecture

### Authentication & Authorization
- **JWT-based authentication**: Stateless token system
- **bcrypt password hashing**: Industry-standard security
- **Role-based access control**: User/team permissions
- **API key support**: For service-to-service communication

### Security Best Practices
- Input validation via Zod schemas
- SQL injection prevention (N/A with MongoDB)
- XSS protection via React's built-in escaping
- CORS configuration for API access
- Environment-based secrets management

## Development & Deployment

### Development Workflow
1. **Local Development**:
   ```bash
   docker-compose up -d mongodb  # Start database
   npm run dev:backend          # Start API (3001)
   npm run dev:frontend         # Start UI (5174)
   ```

2. **Testing**:
   ```bash
   npm test                     # Unit/integration tests
   npm run test:e2e            # E2E tests
   npm run test:coverage       # Coverage report
   ```

3. **Data Management**:
   ```bash
   # Production data (13,417 campaigns)
   bun run scripts/etl/run-etl.ts
   
   # Never use: npm run seed (only 5 test campaigns)
   ```

### Build & Deployment
- **Frontend**: Static build via Vite, deployable to CDN
- **Backend**: Node.js application, containerizable
- **Database**: MongoDB in Docker for consistency

## UI Component Architecture

### Current State
- **Custom Components**: Built with Tailwind CSS utilities
- **HeadlessUI**: Installed but underutilized
- **AG-Grid**: Enterprise data grid for complex tables (v33.3.2 with legacy theme mode)
- **Recharts**: For data visualization

### AG-Grid v33 Configuration
AG-Grid v33 introduced a new Theming API that changes how themes are applied. To maintain compatibility with existing CSS imports, we use legacy mode:

```typescript
// main.tsx
import { provideGlobalGridOptions } from 'ag-grid-community';

// Configure AG-Grid v33 to use legacy theme mode
provideGlobalGridOptions({ theme: "legacy" });
```

This allows us to continue using CSS imports (`ag-theme-alpine`) rather than migrating to the new JavaScript-based theming system.

### HeadlessUI Integration Opportunity

HeadlessUI is already installed (`@headlessui/react: ^1.7.17`) but not actively used. It's 100% compatible with Tailwind CSS and offers:

**Benefits of adopting HeadlessUI**:
1. **Accessibility**: WCAG compliant out of the box
2. **Keyboard Navigation**: Built-in support
3. **State Management**: Handles complex UI states
4. **Tailwind Integration**: Designed to work with utility classes

**Recommended Components to Implement**:
- `Dialog` - Replace custom modals
- `Combobox` - Enhanced select/autocomplete
- `Disclosure` - Collapsible sections
- `Menu` - Dropdown menus
- `Switch` - Toggle components
- `Transition` - Smooth animations

**Implementation Strategy**:
```typescript
// Example: Replace custom modal with HeadlessUI Dialog
import { Dialog, Transition } from '@headlessui/react'

function CampaignModal({ isOpen, onClose }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>
        {/* Modal content */}
      </Dialog>
    </Transition>
  )
}
```

### Tailwind UI Plus Compatibility
If you have Tailwind UI Plus, you can leverage:
- Pre-built HeadlessUI component patterns
- Marketing and application UI templates
- Catalyst UI kit (modern application UI kit)

## Future Considerations

### Technical Debt
1. **Test Coverage**: Improve from 76% to 80%+
2. **Frontend Tests**: Add more component tests
3. **Shared Module Tests**: Test Zod schemas
4. **HeadlessUI Migration**: Replace custom components

### Architectural Improvements
1. **GraphQL**: Consider for complex data fetching
2. **Redis Cache**: For performance optimization
3. **Message Queue**: For background jobs
4. **Microservices**: Split into domain services
5. **Event Sourcing**: Enhanced audit capabilities

### Infrastructure
1. **CI/CD Pipeline**: GitHub Actions automation
2. **Container Orchestration**: Kubernetes deployment
3. **Monitoring**: APM and error tracking
4. **Load Balancing**: For horizontal scaling

### Feature Enhancements
1. **Real-time Updates**: WebSocket integration
2. **File Uploads**: S3 integration
3. **Export/Import**: Enhanced data portability
4. **API Documentation**: OpenAPI/Swagger
5. **Multi-tenancy**: Organization isolation

## Conclusion

Bravo-1's architecture provides a solid foundation for a modern media planning system. The use of TypeScript throughout, MongoDB for flexibility, and modern frontend tools creates a maintainable and scalable platform. The integration of Zod as a single source of truth ensures type safety and consistency across all layers.

Key strengths:
- Full-stack TypeScript with end-to-end type safety
- Modern development experience with hot reload
- Flexible schema design with MongoDB
- Comprehensive testing infrastructure
- Ready for UI enhancement with HeadlessUI

Recommended next steps:
1. Increase test coverage to 80%+
2. Implement HeadlessUI components for better accessibility
3. Add CI/CD automation
4. Document API with OpenAPI specification