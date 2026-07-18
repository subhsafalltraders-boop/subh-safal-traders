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
      money_calculator_history: {
        Row: MoneyCalculatorHistory;
        Insert: Partial<MoneyCalculatorHistory>;
        Update: Partial<MoneyCalculatorHistory>;
      };
    };
  };
};
