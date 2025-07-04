# MCP Memory Server Optimization Guide

## Current Situation

You're experiencing faster context window consumption since adding both OpenMemory and Serena MCP servers. This guide will help you optimize your setup.

## How Memory Search Actually Works

### The Reality About Memory Search

1. **OpenMemory does NOT use vector search** - it returns ALL memories that contain your search term
2. **CLAUDE.md is attached to EVERY prompt** - this is a major token consumer
3. **Each memory search includes full text** of all matching memories
4. **Serena has valuable code navigation tools** beyond just memory

### Token Consumption Breakdown

#### CLAUDE.md (Biggest Consumer)

- **~2000-3000 tokens** attached to EVERY message
- This happens automatically, you can't control it
- Accumulates rapidly in conversations

#### OpenMemory

- **Search**: Returns ALL memories containing search term (not semantic/vector search)
- **List**: Returns ENTIRE memory database (avoid at all costs)
- **Add**: Minimal tokens

#### Serena

- **Code navigation tools**: Very useful for finding symbols, patterns
- **Memory features**: Redundant with OpenMemory
- **Initial setup**: One-time cost per session

## Recommended Solution: Keep Serena for Code Tools, Use OpenMemory Strategically

### Option 1: Configure Serena to Skip Memory Tools (RECOMMENDED)

Keep Serena's valuable code navigation while avoiding memory duplication:

```bash
# Add instruction to your Serena configuration
claude mcp update serena -- --instruction "NEVER use read_memory or write_memory tools. Only use code navigation tools like find_symbol, search_for_pattern, get_current_config, etc."
```

This gives you:

- ✅ Symbol search (`find_symbol`)
- ✅ Pattern search (`search_for_pattern`)
- ✅ File analysis tools
- ❌ No duplicate memory storage

### Option 2: Optimize Your Current Setup

#### 1. Minimize CLAUDE.md (Biggest Win)

Your CLAUDE.md is ~2000+ tokens and attached to EVERY message. Reduce it:

**Current sections to trim:**

- Migration Status (move to separate doc)
- Testing Strategy details (reference external doc)
- Common Issues & Solutions (move to troubleshooting.md)
- Verbose examples

**Keep only:**

- Project overview (2-3 sentences)
- Key configs (ports, databases)
- Critical warnings (read-only rules)
- Command quick reference

#### 2. Clean OpenMemory

```bash
# In Claude Code, list current memories
mcp__openmemory__list_memories

# Delete all if cluttered
mcp__openmemory__delete_all_memories

# Add back only essential, compact memories:
"bravo-1 config: MongoDB localhost:27017, backend:3001, frontend:5174"
"bravo-1 ETL: scripts/etl/run-full-etl-pipeline.ts, use --verbose for debug"
"bravo-1 idempotency issue: strategies/lineItems/platformBuys create duplicates"
```

#### 3. Memory Format Guidelines

```
# Bad (verbose):
"The ETL pipeline for bravo-1 is located in scripts/etl/run-full-etl-pipeline.ts and has issues with idempotency where running it multiple times creates duplicates"

# Good (compact):
"bravo-1 ETL: scripts/etl/run-full-etl-pipeline.ts - WARNING: creates duplicates on multiple runs"
```

### Option 3: Remove OpenMemory, Keep Only Serena

If you prefer Serena's code tools and don't need cross-project memory:

```bash
claude mcp remove openmemory
```

Then use Serena's memory for project-specific info only.

## Quick Decision Matrix

| Need                                     | Solution                               |
| ---------------------------------------- | -------------------------------------- |
| Code navigation (find symbols, patterns) | Keep Serena with no-memory instruction |
| Cross-project memory                     | Keep OpenMemory, minimize entries      |
| Minimize tokens                          | Trim CLAUDE.md to <500 tokens          |
| Maximum token savings                    | Remove both, use only CLAUDE.md        |

## Immediate Actions

1. **Trim CLAUDE.md** - This saves tokens on EVERY message
2. **Add Serena instruction** - Prevents memory duplication
3. **Clean OpenMemory** - Remove verbose/outdated entries

## Token Saving Tips

### DO:

- Use file references: "see scripts/etl/README.md"
- Compact formats: "MongoDB:27017, backend:3001"
- One memory per concept
- Update CLAUDE.md monthly

### DON'T:

- Store code in memories
- Duplicate info between systems
- Use list_memories unless cleaning
- Keep outdated information

## Expected Savings

After optimization:

- **CLAUDE.md**: 2000+ → 500 tokens (save 1500/message)
- **Memory searches**: 1000 → 200 tokens (80% reduction)
- **Overall**: 40-60% reduction in token usage

## MongoDB Connection Issue

I notice MongoDB is down in your logs. To fix:

```bash
cd bravo-1
docker-compose up -d mongodb
```
