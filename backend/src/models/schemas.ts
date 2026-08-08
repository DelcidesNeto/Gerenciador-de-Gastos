import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

export const expenseSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1).max(80),
  paymentMethod: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const expenseUpdateSchema = expenseSchema.partial();

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const categoryRenameSchema = z.object({
  from: z.string().trim().min(1).max(80),
  to: z.string().trim().min(1).max(80),
});

export const categoryDeleteSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const categoriesReplaceSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
});

export const investmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cdiPercent: z.number().positive().max(500),
  contributions: z
    .array(
      z.object({
        amount: z.number().positive(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .optional()
    .default([]),
});

export const investmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  cdiPercent: z.number().positive().max(500).optional(),
});

export const contributionSchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const simulateWithdrawalSchema = z.object({
  contributionId: z.string().uuid(),
  redemptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export type UserRole = 'admin' | 'user';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type Contribution = {
  id: string;
  amount: number;
  date: string;
  createdAt: string;
};

export type Investment = {
  id: string;
  name: string;
  type: 'cdi_percent';
  cdiPercent: number;
  contributions: Contribution[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CategoriesFile = {
  categories: string[];
  updatedAt: string;
  version: number;
};

export type CdiDailyRate = {
  date: string;
  /** Taxa DI diária em decimal (ex.: 0.00043082). */
  rate: number;
};

export type CdiCacheFile = {
  source: string;
  seriesCode: string;
  updatedAt: string;
  rates: CdiDailyRate[];
};

export const DEFAULT_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Contas',
  'Lazer',
  'Saúde',
  'Educação',
  'Compras',
  'Investimentos',
  'Outros',
] as const;
