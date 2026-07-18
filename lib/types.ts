export type Vendor = {
  id: string;
  created_at: string;
  name: string;
  type: 'vendor' | 'shopkeeper';
  phone: string | null;
  credit_limit?: number | null;
  is_active: boolean;
};

export type Product = {
  id: string;
  created_at: string;
  name: string;
  price_per_box: number | null;
  price_per_piece: number | null;
  pieces_per_box?: number | null;
  hsn_code?: string;
  is_active: boolean;
  is_party_pack?: boolean;
  aliases?: string[];
};

export type BillItem = {
  product_id: string;
  product_name: string;
  box_qty: number | null;
  piece_qty: number | null;
  rate: number;
  total: number;
};

export type Bill = {
  id: string;
  created_at: string;
  vendor_id: string;
  vendor_name: string;
  bill_number: string;
  subtotal: number;
  discount_type: string;
  discount_amount: number;
  gst_type: string;
  gst_amount: number;
  grand_total: number;
  date: string;
  items: BillItem[];
  bill_type?: 'simple' | 'gst';
};

export type Payment = {
  id: string;
  created_at: string;
  vendor_id: string;
  vendor_name: string;
  total_billed: number;
  cash: number;
  upi: number;
  total_received: number;
  outstanding: number;
  date: string;
};

export type Advance = {
  id: string;
  created_at: string;
  vendor_id: string;
  date: string;
  amount: number;
  note: string;
  used_in_settlement: boolean;
};

export type Settlement = {
  id: string;
  created_at: string;
  vendor_id: string;
  vendor_name: string;
  date_from: string;
  date_to: string;
  total_supplied: number;
  total_received: number;
  van_stock_total: number;
  final_balance: number;
  van_stock_detail: any;
  gst_rate?: number;
  gst_amount?: number;
};

export type SettlementNote = {
  id: string;
  vendor_id: string;
  date: string;
  note: string;
  created_at: string;
  updated_at?: string;
};

export type Purchase = {
  id: string;
  created_at: string;
  date: string;
  party_name: string;
  invoice_number?: string | null;
  total_amount: number;
  cash_amount: number;
  online_amount: number;
  note?: string | null;
  is_deleted?: boolean;
};

export type VanPriceCategory = {
  id: string;
  created_at: string;
  name: string;
  price: number;
};

export type AppSetting = {
  id: string;
  created_at: string;
  gst_number?: string;
  company_name?: string;
  address?: string;
  phone?: string;
  gstin?: string;
};

export type MoneyCalculatorEntry = {
  denomination: number;
  count: number;
  amount: number;
};

export type MoneyCalculatorHistory = {
  id: string;
  created_at: string;
  entries: MoneyCalculatorEntry[];
  total_amount: number;
  note?: string;
  is_deleted?: boolean;
};

export type Database = {
  public: {
    Tables: {
      vendors: {
        Row: Vendor;
        Insert: Partial<Vendor>;
        Update: Partial<Vendor>;
      };
      products: {
        Row: Product;
        Insert: Partial<Product>;
        Update: Partial<Product>;
      };
      bills: {
        Row: Bill;
        Insert: Partial<Bill>;
        Update: Partial<Bill>;
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment>;
        Update: Partial<Payment>;
      };
      settlements: {
        Row: Settlement;
        Insert: Partial<Settlement>;
        Update: Partial<Settlement>;
      };
      purchases: {
        Row: Purchase;
        Insert: Partial<Purchase>;
        Update: Partial<Purchase>;
      };
      van_price_categories: {
        Row: VanPriceCategory;
        Insert: Partial<VanPriceCategory>;
        Update: Partial<VanPriceCategory>;
      };
      app_settings: {
        Row: AppSetting;
        Insert: Partial<AppSetting>;
        Update: Partial<AppSetting>;
      };
      settlement_notes: {
        Row: SettlementNote;
        Insert: Partial<SettlementNote>;
        Update: Partial<SettlementNote>;
      };
      money_calculator_history: {
        Row: MoneyCalculatorHistory;
        Insert: Partial<MoneyCalculatorHistory>;
        Update: Partial<MoneyCalculatorHistory>;
      };
    };
  };
};
