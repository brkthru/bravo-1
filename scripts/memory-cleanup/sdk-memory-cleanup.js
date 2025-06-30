#!/usr/bin/env node
/**
 * Memory Cleanup using Claude Code SDK
 *
 * IMPORTANT: SDK Access Requirements
 * ==================================
 *
 * The Claude Code Max plan gives you access to the Claude Code UI,
 * but using the SDK programmatically requires:
 *
 * 1. An API key from console.anthropic.com
 * 2. This typically requires a separate API plan/billing
 * 3. Your Max plan tokens are NOT used by the SDK
 *
 * If you don't have API access, use the direct script instead.
 */

import Anthropic from '@anthropic/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(`
❌ Error: ANTHROPIC_API_KEY environment variable not set

To use the SDK, you need:
1. An API key from https://console.anthropic.com
2. Set it: export ANTHROPIC_API_KEY="your-key-here"

Note: This is separate from your Claude Code Max plan.
The Max plan doesn't include programmatic API access.

Alternative: Use the direct script that works with manual export/import.
`);
  process.exit(1);
}

// Initialize the SDK
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// MCP configuration for OpenMemory
const mcpConfig = {
  mcpServers: {
    openmemory: {
      command: 'http://localhost:8765/mcp/claude/sse/ryan',
      type: 'sse',
    },
  },
};

async function callOpenMemoryTool(toolName, params = {}) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Use the MCP tool mcp__openmemory__${toolName} with params: ${JSON.stringify(params)}`,
        },
      ],
      tools: [
        {
          name: `mcp__openmemory__${toolName}`,
          description: `OpenMemory ${toolName} operation`,
          input_schema: {
            type: 'object',
            properties: params,
          },
        },
      ],
      tool_choice: { type: 'tool', name: `mcp__openmemory__${toolName}` },
    });

    return message;
  } catch (error) {
    console.error(`Error calling ${toolName}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🧹 Claude Code SDK Memory Cleanup\n');

  console.log('⚠️  Important Notes:');
  console.log('- This uses your API key credits, not Max plan tokens');
  console.log('- Each operation costs API tokens');
  console.log('- Consider using the direct script for cost efficiency\n');

  // For now, show how to structure the SDK calls
  console.log('📝 Example SDK usage for memory operations:\n');

  console.log('1. List memories:');
  console.log(`
const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: 'List all memories using MCP OpenMemory'
  }],
  // MCP tools must be explicitly allowed
  allowedTools: ['mcp__openmemory__list_memories']
});
`);

  console.log('\n2. Search memories:');
  console.log(`
const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{
    role: 'user', 
    content: 'Search OpenMemory for "bravo-1" memories'
  }],
  allowedTools: ['mcp__openmemory__search_memory']
});
`);

  console.log('\n💡 Recommendation:');
  console.log("Since the Max plan doesn't include API access, and using the SDK");
  console.log('requires separate billing, I recommend using the direct script');
  console.log('with manual export/import instead.\n');
}

main().catch(console.error);
