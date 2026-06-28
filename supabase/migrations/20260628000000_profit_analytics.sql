-- Add cost_price to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- Add total_cost and total_profit to bills
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit NUMERIC DEFAULT 0;
