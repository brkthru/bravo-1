# Manual Memory Export Guide

Since the MCP tools are having issues and the dashboard doesn't have an export feature, here are your options:

## Option 1: Browser Developer Tools

1. **Open the Dashboard** at http://localhost:3000/memories
2. **Open Developer Tools** (F12 or right-click → Inspect)
3. **Go to Network tab**
4. **Refresh the page**
5. **Look for API calls** that fetch memories (might be named like `memories`, `data`, etc.)
6. **Copy the response** JSON

## Option 2: Check OpenMemory Storage

OpenMemory might store data locally. Check these locations:

```bash
# Common storage locations
ls -la ~/.openmemory/
ls -la ~/.local/share/openmemory/
ls -la ~/Library/Application\ Support/openmemory/  # macOS

# Docker volumes
docker volume ls | grep -i memory
docker volume inspect [volume-name]
```

## Option 3: Use the MCP SSE Endpoint Directly

```bash
# Try to connect to the SSE endpoint
curl -N -H "Accept: text/event-stream" \
  "http://localhost:8765/mcp/claude/sse/ryan" \
  --data '{"method": "tools/list"}' \
  -H "Content-Type: application/json"
```

## Option 4: Alternative MCP Commands

If MCP connection works in a new session, try these variations:

```
# Without parameters
mcp__openmemory__list_memories

# With empty object
mcp__openmemory__list_memories
{}

# With query parameter
mcp__openmemory__search_memory
query: ""
```

## What We Can Do Without Export

Even without accessing your current memories, we can:

1. **Create a memory management strategy** going forward
2. **Set up better memory templates**
3. **Create a monitoring script** to track memory growth
4. **Build import scripts** for when you do get access

## Next Steps

1. Try opening a fresh Claude Code session (sometimes MCP reconnects)
2. Check if there are any OpenMemory CLI tools installed
3. Look for any backup files in your home directory

Would you like me to:

- Create memory templates for future use?
- Build a memory monitoring script?
- Help troubleshoot the MCP connection further?
