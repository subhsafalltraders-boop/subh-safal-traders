import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put, list, del } from '@vercel/blob';
import type { Database } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
] as const;

const KEEP_LAST_N_BACKUPS = 14; // ~2 weeks of daily backups before old ones are pruned

async function fetchAllRows(
  supabase: ReturnType<typeof createClient<Database>>,
  table: string
): Promise<unknown[] | null> {
  const pageSize = 1000;
  let from = 0;
  let allRows: unknown[] = [];

  // Paginate so this keeps working even once a table has well over 1000 rows.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table as any)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn(`[backup] Skipping "${table}": ${error.message}`);
      return null;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

// Runs on a schedule via Vercel Cron (see vercel.json) inside the live
// deployment — so it uses the same network path the app already relies on,
// rather than an external script that may not have DB access.
//
// This is a safety net, not a replacement for real point-in-time database
// backups: it's a periodic JSON snapshot of the business tables, stored in
// Vercel Blob, so there's always a recent recoverable copy of the data
// outside the live database if something ever gets corrupted or deleted
// by mistake.
export async function GET(request: NextRequest) {
  // Protect the endpoint: Vercel Cron sends a bearer token matching CRON_SECRET
  // (set in Vercel project env vars). Reject anything else so this can't be
  // triggered by a random request hitting the URL.
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup: { generated_at: string; tables: Record<string, unknown[]> } = {
    generated_at: new Date().toISOString(),
    tables: {},
  };

  const summary: Record<string, number | string> = {};

  for (const table of TABLES) {
    const rows = await fetchAllRows(supabase, table);
    if (rows === null) {
      summary[table] = 'skipped (error or missing)';
      continue;
    }
    backup.tables[table] = rows;
    summary[table] = rows.length;
  }

  const json = JSON.stringify(backup, null, 2);
  const filename = `backups/backup-${timestamp}.json`;

  try {
    const blobResult = await put(filename, json, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Prune old backups beyond the retention window so Blob storage doesn't
    // grow unbounded on the free tier.
    const { blobs } = await list({ prefix: 'backups/' });
    const sorted = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)); // newest first (ISO timestamps sort lexically)
    const toDelete = sorted.slice(KEEP_LAST_N_BACKUPS);
    if (toDelete.length > 0) {
      await del(toDelete.map((b) => b.url));
    }

    return NextResponse.json({
      success: true,
      file: blobResult.url,
      tables: summary,
      pruned: toDelete.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, tables: summary },
      { status: 500 }
    );
  }
}
