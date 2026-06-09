CREATE TABLE IF NOT EXISTS vendor_advances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid REFERENCES vendors(id),
  date date NOT NULL,
  amount integer NOT NULL,
  note text DEFAULT '',
  used_in_settlement boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
