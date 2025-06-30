#!/usr/bin/env bun
/**
 * Generate MCP commands to import cleaned memories
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const importFile = process.argv[2];

if (!importFile) {
  console.error('Usage: bun generate-import-commands.ts import-[timestamp].json');
  process.exit(1);
}

try {
  const memories = JSON.parse(readFileSync(importFile, 'utf-8'));

  console.log('# OpenMemory Import Commands\n');
  console.log('## Step 1: Clear all existing memories\n');
  console.log('```');
  console.log('mcp__openmemory__delete_all_memories');
  console.log('```\n');

  console.log('## Step 2: Import cleaned memories\n');
  console.log('Copy and run each command below in Claude Code:\n');

  // Remove duplicates
  const uniqueMemories = Array.from(new Set(memories.map((m) => m.text)));

  uniqueMemories.forEach((text, index) => {
    console.log(`### Memory ${index + 1}/${uniqueMemories.length}`);
    console.log('```');
    console.log('mcp__openmemory__add_memories');
    console.log(`text: "${text}"`);
    console.log('```\n');
  });

  console.log(`## Summary\n`);
  console.log(`- Total unique memories to import: ${uniqueMemories.length}`);
  console.log(`- Removed ${memories.length - uniqueMemories.length} duplicates`);
} catch (error) {
  console.error('Error reading import file:', error.message);
  process.exit(1);
}
