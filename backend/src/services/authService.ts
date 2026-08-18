import type { Env } from '../env';
import { HttpError } from '../errors';
import type { UserProfile, UserRole } from '../models/schemas';
import { hashPassword, randomId, randomSaltHex, verifyPassword } from '../utils/crypto';
import { signJwt } from '../utils/jwt';
import { normalizeEmail } from '../utils/paths';
import { userFromRow, type UserRow } from '../db/mappers';
import { CategoryService } from './categoryService';

export class AuthService {
  constructor(private env: Env) {}

  private adminEmail(): string {
    return normalizeEmail(this.env.ADMIN_EMAIL || '');
  }

  private adminPassword(): string {
    return this.env.ADMIN_PASSWORD || '';
  }

  private matchesAdminEnvPassword(email: string, password: string): boolean {
    const adminEmail = this.adminEmail();
    const adminPassword = this.adminPassword();
    return Boolean(adminEmail && adminPassword && email === adminEmail && password === adminPassword);
  }

  private resolveRole(email: string, current?: UserRole): UserRole {
    if (this.adminEmail() && email === this.adminEmail()) return 'admin';
    return current ?? 'user';
  }

  async register(input: { name: string; email: string; password: string }) {
    const email = normalizeEmail(input.email);
    const existing = await this.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();
    if (existing) throw new HttpError(409, 'E-mail já cadastrado');

    const id = randomId();
    const salt = randomSaltHex();
    const passwordHash = await hashPassword(input.password, salt);
    const now = new Date().toISOString();
    const role = this.resolveRole(email);
    const profile: UserProfile = {
      id,
      name: input.name.trim(),
      email,
      passwordHash,
      salt,
      role,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.env.DB.prepare(
        `INSERT INTO users (id, name, email, password_hash, salt, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, profile.name, email, passwordHash, salt, role, now, now)
        .run();
    } catch {
      throw new HttpError(409, 'E-mail já cadastrado');
    }

    await new CategoryService(this.env).ensureDefaults(id);

    const token = await this.issueToken(profile);
    return { token, user: publicUser(profile) };
  }

  async login(input: { email: string; password: string }) {
    const email = normalizeEmail(input.email);
    const envAdminOk = this.matchesAdminEnvPassword(email, input.password);

    const row = await this.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<UserRow>();

    if (!row) {
      if (!envAdminOk) throw new HttpError(401, 'E-mail ou senha inválidos');
      return this.register({
        name: 'Administrador',
        email,
        password: input.password,
      });
    }

    let profile = userFromRow(row);

    if (envAdminOk) {
      const synced = await verifyPassword(input.password, profile.salt, profile.passwordHash);
      if (!synced) {
        const salt = randomSaltHex();
        const passwordHash = await hashPassword(input.password, salt);
        const updatedAt = new Date().toISOString();
        await this.env.DB.prepare(
          'UPDATE users SET salt = ?, password_hash = ?, updated_at = ? WHERE id = ?',
        )
          .bind(salt, passwordHash, updatedAt, profile.id)
          .run();
        profile = { ...profile, salt, passwordHash, updatedAt };
      }
    } else {
      const ok = await verifyPassword(input.password, profile.salt, profile.passwordHash);
      if (!ok) throw new HttpError(401, 'E-mail ou senha inválidos');
    }

    const role = this.resolveRole(profile.email, profile.role ?? 'user');
    if (profile.role !== role || !profile.role) {
      const updatedAt = new Date().toISOString();
      await this.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
        .bind(role, updatedAt, profile.id)
        .run();
      profile = { ...profile, role, updatedAt };
    }

    const token = await this.issueToken(profile);
    return { token, user: publicUser(profile) };
  }

  async getMe(userId: string) {
    return publicUser(await this.requireProfile(userId));
  }

  async getProfile(userId: string) {
    return this.requireProfile(userId);
  }

  async updateProfile(userId: string, input: { name?: string; email?: string }) {
    const profile = await this.requireProfile(userId);
    let next = { ...profile };

    if (input.name != null) {
      next.name = input.name.trim();
    }

    if (input.email != null) {
      const newEmail = normalizeEmail(input.email);
      if (newEmail !== profile.email) {
        const taken = await this.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
          .bind(newEmail, userId)
          .first();
        if (taken) throw new HttpError(409, 'E-mail já está em uso');
        next.email = newEmail;
        next.role = this.resolveRole(newEmail, next.role === 'admin' ? 'admin' : 'user');
      }
    }

    next.updatedAt = new Date().toISOString();
    await this.env.DB.prepare(
      'UPDATE users SET name = ?, email = ?, role = ?, updated_at = ? WHERE id = ?',
    )
      .bind(next.name, next.email, next.role, next.updatedAt, userId)
      .run();

    const token = await this.issueToken(next);
    return { token, user: publicUser(next) };
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
  ) {
    const profile = await this.requireProfile(userId);
    const ok = await verifyPassword(input.currentPassword, profile.salt, profile.passwordHash);
    if (!ok) throw new HttpError(400, 'Senha atual incorreta');

    const salt = randomSaltHex();
    const passwordHash = await hashPassword(input.newPassword, salt);
    const updatedAt = new Date().toISOString();
    await this.env.DB.prepare(
      'UPDATE users SET salt = ?, password_hash = ?, updated_at = ? WHERE id = ?',
    )
      .bind(salt, passwordHash, updatedAt, userId)
      .run();
    return { ok: true as const };
  }

  async listUsers() {
    const result = await this.env.DB.prepare(
      'SELECT * FROM users ORDER BY name COLLATE NOCASE ASC',
    ).all<UserRow>();
    return (result.results ?? []).map((row) => publicUser(this.withRole(userFromRow(row))));
  }

  async deleteUser(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new HttpError(400, 'Você não pode excluir a própria conta por aqui');
    }

    const target = await this.requireProfile(targetId);
    if (target.role === 'admin') {
      const admins = (await this.listUsers()).filter((u) => u.role === 'admin');
      if (admins.length <= 1) {
        throw new HttpError(400, 'Não é possível excluir o único administrador');
      }
    }

    await this.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
    return { ok: true as const };
  }

  private withRole(profile: UserProfile): UserProfile {
    return {
      ...profile,
      role: this.resolveRole(profile.email, profile.role ?? 'user'),
    };
  }

  private async requireProfile(userId: string): Promise<UserProfile> {
    const row = await this.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>();
    if (!row) throw new HttpError(404, 'Usuário não encontrado');
    return this.withRole(userFromRow(row));
  }

  private async issueToken(profile: UserProfile) {
    const secret = this.env.JWT_SECRET;
    if (!secret) throw new HttpError(500, 'JWT_SECRET não configurado');
    const normalized = this.withRole(profile);
    return signJwt(
      {
        sub: normalized.id,
        email: normalized.email,
        name: normalized.name,
        role: normalized.role,
      },
      secret,
    );
  }
}

function publicUser(profile: UserProfile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role ?? 'user',
    createdAt: profile.createdAt,
  };
}
