export type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  CORS_ORIGINS: string;
  /** E-mail que recebe papel de administrador ao cadastrar/entrar. */
  ADMIN_EMAIL?: string;
  /** Senha do admin definida no ambiente (bootstrap + login). Preferir secret no Cloudflare. */
  ADMIN_PASSWORD?: string;
};

export type AppVariables = {
  userId: string;
  userEmail: string;
  userRole: 'admin' | 'user';
};
