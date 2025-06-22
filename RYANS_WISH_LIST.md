# Ryans Wish List

## ✅ Recently Completed (2025-06-22)

- [x] **Fix 500 errors on campaigns listing** - Implemented server-side pagination to handle 13,417 campaigns
- [x] **Add pagination controls to UI** - Added custom pagination controls with page navigation and size selector
- [x] **Configure E2E tests with timestamped data** - Set up reproducible testing with export from `20250622-072326`
- [x] **Update CLAUDE.md with testing requirements** - Added comprehensive testing strategy and git commit guidelines
- [x] **Create git tag for rollback** - Created `v0.2.0-pagination-complete` tag

## Review and organize all documentation

- [ ] We have accumulated a lot of documentation, you must review all of the documentation in the MD files, for documentation that is no longer relevant, remove it, for documentation that is relevant, update it - if there are redundant pieces of documentation, merge them. Try to keep documentation concise and easy to navigate. 
- [ ] In the readme I would like to include a quickstart guide, that outlines the steps to get the app running, including any dependencies that need to be installed, any environment variables that need to be set, and any other setup steps that need to be taken. 

## Next.js and Vercel

- [ ] Evaluate the pros and cons of migrating our web app to Next.js. If it does make sense start by writing a doc to outline the rationale, make a plan for doing that and check in with me
- [ ] Evaluate using Vercel to deploy bravo-1 vs deploying to AWS or other, looking for simplicity, flexibility, and cost
- [ ] if I deploy to Vercel would I need to use MongoDB Atlas?
- [ ] what other changes would be useful if going this route? turborepo or other?

## Headless APIs (OpenAPI) and keeping schema & types in sync

- [ ] Evaluate whether media-tool is using any Zod-types and how we might keep schema in sync between TS in front end, TS in back end, MongoDB schema, OpenAPI schema, etc. If it does make sense start by writing a doc to outline the rationale, make a plan for doing that and check in with me

## Notes

- **Pagination Implementation**: The campaigns API was returning all 13,417 campaigns (15MB response) causing 500 errors. Implemented server-side pagination with MongoDB skip/limit, reducing page size to ~54KB
- **E2E Test Data**: Tests now use production data from timestamped export instead of seed data for more realistic testing
- **Git Workflow**: Added conventional commit format guidelines to CLAUDE.md to ensure consistent commit messages