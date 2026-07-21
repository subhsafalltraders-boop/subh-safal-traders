-- Performance fix: bill saving was taking 5-10 minutes because generateBillNumber()
-- ran `bills.select('bill_number').like('bill_number', 'SST-2026-%').order(...)`
-- with no index backing it, forcing a full sequential scan + sort on every single
-- bill save as the table grew. The app code now also only fetches the single
-- highest bill_number (LIMIT 1) instead of every row, but that still needs an
-- index to be fast rather than a full scan under the hood.

-- Speeds up the bill_number prefix search + sort (LIKE 'SST-2026-%' ORDER BY bill_number DESC)
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills (bill_number DESC);

-- Speeds up the very common (vendor_id, date, is_deleted) lookups used for:
--   - duplicate same-day bill checks in billing/page.tsx
--   - "today's billed amount" lookups in payments/page.tsx
--   - vendor-status and dashboard day-level aggregates
CREATE INDEX IF NOT EXISTS idx_bills_vendor_date ON bills (vendor_id, date) WHERE is_deleted = false;

-- Speeds up date-range report/dashboard queries (bills.select(...).gte('date', ...))
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills (date) WHERE is_deleted = false;

-- Same pattern for payments (vendor+date lookups, date-range reports)
CREATE INDEX IF NOT EXISTS idx_payments_vendor_date ON payments (vendor_id, date) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments (date) WHERE is_deleted = false;
