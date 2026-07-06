-- Simple financial-entry Purchases table: records money paid to the ice cream
-- company for stock delivered (not linked to individual products).
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  date date NOT NULL,
  party_name text NOT NULL,
  invoice_number text,
  total_amount numeric NOT NULL DEFAULT 0,
  cash_amount numeric NOT NULL DEFAULT 0,
  online_amount numeric NOT NULL DEFAULT 0,
  note text,
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_purchases" ON purchases;
CREATE POLICY "anon_all_purchases" ON purchases FOR ALL TO anon USING (true) WITH CHECK (true);
