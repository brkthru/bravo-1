# Contributing to Bravo-1

Thank you for your interest in contributing to Bravo-1! This guide covers contribution guidelines for both human developers and AI agents.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [For AI Agents](#for-ai-agents)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Testing Requirements](#testing-requirements)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment
- Report any unacceptable behavior

## Getting Started

1. **Fork and Clone**

   ```bash
   git clone https://github.com/brkthru/bravo-1.git
   cd bravo-1
   npm install
   ```

2. **Set Up Development Environment**
   - Follow the Quick Start guide in README.md
   - Ensure MongoDB is running
   - Load test data using ETL pipeline

3. **Create a Branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Process

### 1. Test-Driven Development (TDD)

**MANDATORY**: Write tests before implementation

```bash
# 1. Write failing test
npm run test:unit -- --watch

# 2. Implement minimal code to pass
# 3. Refactor with confidence
# 4. Ensure all tests pass
npm test
```

### 2. Code Quality Checks

Before committing:

```bash
trunk check    # Must pass
npm test       # Must pass
npm run test:coverage  # Maintain >60%
```

### 3. Commit Guidelines

Use conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation only
- `style:` Formatting, missing semicolons, etc.
- `refactor:` Code changes that neither fix bugs nor add features
- `perf:` Performance improvements
- `test:` Adding missing tests
- `chore:` Maintenance tasks

## For AI Agents

### Special Guidelines

1. **Memory Management**
   - Store key decisions: `mcp__openmemory__add_memories`
   - Search before major changes: `mcp__openmemory__search_memory`

2. **Issue Creation**
   - Use the AI Agent Issue template
   - Label with `ai-generated`
   - Include tool/command that revealed the issue

3. **Pull Requests**
   - Mark PR with `ai-generated` label
   - Document which agent created it
   - Include relevant memory IDs

4. **Code Review**
   - AI-generated PRs require human approval
   - Document any assumptions made
   - Highlight areas needing human review

### Example AI Workflow

```bash
# 1. Search for context
mcp__openmemory__search_memory "campaign validation"

# 2. Use Task for complex searches
Task: "Find all validation logic in campaigns"

# 3. Write test first
# Create test file...

# 4. Run tests
cd headless-api && npm test

# 5. Implement feature
# Edit files...

# 6. Check quality
trunk check

# 7. Store decision
mcp__openmemory__add_memories "Added validation for campaign budget limits"
```

## Submitting Changes

### Pull Request Process

1. **Update Documentation**
   - Update README.md if needed
   - Add/update API documentation
   - Update ARCHITECTURE.md for significant changes

2. **Ensure Quality**
   - All tests pass
   - Code coverage maintained/improved
   - Trunk check passes
   - No console.log statements

3. **Create PR**
   - Use PR template
   - Link related issues
   - Add screenshots for UI changes
   - Request review from maintainers

### Review Process

- PRs require at least one approval
- Address all review comments
- Keep PR focused and reasonably sized
- Squash commits before merging

## Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Prefer functional components in React
- Use async/await over promises

### File Organization

```
src/
├── components/   # React components
├── services/     # API services
├── utils/        # Utility functions
├── types/        # TypeScript types
└── __tests__/    # Test files
```

### Naming Conventions

- Components: PascalCase (`CampaignList.tsx`)
- Files: kebab-case (`campaign-service.ts`)
- Variables: camelCase (`campaignData`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)

## Testing Requirements

### Unit Tests

- Test individual functions/components
- Mock external dependencies
- Aim for >80% coverage

### E2E Tests

- Test critical user flows
- Use production-like data
- Run against full stack

### Test Structure

```typescript
describe('CampaignService', () => {
  describe('validateCampaign', () => {
    it('should reject negative budgets', () => {
      // Arrange
      const campaign = { budget: -100 };

      // Act
      const result = validateCampaign(campaign);

      // Assert
      expect(result.valid).toBe(false);
    });
  });
});
```

## Questions?

- Check existing issues and discussions
- Ask in PR comments
- Review ARCHITECTURE.md for design decisions

Thank you for contributing to Bravo-1! 🚀
