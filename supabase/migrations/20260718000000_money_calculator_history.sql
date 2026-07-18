-- Standalone cash-denomination calculator (served at /money). Each save stores the
-- full denomination breakdown plus the total and an optional note (e.g. which bank
-- account the cash was deposited against).
CREATE TABLE IF NOT EXISTS money_calculator_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  entries jsonb not null default '[]',
  total_amount numeric not null default 0,
  note text default '',
  is_deleted boolean not null default false
);

ALTER TABLE money_calculator_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_money_calculator_history" ON money_calculator_history;
CREATE POLICY "anon_all_money_calculator_history" ON money_calculator_history FOR ALL TO anon USING (true) WITH CHECK (true);
