ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_type varchar(10) DEFAULT 'simple';
