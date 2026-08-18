CREATE TABLE withdrawals (
  id TEXT PRIMARY KEY NOT NULL,
  investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  contribution_id TEXT NOT NULL,
  date TEXT NOT NULL,
  principal REAL NOT NULL,
  remaining_principal REAL NOT NULL,
  gross_yield REAL NOT NULL,
  iof REAL NOT NULL,
  iof_rate REAL NOT NULL,
  income_tax REAL NOT NULL,
  income_tax_rate REAL NOT NULL,
  net_yield REAL NOT NULL,
  net_amount REAL NOT NULL,
  days_held INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_withdrawals_investment ON withdrawals(investment_id, date);
CREATE INDEX idx_withdrawals_contribution ON withdrawals(contribution_id);
