export function r2Prefix(env: { R2_PREFIX: string }): string {
  return (env.R2_PREFIX || 'gerenciador_de_gastos').replace(/\/+$/, '');
}

export function userEmailKey(prefix: string, email: string): string {
  return `${prefix}/users/by-email/${normalizeEmail(email)}.json`;
}

export function userProfileKey(prefix: string, userId: string): string {
  return `${prefix}/users/${userId}/profile.json`;
}

export function userCategoriesKey(prefix: string, userId: string): string {
  return `${prefix}/users/${userId}/categories.json`;
}

export function expenseKey(prefix: string, userId: string, expenseId: string): string {
  return `${prefix}/users/${userId}/expenses/${expenseId}.json`;
}

export function expensePrefix(prefix: string, userId: string): string {
  return `${prefix}/users/${userId}/expenses/`;
}

export function investmentKey(prefix: string, userId: string, investmentId: string): string {
  return `${prefix}/users/${userId}/investments/${investmentId}.json`;
}

export function investmentPrefix(prefix: string, userId: string): string {
  return `${prefix}/users/${userId}/investments/`;
}

export function cdiCacheKey(prefix: string): string {
  return `${prefix}/market/cdi-daily.json`;
}

export function healthProbeKey(prefix: string): string {
  return `${prefix}/_system/health.json`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
