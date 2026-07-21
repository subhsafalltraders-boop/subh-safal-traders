// Manual companion to the automated backup at app/api/cron/backup/route.ts
// (which runs daily via Vercel Cron, see vercel.json, and saves to Vercel Blob).
// Use this script when you want an on-demand backup to a local file right now,
// without waiting for the next scheduled run — e.g. right before a risky change.
//
// Run manually: node scripts/backup-supabase.mjs
// Writes to:    ./backups/backup-<timestamp>.json (gitignored — see .gitignore)
//
// Requires two env vars (already present in .env.local for local runs):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// The anon key is sufficient here because this project's RLS policies grant
// full read access to `anon` (see supabase/migrations/20260630000000_open_rls_for_anon.sql).

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// All the business-critical tables — add new ones here if the schema grows.
const TABLES = [
  'bills',
  'payments',
  'vendors',
  'products',
  'settlements',
  'settlement_notes',
  'vendor_advances',
  'purchases',
  'app_settings',
  'money_calculator_history',
];

async function fetchAllRows(table) {
  // Paginate in chunks of 1000 so this keeps working even as tables grow
  // well past a single request's row limit.
  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      // Table might not exist in every environment (e.g. money_calculator_history
      // was added later) — don't fail the whole backup for one missing table.
      console.warn(`  ! Skipping "${table}": ${error.message}`);
      return null;
    }

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = {
    generated_at: new Date().toISOString(),
    tables: {},
  };

  console.log(`Starting Supabase backup — ${timestamp}`);

  for (const table of TABLES) {
    process.stdout.write(`  Exporting ${table}... `);
    const rows = await fetchAllRows(table);
    if (rows === null) continue;
    backup.tables[table] = rows;
    console.log(`${rows.length} rows`);
  }

  const outDir = path.join(__dirname, '..', 'backups');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `backup-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(backup, null, 2));

  const sizeKB = (JSON.stringify(backup).length / 1024).toFixed(1);
  console.log(`\nBackup written: ${outPath} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
