#!/usr/bin/env node
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║          Validra – Startup Idea Bulk Import Script                 ║
 * ║                                                                    ║
 * ║  Supports:  JSON array  |  CSV (with headers)                      ║
 * ║  Embeddings generated locally via @xenova/transformers (free)      ║
 * ║                                                                    ║
 * ║  Usage:                                                            ║
 * ║    node scripts/importData.js --file data/ideas.json               ║
 * ║    node scripts/importData.js --file data/ideas.csv                ║
 * ║    node scripts/importData.js --file data/ideas.json --batch 10    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 *
 * Expected JSON format (array of objects):
 * [
 *   {
 *     "title": "AI-powered crop disease detection",
 *     "description": "Uses computer vision to identify plant diseases…",
 *     "domain": "AgriTech",
 *     "source": "external"   // optional, defaults to "external"
 *   },
 *   ...
 * ]
 *
 * Expected CSV format (first row must be a header row):
 *   title,description,domain,source
 *   "AI crop detection","Uses computer vision…","AgriTech","external"
 */

import fs from 'fs';
import path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { connectDB, getCollection, closeDB } from '../src/db/connection.js';
import { generateEmbedding, buildEmbeddingText } from '../src/services/embedder.js';
import { validateDomain, DOMAINS } from '../src/constants/domains.js';

dotenv.config();

// ── CLI argument parsing ──────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { file: null, batchSize: 5, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) opts.file = args[++i];
    if (args[i] === '--batch' && args[i + 1]) opts.batchSize = parseInt(args[++i]);
    if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// ── File loader ───────────────────────────────────────────────────────────────
function loadFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }

  const ext = path.extname(abs).toLowerCase();
  const raw = fs.readFileSync(abs, 'utf8');

  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON file must contain an array of objects at the top level.');
    }
    return parsed;
  }

  if (ext === '.csv') {
    return parseCsv(raw, {
      columns: true,          // use first row as field names
      skip_empty_lines: true,
      trim: true,
    });
  }

  throw new Error(`Unsupported file type: ${ext}. Use .json or .csv`);
}

// ── Row validator ─────────────────────────────────────────────────────────────
function validateRow(row, index) {
  const errors = [];

  if (!row.title?.trim()) errors.push('missing title');
  if (!row.description?.trim()) errors.push('missing description');

  const domain = validateDomain(row.domain);
  if (!domain) {
    errors.push(
      `invalid domain "${row.domain}". Must be one of: ${DOMAINS.join(', ')}`
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors, domain: null };
  }

  return {
    valid: true,
    errors: [],
    domain,
    source: row.source === 'user' ? 'user' : 'external',
  };
}

// ── Batch processing ──────────────────────────────────────────────────────────
async function processBatch(rows, collection, dryRun) {
  const docs = await Promise.all(
    rows.map(async ({ row, domain, source }) => {
      const text = buildEmbeddingText(row.title.trim(), row.description.trim());
      const vector_embedding = await generateEmbedding(text);

      return {
        title: row.title.trim(),
        description: row.description.trim(),
        domain,
        vector_embedding,
        source,
        created_at: new Date(),
      };
    })
  );

  if (!dryRun) {
    const result = await collection.insertMany(docs, { ordered: false });
    return result.insertedCount;
  }

  // Dry run: just log what would be inserted
  docs.forEach((d) =>
    console.log(`  [DRY-RUN] Would insert: "${d.title}" (${d.domain})`)
  );
  return docs.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (!opts.file) {
    console.error('❌ Usage: node scripts/importData.js --file <path/to/file.json|csv>');
    console.error('   Options:');
    console.error('     --batch <n>   Number of records to embed concurrently (default 5)');
    console.error('     --dry-run     Parse and validate without inserting');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(' Validra – Startup Idea Bulk Import');
  console.log('═══════════════════════════════════════════════');
  console.log(`  File:      ${opts.file}`);
  console.log(`  Batch:     ${opts.batchSize} concurrent embeddings`);
  console.log(`  Dry run:   ${opts.dryRun ? 'YES (no inserts)' : 'NO'}`);
  console.log('═══════════════════════════════════════════════\n');

  // 1. Load file
  console.log('📂 Loading file…');
  const rows = loadFile(opts.file);
  console.log(`   Found ${rows.length} records.\n`);

  // 2. Validate all rows
  console.log('🔍 Validating records…');
  const valid = [];
  const invalid = [];

  rows.forEach((row, i) => {
    const result = validateRow(row, i);
    if (result.valid) {
      valid.push({ row, domain: result.domain, source: result.source });
    } else {
      invalid.push({ index: i + 1, errors: result.errors, title: row.title });
    }
  });

  console.log(`   ✅ Valid:   ${valid.length}`);
  console.log(`   ❌ Invalid: ${invalid.length}`);

  if (invalid.length > 0) {
    console.log('\n   Invalid rows:');
    invalid.forEach(({ index, title, errors }) => {
      console.log(`     Row ${index} ("${title}"): ${errors.join('; ')}`);
    });
  }

  if (valid.length === 0) {
    console.log('\n⚠️  No valid records to import. Exiting.');
    process.exit(0);
  }

  // 3. Connect to DB
  if (!opts.dryRun) {
    console.log('\n🔌 Connecting to MongoDB Atlas…');
    await connectDB();
  }

  const collection = opts.dryRun ? null : getCollection();

  // 4. Process in batches
  console.log(`\n⚙️  Generating embeddings & importing (batch size: ${opts.batchSize})…`);
  let imported = 0;
  const startTime = Date.now();

  for (let i = 0; i < valid.length; i += opts.batchSize) {
    const batch = valid.slice(i, i + opts.batchSize);
    const batchNum = Math.floor(i / opts.batchSize) + 1;
    const totalBatches = Math.ceil(valid.length / opts.batchSize);

    process.stdout.write(
      `   Batch ${batchNum}/${totalBatches}: processing ${batch.length} records… `
    );

    try {
      const count = await processBatch(batch, collection, opts.dryRun);
      imported += count;
      console.log(`✅ (${count} inserted)`);
    } catch (err) {
      console.log(`❌ Batch failed: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 5. Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log(` Import complete in ${elapsed}s`);
  console.log(`  Imported: ${imported}/${valid.length} records`);
  console.log(`  Skipped:  ${invalid.length} invalid records`);
  console.log('═══════════════════════════════════════════════\n');

  if (!opts.dryRun) await closeDB();
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
