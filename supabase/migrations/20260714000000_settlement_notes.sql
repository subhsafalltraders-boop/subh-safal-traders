-- Per-day notes on the (simplified) settlements page. A vendor + date can have
-- one free-text note attached (about a bill, a payment, or an absent day).
CREATE TABLE IF NOT EXISTS settlement_notes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vendor_id, date)
);

ALTER TABLE settlement_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_settlement_notes" ON settlement_notes;
CREATE POLICY "anon_all_settlement_notes" ON settlement_notes FOR ALL TO anon USING (true) WITH CHECK (true);
