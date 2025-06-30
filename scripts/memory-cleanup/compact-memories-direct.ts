#!/usr/bin/env bun
/**
 * Direct Memory Cleanup Script
 *
 * This script interacts directly with OpenMemory to:
 * 1. Export all memories
 * 2. Filter and compact them
 * 3. Provide a clean import file
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Project-specific patterns
const PROJECT_PATTERNS = {
  'bravo-1': [
    /bravo-?1/i,
    /mongodb.*27017/i,
    /backend.*3001/i,
    /frontend.*5174/i,
    /media.*planning.*mongo/i,
    /etl.*pipeline/i,
    /scripts\/etl/i,
  ],
  'media-tool': [/media-?tool/i, /postgres.*5432/i, /mediatool_v2/i, /pg-promise/i],
};

// Compaction templates
const COMPACTION_TEMPLATES = [
  {
    pattern: /mongodb.*(localhost|127\.0\.0\.1):?(\d+)?.*database:?\s*([^\s,]+)/i,
    template: (matches: RegExpMatchArray) =>
      `MongoDB localhost:27017 db:${matches[3] || 'bravo-1'}`,
  },
  {
    pattern: /backend.*express.*port:?\s*(\d+)/i,
    template: (matches: RegExpMatchArray) => `Backend Express:${matches[1] || '3001'}`,
  },
  {
    pattern: /frontend.*vite.*port:?\s*(\d+)/i,
    template: (matches: RegExpMatchArray) => `Frontend Vite:${matches[1] || '5174'}`,
  },
  {
    pattern: /etl.*pipeline.*scripts\/etl\/([\w-]+\.ts)/i,
    template: (matches: RegExpMatchArray) =>
      `ETL scripts/etl/${matches[1] || 'run-full-etl-pipeline.ts'}`,
  },
  {
    pattern: /etl.*duplicate|idempotent.*issue/i,
    template: () => `ETL WARNING: creates duplicates on multiple runs`,
  },
];

interface Memory {
  id?: string;
  text: string;
  timestamp?: string;
}

interface ProcessedMemory {
  original: string;
  processed: string;
  project: string;
  action: 'keep' | 'compact' | 'delete';
  reason?: string;
}

function detectProject(text: string): string {
  for (const [project, patterns] of Object.entries(PROJECT_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return project;
    }
  }
  return 'unknown';
}

function shouldDelete(text: string): { delete: boolean; reason?: string } {
  // Empty or invalid
  if (!text || text.trim().length < 5) {
    return { delete: true, reason: 'Too short or empty' };
  }

  // Test data
  if (/test\s+data|dummy|example|foo|bar/i.test(text)) {
    return { delete: true, reason: 'Test data' };
  }

  // Temporary or deprecated
  if (/temporary|deprecated|old|obsolete/i.test(text)) {
    return { delete: true, reason: 'Outdated' };
  }

  // Duplicates common in CLAUDE.md
  if (/^(Install dependencies|Start MongoDB|Run servers)$/i.test(text.trim())) {
    return { delete: true, reason: 'Common command (in CLAUDE.md)' };
  }

  return { delete: false };
}

function compactMemory(text: string, project: string): string {
  // Try each compaction template
  for (const { pattern, template } of COMPACTION_TEMPLATES) {
    const match = text.match(pattern);
    if (match) {
      const compacted = template(match);
      return project !== 'unknown' ? `[${project}] ${compacted}` : compacted;
    }
  }

  // General compaction strategies
  let compacted = text.trim();

  // Remove common verbose phrases
  compacted = compacted
    .replace(/The\s+\w+\s+project\s+/gi, '')
    .replace(/is\s+a\s+/gi, ' ')
    .replace(/that\s+is\s+/gi, ' ')
    .replace(/which\s+is\s+/gi, ' ')
    .replace(/This\s+is\s+/gi, '')
    .replace(/It\s+is\s+/gi, '');

  // Extract key information
  const keyInfo = [];

  // Ports
  const ports = compacted.match(/(?:port|:)\s*(\d{4,5})/gi);
  if (ports) {
    keyInfo.push(...ports.map((p) => p.replace(/(?:port|:)\s*/i, '')));
  }

  // Technologies
  const techs = compacted.match(/\b(MongoDB|PostgreSQL|Express|Vite|React|TypeScript|Docker)\b/gi);
  if (techs) {
    keyInfo.push(...[...new Set(techs)]);
  }

  // File paths
  const paths = compacted.match(/(?:scripts|src|backend|frontend)\/[\w\/-]+\.\w+/g);
  if (paths) {
    keyInfo.push(...paths);
  }

  // If we extracted key info, use that
  if (keyInfo.length > 0) {
    compacted = keyInfo.join(' ');
  }

  // Clean up whitespace
  compacted = compacted.replace(/\s+/g, ' ').trim();

  // Add project prefix if not present
  if (project !== 'unknown' && !compacted.startsWith(`[${project}]`)) {
    compacted = `[${project}] ${compacted}`;
  }

  // Ensure it's actually shorter
  if (compacted.length >= text.length * 0.8) {
    // If we didn't save at least 20%, try more aggressive compaction
    const words = compacted.split(' ');
    if (words.length > 10) {
      // Keep only key terms
      const keywords = words.filter(
        (w) =>
          /^[A-Z]/.test(w) || // Capitalized words
          /\d/.test(w) || // Contains numbers
          /[\/.]/.test(w) || // Paths
          w.length > 7 // Longer words
      );
      if (keywords.length > 3) {
        compacted = keywords.join(' ');
        if (project !== 'unknown') {
          compacted = `[${project}] ${compacted}`;
        }
      }
    }
  }

  return compacted;
}

function processMemories(memories: Memory[]): ProcessedMemory[] {
  return memories.map((memory) => {
    const text = memory.text || '';
    const project = detectProject(text);
    const { delete: shouldDel, reason } = shouldDelete(text);

    if (shouldDel) {
      return {
        original: text,
        processed: '',
        project,
        action: 'delete',
        reason,
      };
    }

    const compacted = compactMemory(text, project);

    // Decide action based on compaction result
    const savedChars = text.length - compacted.length;
    const savedPercent = (savedChars / text.length) * 100;

    if (savedPercent > 20) {
      return {
        original: text,
        processed: compacted,
        project,
        action: 'compact',
      };
    }

    return {
      original: text,
      processed: text,
      project,
      action: 'keep',
    };
  });
}

async function main() {
  const mode = process.argv[2] || 'analyze';

  console.log('🧹 Memory Cleanup Tool\n');

  // Step 1: Read memories from file or stdin
  console.log('📥 Reading memories...');
  console.log('Please paste your memories JSON and press Ctrl+D when done:\n');

  let memoriesJson = '';
  for await (const chunk of Bun.stdin.stream()) {
    memoriesJson += new TextDecoder().decode(chunk);
  }

  let memories: Memory[];
  try {
    memories = JSON.parse(memoriesJson);
    if (!Array.isArray(memories)) {
      memories = [memories];
    }
  } catch (error) {
    console.error('❌ Invalid JSON input');
    process.exit(1);
  }

  console.log(`\n✅ Loaded ${memories.length} memories\n`);

  // Step 2: Process memories
  const processed = processMemories(memories);

  // Step 3: Generate statistics
  const stats = {
    total: processed.length,
    byProject: {} as Record<string, number>,
    byAction: {} as Record<string, number>,
    charactersSaved: 0,
  };

  for (const mem of processed) {
    stats.byProject[mem.project] = (stats.byProject[mem.project] || 0) + 1;
    stats.byAction[mem.action] = (stats.byAction[mem.action] || 0) + 1;

    if (mem.action === 'compact') {
      stats.charactersSaved += mem.original.length - mem.processed.length;
    }
  }

  // Step 4: Display results
  console.log('📊 Analysis Results:');
  console.log(`\nTotal memories: ${stats.total}`);

  console.log('\nBy project:');
  for (const [project, count] of Object.entries(stats.byProject)) {
    console.log(`  ${project}: ${count}`);
  }

  console.log('\nBy action:');
  for (const [action, count] of Object.entries(stats.byAction)) {
    console.log(`  ${action}: ${count}`);
  }

  console.log(`\nCharacters saved: ${stats.charactersSaved.toLocaleString()}`);

  // Step 5: Show examples
  console.log('\n📝 Example compactions:');
  const examples = processed.filter((m) => m.action === 'compact').slice(0, 5);

  for (const example of examples) {
    console.log(`\n[${example.project}]`);
    console.log(`Original (${example.original.length} chars):`);
    console.log(
      `  "${example.original.substring(0, 80)}${example.original.length > 80 ? '...' : ''}"`
    );
    console.log(`Compacted (${example.processed.length} chars):`);
    console.log(`  "${example.processed}"`);
  }

  // Step 6: Save results
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const outputDir = join(import.meta.dir);

  // Save analysis
  const analysisFile = join(outputDir, `analysis-${timestamp}.json`);
  writeFileSync(
    analysisFile,
    JSON.stringify(
      {
        stats,
        memories: processed,
      },
      null,
      2
    )
  );

  // Save compacted memories for re-import
  const compactedMemories = processed
    .filter((m) => m.action !== 'delete')
    .map((m) => ({
      text: m.processed,
      project: m.project,
    }));

  const importFile = join(outputDir, `import-${timestamp}.json`);
  writeFileSync(importFile, JSON.stringify(compactedMemories, null, 2));

  console.log(`\n💾 Files saved:`);
  console.log(`  Analysis: ${analysisFile}`);
  console.log(`  Import: ${importFile}`);

  // Step 7: Generate import instructions
  console.log('\n📋 To apply these changes:');
  console.log('1. Delete all memories in OpenMemory');
  console.log('2. Import the compacted memories from the import file');
  console.log(`3. Total memories after cleanup: ${compactedMemories.length}`);
}

main().catch(console.error);
