-- TEMPORARY: Allow anon access to all tables (no login required)
-- Run this in Supabase SQL Editor

-- bills table
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_bills" ON bills;
CREATE POLICY "anon_all_bills" ON bills FOR ALL TO anon USING (true) WITH CHECK (true);

-- vendors table
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_vendors" ON vendors;
CREATE POLICY "anon_all_vendors" ON vendors FOR ALL TO anon USING (true) WITH CHECK (true);

-- bill_items table (only if it exists — this project actually stores line items
-- as a JSON column on `bills`, not a separate table, so this is usually skipped)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bill_items') THEN
    ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_all_bill_items" ON bill_items;
    CREATE POLICY "anon_all_bill_items" ON bill_items FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_products" ON products;
CREATE POLICY "anon_all_products" ON products FOR ALL TO anon USING (true) WITH CHECK (true);

-- payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_payments" ON payments;
CREATE POLICY "anon_all_payments" ON payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- settlements table
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_settlements" ON settlements;
CREATE POLICY "anon_all_settlements" ON settlements FOR ALL TO anon USING (true) WITH CHECK (true);

-- vendor_advances table
ALTER TABLE vendor_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_vendor_advances" ON vendor_advances;
CREATE POLICY "anon_all_vendor_advances" ON vendor_advances FOR ALL TO anon USING (true) WITH CHECK (true);

-- membership table (feature removed from the app; only touch it if it still exists in the DB)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'membership') THEN
    ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_all_membership" ON membership;
    CREATE POLICY "anon_all_membership" ON membership FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- purchases table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'purchases') THEN
    ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_all_purchases" ON purchases;
    CREATE POLICY "anon_all_purchases" ON purchases FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
