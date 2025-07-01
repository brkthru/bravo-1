# Dependency Update Guide

## Current Deprecation Warnings

When running `npm install`, you're seeing warnings about deprecated packages. Here's how to fix them:

### 1. ESLint v8 Deprecation

**Current**: `"eslint": "^8.56.0"`
**Solution**: Update to ESLint v9

```bash
cd headless-api
npm uninstall eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev eslint@latest @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest
```

**Note**: ESLint v9 has breaking changes. You may need to update `.eslintrc.json` to the new flat config format.

### 2. Lodash Deprecations

These are likely coming from sub-dependencies. The warnings suggest:

- `lodash.get` → Use optional chaining (`?.`)
- `lodash.isequal` → Use `require('node:util').isDeepStrictEqual`

**Solution**: Run `npm audit` to identify which packages use these, then update them.

### 3. Other Deprecations

- **inflight**: Used by older glob versions
- **rimraf**: Update packages that depend on rimraf v3
- **glob v7**: Update packages using old glob versions

## Quick Fix (Suppress Warnings)

If you just want to suppress the warnings for now:

```bash
npm install --loglevel=error
```

## Recommended Approach

1. **Keep current versions** for now since everything works
2. **Plan updates** as part of a dedicated maintenance task
3. **Test thoroughly** after any major version updates

## To Check Which Packages Need Updates

```bash
# Check outdated packages
npm outdated

# See dependency tree
npm ls lodash.get
npm ls eslint
npm ls glob
```

## Notes

- These are just warnings, not errors
- The app will run fine with current versions
- Major version updates (like ESLint 8→9) can require code changes
- Consider using `npm-check-updates` for easier dependency management
