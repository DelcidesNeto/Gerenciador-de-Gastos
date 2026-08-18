import type {
  Contribution,
  Expense,
  Investment,
  UserProfile,
  UserRole,
  Withdrawal,
} from '../models/schemas';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  role: UserRole;
  created_at: string;
  updated_at: string | null;
};

export type ExpenseRow = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  payment_method: string;
  notes: string;
  created_at: string;
  updated_at: string;
  version: number;
};

export type InvestmentRow = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  cdi_percent: number;
  created_at: string;
  updated_at: string;
  version: number;
};

export type ContributionRow = {
  id: string;
  investment_id: string;
  amount: number;
  date: string;
  created_at: string;
};

export type WithdrawalRow = {
  id: string;
  investment_id: string;
  contribution_id: string;
  date: string;
  principal: number;
  remaining_principal: number;
  gross_yield: number;
  iof: number;
  iof_rate: number;
  income_tax: number;
  income_tax_rate: number;
  net_yield: number;
  net_amount: number;
  days_held: number;
  created_at: string;
};

export function userFromRow(row: UserRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    salt: row.salt,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    date: row.date,
    category: row.category,
    paymentMethod: row.payment_method,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export function contributionFromRow(row: ContributionRow): Contribution {
  return {
    id: row.id,
    amount: row.amount,
    date: row.date,
    createdAt: row.created_at,
  };
}

export function withdrawalFromRow(row: WithdrawalRow): Withdrawal {
  return {
    id: row.id,
    investmentId: row.investment_id,
    contributionId: row.contribution_id,
    date: row.date,
    principal: row.principal,
    remainingPrincipal: row.remaining_principal,
    grossYield: row.gross_yield,
    iof: row.iof,
    iofRate: row.iof_rate,
    incomeTax: row.income_tax,
    incomeTaxRate: row.income_tax_rate,
    netYield: row.net_yield,
    netAmount: row.net_amount,
    daysHeld: row.days_held,
    createdAt: row.created_at,
  };
}

export function investmentFromRow(
  row: InvestmentRow,
  contributions: Contribution[] = [],
): Investment {
  return {
    id: row.id,
    name: row.name,
    type: (row.type as Investment['type']) || 'cdi_percent',
    cdiPercent: row.cdi_percent,
    contributions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

/** D1 batch aceita no máximo ~100 statements por chamada. */
export async function runBatches(db: D1Database, statements: D1PreparedStatement[], size = 80) {
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size));
  }
}
