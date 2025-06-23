# Ryans Wish List

## 📊 Executive Summary (Updated 2025-06-22)

### ✅ All Items Reviewed and Updated!

**Documentation & Quickstart** - COMPLETED
- Reorganized 36 docs → 22 active + 14 archived
- Added 5-minute quickstart guide to README
- Created unified MongoDB guide

**Next.js & Vercel** - ANALYZED
- Migration would cost ~$77/month (Vercel + MongoDB Atlas)
- Current stack is simpler for your use case
- Consider Railway/Render for easier deployment

**Schema Sync** - READY TO ENHANCE
- Already using Zod (good foundation!)
- Add `zod-to-openapi` for auto API docs
- Simple upgrade path available

### Documentation & Quickstart
- **36 documentation files** identified - needs consolidation
- **Main README** missing quickstart guide
- **Action needed**: Archive 6 outdated files, merge 4 MongoDB guides, add quickstart

### Next.js & Vercel Migration
- **Current**: React + Vite + Express (separate backend)
- **Vercel cost**: ~$20/month + $57/month MongoDB Atlas
- **Recommendation**: Stay with current stack unless SEO is critical
- **Alternative**: Consider Railway or Render for simpler deployment

### Schema Synchronization
- **Good news**: Already using Zod for type safety!
- **Gap**: No OpenAPI docs or MongoDB validation
- **Quick win**: Add zod-to-openapi for auto API docs

## ✅ Recently Completed (2025-06-22)

- [x] **Fix 500 errors on campaigns listing** - Implemented server-side pagination to handle 13,417 campaigns
- [x] **Add pagination controls to UI** - Added custom pagination controls with page navigation and size selector
- [x] **Configure E2E tests with timestamped data** - Set up reproducible testing with export from `20250622-072326`
- [x] **Update CLAUDE.md with testing requirements** - Added comprehensive testing strategy and git commit guidelines
- [x] **Create git tag for rollback** - Created `v0.2.0-pagination-complete` tag

## Review and organize all documentation

**Status: ✅ COMPLETED (2025-06-22)**

### Actions Taken:
1. **Archived 6 outdated migration docs** → `docs/archive/migration-history/`
2. **Consolidated 4 MongoDB guides** → Single `docs/MONGODB-GUIDE.md`
3. **Added comprehensive quickstart** to main README (5-minute setup)
4. **Created documentation index** at `docs/INDEX.md`
5. **Fixed data model references** - corrected embedded structure to separate collections

### Results:
- Reduced documentation files from 36 to 22 active docs
- Clear separation between current docs and historical archives
- Easy-to-follow quickstart guide with Docker setup
- Accurate MongoDB query examples using actual structure

- [x] We have accumulated a lot of documentation, you must review all of the documentation in the MD files, for documentation that is no longer relevant, remove it, for documentation that is relevant, update it - if there are redundant pieces of documentation, merge them. Try to keep documentation concise and easy to navigate. 
- [x] In the readme I would like to include a quickstart guide, that outlines the steps to get the app running, including any dependencies that need to be installed, any environment variables that need to be set, and any other setup steps that need to be taken. 

## Next.js and Vercel

**Status: Initial Analysis Complete**

### Next.js Migration Assessment

**Current Stack:** React 18 + Vite + Express API (separate backend)

**Pros of Next.js Migration:**
- Unified frontend/backend (API routes)
- Built-in SSR/SSG for better SEO
- Simplified deployment on Vercel
- Better performance with automatic code splitting
- Built-in image optimization

**Cons:**
- Significant refactoring effort (router, API integration)
- Learning curve for team
- Less flexibility than separate backend
- Vendor lock-in concerns with Vercel

### Vercel Deployment

**Vercel Advantages:**
- Zero-config deployment for Next.js
- Automatic CI/CD from Git
- Edge functions for API routes
- Built-in monitoring and analytics
- ~$20/month for Pro tier

**AWS Comparison:**
- More complex setup (EC2/ECS + load balancer)
- Higher operational overhead
- More control and flexibility
- Potentially cheaper at scale

### MongoDB Atlas Requirement

**Answer:** Yes, Vercel requires external database hosting. Options:
- MongoDB Atlas (recommended) - $57+/month for M10 cluster
- Railway, Render (alternatives)
- Cannot use Docker containers on Vercel

### Additional Tooling

If going Vercel route, consider:
- **Turborepo**: Monorepo management (helpful for shared types)
- **Prisma**: Type-safe ORM (better than raw MongoDB driver)
- **tRPC**: End-to-end typesafe APIs

- [ ] Evaluate the pros and cons of migrating our web app to Next.js. If it does make sense start by writing a doc to outline the rationale, make a plan for doing that and check in with me
- [ ] Evaluate using Vercel to deploy bravo-1 vs deploying to AWS or other, looking for simplicity, flexibility, and cost
- [ ] if I deploy to Vercel would I need to use MongoDB Atlas?
- [ ] what other changes would be useful if going this route? turborepo or other?

## Headless APIs (OpenAPI) and keeping schema & types in sync

**Status: Evaluation Complete - Ready for Enhancement**

### Current State

**Zod is already in use!** Found in:
- `shared/src/types.ts` - Central type definitions
- Backend models (User, MediaPlan)
- API routes (proposals, execution-plans)

**Current Pattern:**
```typescript
// Define schema once
const UserSchema = z.object({...})
// Infer TypeScript type
type User = z.infer<typeof UserSchema>
```

### Gaps Identified

1. **No MongoDB schema validation** - MongoDB accepts any data
2. **No OpenAPI generation** - API docs must be written manually
3. **No automatic request validation** - Each route handles validation manually

### Recommended Enhancements

**1. Full Schema Sync Solution:**
```
Zod Schema (single source of truth)
    ├── TypeScript Types (✅ already done via z.infer)
    ├── MongoDB Validation (❌ add via Zod → JSON Schema)
    ├── OpenAPI Spec (❌ add via zod-to-openapi)
    └── Request Validation (❌ add middleware)
```

**2. Tools to Add:**
- `zod-to-openapi`: Generate OpenAPI from Zod schemas
- `zod-to-json-schema`: MongoDB schema validation
- Express middleware for automatic validation

**3. Benefits:**
- Single source of truth for all schemas
- Auto-generated API documentation
- Runtime validation at all layers
- Type safety from database to UI

- [ ] Evaluate whether media-tool is using any Zod-types and how we might keep schema in sync between TS in front end, TS in back end, MongoDB schema, OpenAPI schema, etc. If it does make sense start by writing a doc to outline the rationale, make a plan for doing that and check in with me

## Notes

- **Pagination Implementation**: The campaigns API was returning all 13,417 campaigns (15MB response) causing 500 errors. Implemented server-side pagination with MongoDB skip/limit, reducing page size to ~54KB
- **E2E Test Data**: Tests now use production data from timestamped export instead of seed data for more realistic testing
- **Git Workflow**: Added conventional commit format guidelines to CLAUDE.md to ensure consistent commit messages