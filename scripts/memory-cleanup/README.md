# Memory Cleanup Scripts

These scripts help you clean up and compact your OpenMemory memories to reduce token consumption.

## Important: Claude Code Max Plan vs API Access

**Your Claude Code Max plan does NOT include SDK/API access**. The Max plan provides:

- ✅ Access to Claude Code UI (what you're using now)
- ✅ Unlimited messages within rate limits
- ❌ Programmatic API/SDK access

To use the SDK, you would need:

1. A separate API key from console.anthropic.com
2. API plan with per-token billing
3. This is a separate commercial agreement

**Recommendation**: Use the direct script method below, which works with your current Max plan.

## Quick Start

### Option 1: Direct Script (Recommended)

1. **Export your memories from OpenMemory**:

   ```bash
   # In Claude Code, run:
   mcp__openmemory__list_memories
   # Copy the JSON output
   ```

2. **Run the cleanup script**:

   ```bash
   cd scripts/memory-cleanup
   bun run compact-memories-direct.ts < memories.json
   ```

3. **Review the analysis** and import the cleaned memories back.

### Option 2: Using Claude Code SDK

```bash
cd scripts/memory-cleanup
npm install
bun run compact-memories.ts        # Analyze only
bun run compact-memories.ts --apply # Apply changes
```

## What These Scripts Do

### Memory Classification

- Detects project: `bravo-1`, `media-tool`, or `unknown`
- Uses patterns like port numbers, file paths, and keywords

### Memory Compaction

Transforms verbose memories into compact ones:

**Before** (87 chars):

```
The bravo-1 project uses MongoDB running on localhost port 27017 with database name bravo-1
```

**After** (38 chars):

```
[bravo-1] MongoDB localhost:27017 db:bravo-1
```

### Memory Deletion

Removes:

- Empty or very short memories
- Test data
- Deprecated/temporary content
- Duplicates of CLAUDE.md content

## Examples of Compaction

### Configuration

- `MongoDB is running on localhost at port 27017` → `[bravo-1] MongoDB localhost:27017`
- `The backend Express server runs on port 3001` → `[bravo-1] Backend Express:3001`

### File Paths

- `The ETL pipeline is located in scripts/etl/run-full-etl-pipeline.ts` → `[bravo-1] ETL scripts/etl/run-full-etl-pipeline.ts`

### Warnings

- `The ETL pipeline has issues with idempotency, creating duplicates when run multiple times` → `[bravo-1] ETL WARNING: creates duplicates on multiple runs`

## Manual Cleanup Process

If you prefer to do it manually in Claude Code:

1. **List all memories**:

   ```
   mcp__openmemory__list_memories
   ```

2. **Delete all** (easier than selective deletion):

   ```
   mcp__openmemory__delete_all_memories
   ```

3. **Add back compacted memories** with project prefixes:

   ```
   mcp__openmemory__add_memories
   text: "[bravo-1] MongoDB localhost:27017 db:bravo-1"

   mcp__openmemory__add_memories
   text: "[bravo-1] ETL scripts/etl/run-full-etl-pipeline.ts"

   mcp__openmemory__add_memories
   text: "[bravo-1] Backend:3001 Frontend:5174"
   ```

## Best Practices

### Use Project Prefixes

Always prefix memories with `[project-name]` so you can search by project:

- `[bravo-1] ...`
- `[media-tool] ...`

### Keep It Short

- Use colons without spaces: `MongoDB:27017` not `MongoDB: 27017`
- Abbreviate when clear: `db:bravo-1` not `database: bravo-1`
- Combine related info: `Backend:3001 Frontend:5174`

### Avoid Redundancy

Don't store what's already in CLAUDE.md:

- Basic commands
- Project structure
- Setup instructions

### Focus on Unique Info

Store:

- Configuration values
- Non-obvious file locations
- Important warnings/gotchas
- Key decisions and rationale

## Expected Results

After cleanup:

- 50-70% reduction in memory text
- Better project organization
- Faster, more relevant searches
- Significant token savings
