#!/usr/bin/env bun

import { createReadStream } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { parse } from 'csv-parse';
import { transform } from 'stream-transform';

const csvFile = process.argv[2];
const jsonFile = process.argv[3];

async function convertCsvToJsonStream() {
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
  });

  const transformer = transform((record, callback) => {
    callback(null, JSON.stringify(record) + '\n');
  });

  await pipeline(createReadStream(csvFile), parser, transformer, createWriteStream(jsonFile));

  console.log(`Converted ${csvFile} to ${jsonFile}`);
}

convertCsvToJsonStream().catch(console.error);
