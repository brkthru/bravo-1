# Claude Code Session Handoff - Memory Cleanup

## Current Status

### What We're Trying to Do

Clean up and compact your OpenMemory memories to reduce token consumption and improve search relevance.

### Problem

- MCP tools failing with "Invalid request parameters" when trying to access OpenMemory
- Web dashboard at http://localhost:3000/memories doesn't have export feature
- Need to access memories to run cleanup scripts

### What's Been Created

#### 1. Cleanup Scripts (Ready to Use)

- `/scripts/memory-cleanup/compact-memories-direct.ts` - Main cleanup script
- `/scripts/memory-cleanup/generate-import-commands.ts` - Generates reimport commands
- `/scripts/memory-cleanup/README.md` - Full documentation

#### 2. How The Cleanup Works

- Classifies memories by project: [bravo-1], [media-tool], [unknown]
- Compacts verbose memories (50-70% size reduction)
- Deletes useless memories (test data, empty, etc.)
- Adds project prefixes for better searching

## Next Steps for New Session

### 1. Test MCP Connection

```
mcp__openmemory__list_memories
```

### 2. If MCP Works

- Export all memories
- Save to file: `memories-export.json`
- Run cleanup: `bun scripts/memory-cleanup/compact-memories-direct.ts < memories-export.json`
- Review results in `import-[timestamp].json`
- Delete all memories: `mcp__openmemory__delete_all_memories`
- Re-import cleaned memories using generated commands

### 3. If MCP Still Fails

Try these alternatives:

- Check browser Network tab in dashboard for API calls
- Look for local storage: `~/.openmemory/` or Docker volumes
- Try variations of MCP commands (with/without parameters)

## Key Information

### OpenMemory Setup

- Dashboard: http://localhost:3000/memories
- MCP endpoint: http://localhost:8765/mcp/claude/sse/ryan
- Uses vector embeddings (requires OpenAI API key)
- Stores memories with semantic search capability

### Token Consumption Issues

- CLAUDE.md uses ~2000-3000 tokens PER message
- OpenMemory returns ALL matching memories (not just most relevant)
- Both add up quickly in conversations

### Expected Results After Cleanup

- 60-80% reduction in memory-related tokens
- Better project organization with prefixes
- Faster, more relevant searches
- Example: "The bravo-1 project uses MongoDB..." → "[bravo-1] MongoDB localhost:27017"

## Quick Test

To verify everything is set up, the new session should:

1. Check if MongoDB is running: `docker ps | grep mongo`
2. Verify cleanup scripts exist: `ls scripts/memory-cleanup/`
3. Test MCP connection: `mcp__openmemory__list_memories`

## If You Get Stuck

- All cleanup scripts are in `/scripts/memory-cleanup/`
- Sample data demonstrates the process
- Manual cleanup guide available if MCP continues to fail
- Focus on trimming CLAUDE.md for biggest token savings

Good luck with the fresh session!
