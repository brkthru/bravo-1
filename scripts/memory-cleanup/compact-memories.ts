#!/usr/bin/env node
/**
 * Memory Cleanup Script using Claude Code SDK
 *
 * This script will:
 * 1. Connect to OpenMemory via Claude Code SDK
 * 2. List all memories
 * 3. Filter for project-specific memories
 * 4. Compact verbose memories
 * 5. Delete old memories and add compacted ones
 *
 * NOTE: This requires you to have an Anthropic API key
 * The Max plan gives you access to Claude Code UI, but SDK usage
 * requires an API key from console.anthropic.com
 */

import Anthropic from '@anthropic/sdk';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Initialize Claude Code SDK client
const client = new ClaudeCodeClient();

// Project keywords to filter memories
const PROJECT_KEYWORDS = ['bravo-1', 'bravo1', 'media-tool', 'mediatool', 'mongodb migration'];

// Memory compaction rules
const COMPACTION_RULES = {
  // Configuration patterns
  'mongodb.*localhost.*27017': (text: string) => {
    const match = text.match(/mongodb.*localhost:?(\d+)?.*database:?\s*([^\s,]+)/i);
    if (match) return `[bravo-1] MongoDB localhost:27017 db:${match[2] || 'bravo-1'}`;
    return text;
  },

  'backend.*3001|express.*3001': (text: string) => '[bravo-1] Backend Express:3001',

  'frontend.*5174|vite.*5174': (text: string) => '[bravo-1] Frontend Vite:5174',

  // ETL patterns
  'etl.*pipeline.*scripts/etl': (text: string) => {
    if (text.includes('duplicate') || text.includes('idempotent')) {
      return '[bravo-1] ETL scripts/etl/run-full-etl-pipeline.ts WARNING:creates-duplicates';
    }
    return '[bravo-1] ETL scripts/etl/run-full-etl-pipeline.ts';
  },

  // Migration patterns
  'migrat.*from.*postgres': (text: string) => '[bravo-1] Migrated from PostgreSQL to MongoDB',

  // Remove verbose explanations
  'The\\s+\\w+\\s+project': (text: string) => {
    // Extract key facts from verbose descriptions
    const facts = [];
    if (text.match(/mongodb/i)) facts.push('MongoDB');
    if (text.match(/postgres/i)) facts.push('PostgreSQL');
    if (text.match(/port\s*(\d+)/gi)) {
      const ports = text.match(/port\s*(\d+)/gi);
      facts.push(...ports.map((p) => p.replace(/port\s*/i, '')));
    }
    return facts.length ? `[bravo-1] ${facts.join(' ')}` : text;
  },
};

interface Memory {
  id: string;
  text: string;
  metadata?: any;
}

interface CompactedMemory {
  original: string;
  compacted: string;
  shouldDelete: boolean;
  project: string;
}

// Classify memory by project
function classifyProject(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('bravo-1') || lowerText.includes('bravo1')) return 'bravo-1';
  if (lowerText.includes('media-tool') || lowerText.includes('mediatool')) return 'media-tool';
  if (lowerText.includes('mongodb') && lowerText.includes('migration')) return 'bravo-1';

  // Check for specific patterns
  if (lowerText.includes('27017')) return 'bravo-1'; // MongoDB port
  if (lowerText.includes('3001')) return 'bravo-1'; // Backend port
  if (lowerText.includes('5174')) return 'bravo-1'; // Frontend port

  return 'unknown';
}

// Compact a memory text
function compactMemory(text: string, project: string): string {
  let compacted = text.trim();

  // Apply compaction rules
  for (const [pattern, replacer] of Object.entries(COMPACTION_RULES)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(compacted)) {
      compacted = replacer(compacted);
      break;
    }
  }

  // If no rule matched but we know the project, add prefix
  if (compacted === text && project !== 'unknown' && !compacted.startsWith(`[${project}]`)) {
    compacted = `[${project}] ${compacted}`;
  }

  // General cleanup
  compacted = compacted
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\s*,\s*/g, ', ') // Clean up commas
    .replace(/\s*:\s*/g, ':') // Clean up colons
    .trim();

  return compacted;
}

// Check if memory should be deleted
function shouldDeleteMemory(text: string): boolean {
  const deletePatterns = [
    /test\s+data/i,
    /temporary/i,
    /delete\s+me/i,
    /old\s+version/i,
    /deprecated/i,
    /^\s*$/, // Empty or whitespace only
    /^undefined$/i,
    /^null$/i,
  ];

  return deletePatterns.some((pattern) => pattern.test(text));
}

async function main() {
  console.log('🧹 Starting Memory Cleanup Process...\n');

  try {
    // Step 1: List all memories
    console.log('📋 Fetching all memories...');
    const memories = await client.mcp.openmemory.listMemories();
    console.log(`Found ${memories.length} total memories\n`);

    // Step 2: Analyze and compact memories
    const analyzed: CompactedMemory[] = [];

    for (const memory of memories) {
      const text = memory.text || memory.content || '';
      const project = classifyProject(text);
      const shouldDelete = shouldDeleteMemory(text);
      const compacted = shouldDelete ? '' : compactMemory(text, project);

      analyzed.push({
        original: text,
        compacted,
        shouldDelete,
        project,
      });
    }

    // Step 3: Generate report
    const report = {
      totalMemories: memories.length,
      byProject: {
        'bravo-1': analyzed.filter((m) => m.project === 'bravo-1').length,
        'media-tool': analyzed.filter((m) => m.project === 'media-tool').length,
        unknown: analyzed.filter((m) => m.project === 'unknown').length,
      },
      toDelete: analyzed.filter((m) => m.shouldDelete).length,
      toCompact: analyzed.filter((m) => !m.shouldDelete && m.original !== m.compacted).length,
      unchanged: analyzed.filter((m) => !m.shouldDelete && m.original === m.compacted).length,
    };

    console.log('📊 Analysis Results:');
    console.log(`  Total memories: ${report.totalMemories}`);
    console.log(`  By project:`);
    console.log(`    - bravo-1: ${report.byProject['bravo-1']}`);
    console.log(`    - media-tool: ${report.byProject['media-tool']}`);
    console.log(`    - unknown: ${report.byProject.unknown}`);
    console.log(`  To delete: ${report.toDelete}`);
    console.log(`  To compact: ${report.toCompact}`);
    console.log(`  Unchanged: ${report.unchanged}\n`);

    // Step 4: Save analysis to file for review
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const backupFile = join(__dirname, `memory-backup-${timestamp}.json`);
    const analysisFile = join(__dirname, `memory-analysis-${timestamp}.json`);

    writeFileSync(backupFile, JSON.stringify(memories, null, 2));
    writeFileSync(
      analysisFile,
      JSON.stringify(
        {
          report,
          memories: analyzed,
        },
        null,
        2
      )
    );

    console.log(`💾 Saved backup to: ${backupFile}`);
    console.log(`📄 Saved analysis to: ${analysisFile}\n`);

    // Step 5: Show examples of changes
    console.log('📝 Example compactions:');
    const examples = analyzed
      .filter((m) => !m.shouldDelete && m.original !== m.compacted)
      .slice(0, 5);

    for (const example of examples) {
      console.log('\nOriginal:');
      console.log(`  "${example.original}"`);
      console.log('Compacted:');
      console.log(`  "${example.compacted}"`);
    }

    // Step 6: Ask for confirmation
    console.log('\n⚠️  Ready to apply changes:');
    console.log(`  - Delete ${report.toDelete} memories`);
    console.log(`  - Update ${report.toCompact} memories`);
    console.log('\nRun with --apply flag to execute changes');

    // Step 7: Apply changes if requested
    if (process.argv.includes('--apply')) {
      console.log('\n🚀 Applying changes...');

      // Delete all memories first
      await client.mcp.openmemory.deleteAllMemories();
      console.log('✅ Deleted all memories');

      // Add back compacted memories
      const toAdd = analyzed.filter((m) => !m.shouldDelete && m.compacted);
      for (const memory of toAdd) {
        await client.mcp.openmemory.addMemory({
          text: memory.compacted,
        });
      }

      console.log(`✅ Added ${toAdd.length} compacted memories`);
      console.log('\n🎉 Memory cleanup complete!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
main();
