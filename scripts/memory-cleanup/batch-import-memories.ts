#!/usr/bin/env bun
/**
 * Batch import memories from cleaned import file
 */

import { readFileSync } from 'fs';

const importFile = process.argv[2] || 'import-2025-06-29-21-39-21.json';

console.log(`📥 Reading memories from: ${importFile}`);

try {
  const memories = JSON.parse(readFileSync(importFile, 'utf-8'));

  // Remove duplicates
  const uniqueTexts = [...new Set(memories.map((m) => m.text))];

  console.log(`✅ Found ${memories.length} memories, ${uniqueTexts.length} unique`);
  console.log('\n🚀 Starting batch import...\n');

  // Import each unique memory
  for (let i = 0; i < uniqueTexts.length; i++) {
    const text = uniqueTexts[i];
    console.log(
      `[${i + 1}/${uniqueTexts.length}] ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`
    );

    // Since we can't directly call MCP from here, output the command
    console.log(`mcp__openmemory__add_memories { "text": "${text.replace(/"/g, '\\"')}" }`);
  }

  console.log('\n✅ Import commands generated!');
  console.log('📋 Copy the commands above and run them in Claude Code');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
