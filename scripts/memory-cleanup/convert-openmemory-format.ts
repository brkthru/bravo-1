#!/usr/bin/env bun
/**
 * Convert OpenMemory format to cleanup script format
 */

import { readFileSync, writeFileSync } from 'fs';

// Read the OpenMemory export
const openMemoryData = JSON.parse(readFileSync('memories-export.json', 'utf-8'));

// Convert format: map 'memory' field to 'text' field
const convertedData = openMemoryData.map((item: any) => ({
  id: item.id,
  text: item.memory,
  timestamp: item.created_at,
}));

// Write converted data
writeFileSync('memories-converted.json', JSON.stringify(convertedData, null, 2));

console.log(`✅ Converted ${convertedData.length} memories from OpenMemory format`);
console.log('📄 Output saved to: memories-converted.json');
