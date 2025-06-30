# Interactive Memory Cleanup Guide

Since you're using the Max plan (no SDK access), here's how to clean up memories interactively within Claude Code:

## Step 1: Export Current Memories

In Claude Code, run:

```
mcp__openmemory__list_memories
```

Copy the output to a file called `memories-export.json`

## Step 2: Analyze Memories

Run the cleanup script:

```bash
cd scripts/memory-cleanup
bun compact-memories-direct.ts < memories-export.json
```

This will create two files:

- `analysis-[timestamp].json` - Full analysis
- `import-[timestamp].json` - Cleaned memories ready to import

## Step 3: Review Changes

The script will show you:

- How many memories per project
- How many will be deleted
- How many will be compacted
- Examples of compactions
- Total characters saved

## Step 4: Clear OpenMemory

In Claude Code:

```
mcp__openmemory__delete_all_memories
```

## Step 5: Import Cleaned Memories

For each memory in the import file, run in Claude Code:

```
mcp__openmemory__add_memories
text: "[bravo-1] MongoDB localhost:27017 db:bravo-1"
```

## Automation Helper

To make Step 5 easier, I can generate a script that outputs all the commands.
After running the analysis, ask me to:
"Generate import commands for import-[timestamp].json"

And I'll create a list of all the mcp**openmemory**add_memories commands you need to run.

## Example Workflow

```bash
# 1. In Claude Code
mcp__openmemory__list_memories
# Copy output

# 2. In terminal
cd scripts/memory-cleanup
pbpaste | bun compact-memories-direct.ts  # macOS
# or
bun compact-memories-direct.ts < memories.json

# 3. Review output
cat import-*.json

# 4. Back in Claude Code
mcp__openmemory__delete_all_memories

# 5. Import cleaned memories
# Run each add_memories command
```

## Expected Results

- **Before**: 100+ verbose memories across all projects
- **After**: 20-30 compact, project-prefixed memories
- **Token savings**: 60-80% reduction in memory-related tokens
- **Search improvement**: Can now search by project prefix

## Pro Tips

1. **Use project prefixes**: `[bravo-1]`, `[media-tool]`, etc.
2. **Keep only unique info**: Don't duplicate CLAUDE.md
3. **Compact aggressively**: "MongoDB localhost:27017" not "MongoDB is running on localhost at port 27017"
4. **Update regularly**: Run cleanup monthly as memories accumulate
