import { apiRequest } from './apiClient';

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
};

export type Performance = {
  principal: number;
  startDate: string;
  asOfDate: string;
  daysHeld: number;
  cdiPercent: number;
  grossYield: number;
  iof: number;
  iofRate: number;
  incomeTax: number;
  incomeTaxRate: number;
  netYield: number;
  currentValue: number;
  netRedemptionValue: number;
  projectedBusinessDays?: number;
  lastKnownCdiDate?: string | null;
};

export type SummaryTotals = {
  totalInvested: number;
  grossYield: number;
  iof: number;
  incomeTax: number;
  taxes: number;
  netYield: number;
  currentValue: number;
  netRedemptionValue: number;
  contributionsCount: number;
};

export async function listInvestments() {
  return apiRequest<{ items: Investment[] }>('/investments');
}

export async function createInvestment(input: {
  name: string;
  cdiPercent: number;
  contributions?: Array<{ amount: number; date: string }>;
}) {
  return apiRequest<{ item: Investment }>('/investments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateInvestment(id: string, input: { name?: string; cdiPercent?: number }) {
  return apiRequest<{ item: Investment }>(`/investments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteInvestment(id: string) {
  return apiRequest<{ ok: boolean }>(`/investments/${id}`, { method: 'DELETE' });
}

export async function addContribution(id: string, input: { amount: number; date: string }) {
  return apiRequest<{ item: Investment }>(`/investments/${id}/contributions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateContribution(
  id: string,
  contributionId: string,
  input: { amount: number; date: string },
) {
  return apiRequest<{ item: Investment }>(
    `/investments/${id}/contributions/${contributionId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export async function removeContribution(id: string, contributionId: string) {
  return apiRequest<{ item: Investment }>(
    `/investments/${id}/contributions/${contributionId}`,
    { method: 'DELETE' },
  );
}

export async function investmentPerformance(id: string, asOf?: string) {
  const q = asOf ? `?asOf=${asOf}` : '';
  return apiRequest<{
    investment: { id: string; name: string; cdiPercent: number; type: string };
    asOfDate: string;
    contributions: Array<Contribution & { performance: Performance }>;
    summary: SummaryTotals;
  }>(`/investments/${id}/performance${q}`);
}

export async function investmentsSummary(asOf?: string) {
  const q = asOf ? `?asOf=${asOf}` : '';
  return apiRequest<{
    asOfDate: string;
    investments: Array<{ id: string; name: string; cdiPercent: number; summary: SummaryTotals }>;
    summary: SummaryTotals;
  }>(`/investments/summary${q}`);
}

export async function simulateWithdrawal(
  id: string,
  input: { contributionId: string; redemptionDate: string },
) {
  return apiRequest<{
    investmentId: string;
    contribution: Contribution;
    redemptionDate: string;
    investedAmount: number;
    grossYield: number;
    iof: number;
    incomeTax: number;
    netYield: number;
    netRedemptionValue: number;
    daysHeld: number;
    iofRate: number;
    incomeTaxRate: number;
    projectedBusinessDays: number;
    lastKnownCdiDate: string | null;
  }>(`/investments/${id}/simulate-withdrawal`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCdiStatus() {
  return apiRequest<{
    source: string;
    seriesCode: string;
    updatedAt: string;
    ratesCount: number;
    lastRate: { date: string; rate: number } | null;
  }>('/market/cdi');
}
