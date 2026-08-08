import type { Env } from '../env';
import type { UserProfile, UserRole } from '../models/schemas';
import {
  deleteKey,
  getJson,
  HttpError,
  listAllKeys,
  putJson,
} from '../repositories/r2Json';
import { hashPassword, randomId, randomSaltHex, verifyPassword } from '../utils/crypto';
import { signJwt } from '../utils/jwt';
import {
  normalizeEmail,
  r2Prefix,
  userEmailKey,
  userPrefix,
  userProfileKey,
} from '../utils/paths';
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
    const prefix = r2Prefix(this.env);
    const emailKey = userEmailKey(prefix, email);

    const existing = await getJson<{ userId: string }>(this.env.APPLICATIONS, emailKey);
    if (existing) {
      throw new HttpError(409, 'E-mail já cadastrado');
    }

    const id = randomId();
    const salt = randomSaltHex();
    const passwordHash = await hashPassword(input.password, salt);
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id,
      name: input.name.trim(),
      email,
      passwordHash,
      salt,
      role: this.resolveRole(email),
      createdAt: now,
      updatedAt: now,
    };

    await putJson(this.env.APPLICATIONS, emailKey, { userId: id }, { onlyIfNoneMatch: true });
    await putJson(this.env.APPLICATIONS, userProfileKey(prefix, id), profile);
    await new CategoryService(this.env).ensureDefaults(id);

    const token = await this.issueToken(profile);
    return { token, user: publicUser(profile) };
  }

  async login(input: { email: string; password: string }) {
    const email = normalizeEmail(input.email);
    const prefix = r2Prefix(this.env);
    const envAdminOk = this.matchesAdminEnvPassword(email, input.password);

    const mapping = await getJson<{ userId: string }>(
      this.env.APPLICATIONS,
      userEmailKey(prefix, email),
    );

    // Bootstrap: cria o admin no primeiro login com ADMIN_EMAIL + ADMIN_PASSWORD
    if (!mapping) {
      if (!envAdminOk) throw new HttpError(401, 'E-mail ou senha inválidos');
      return this.register({
        name: 'Administrador',
        email,
        password: input.password,
      });
    }

    let profile = await getJson<UserProfile>(
      this.env.APPLICATIONS,
      userProfileKey(prefix, mapping.userId),
    );
    if (!profile) throw new HttpError(401, 'E-mail ou senha inválidos');

    if (envAdminOk) {
      // Mantém o hash do R2 alinhado com a senha do ambiente
      const synced = await verifyPassword(input.password, profile.salt, profile.passwordHash);
      if (!synced) {
        const salt = randomSaltHex();
        const passwordHash = await hashPassword(input.password, salt);
        profile = {
          ...profile,
          salt,
          passwordHash,
          updatedAt: new Date().toISOString(),
        };
        await putJson(this.env.APPLICATIONS, userProfileKey(prefix, profile.id), profile);
      }
    } else {
      const ok = await verifyPassword(input.password, profile.salt, profile.passwordHash);
      if (!ok) throw new HttpError(401, 'E-mail ou senha inválidos');
    }

    // Usuários antigos sem role + promoção via ADMIN_EMAIL
    const role = this.resolveRole(profile.email, profile.role ?? 'user');
    if (profile.role !== role || !profile.role) {
      profile = {
        ...profile,
        role,
        updatedAt: new Date().toISOString(),
      };
      await putJson(this.env.APPLICATIONS, userProfileKey(prefix, profile.id), profile);
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
    const prefix = r2Prefix(this.env);
    const profile = await this.requireProfile(userId);
    let next = { ...profile };

    if (input.name != null) {
      next.name = input.name.trim();
    }

    if (input.email != null) {
      const newEmail = normalizeEmail(input.email);
      if (newEmail !== profile.email) {
        const emailKey = userEmailKey(prefix, newEmail);
        const taken = await getJson<{ userId: string }>(this.env.APPLICATIONS, emailKey);
        if (taken && taken.userId !== userId) {
          throw new HttpError(409, 'E-mail já está em uso');
        }
        await deleteKey(this.env.APPLICATIONS, userEmailKey(prefix, profile.email));
        await putJson(this.env.APPLICATIONS, emailKey, { userId });
        next.email = newEmail;
        next.role = this.resolveRole(newEmail, next.role === 'admin' ? 'admin' : 'user');
      }
    }

    next.updatedAt = new Date().toISOString();
    await putJson(this.env.APPLICATIONS, userProfileKey(prefix, userId), next);
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
    const next: UserProfile = {
      ...profile,
      salt,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };
    await putJson(this.env.APPLICATIONS, userProfileKey(r2Prefix(this.env), userId), next);
    return { ok: true as const };
  }

  async listUsers() {
    const prefix = r2Prefix(this.env);
    const keys = await listAllKeys(this.env.APPLICATIONS, `${prefix}/users/`);
    const profileKeys = keys.filter((k) => k.endsWith('/profile.json'));
    const users = [];
    for (const key of profileKeys) {
      const profile = await getJson<UserProfile>(this.env.APPLICATIONS, key);
      if (profile) users.push(publicUser(this.withRole(profile)));
    }
    return users.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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

    const prefix = r2Prefix(this.env);
    await deleteKey(this.env.APPLICATIONS, userEmailKey(prefix, target.email));

    const userKeys = await listAllKeys(this.env.APPLICATIONS, userPrefix(prefix, targetId));
    for (const key of userKeys) {
      await deleteKey(this.env.APPLICATIONS, key);
    }

    return { ok: true as const };
  }

  private withRole(profile: UserProfile): UserProfile {
    return {
      ...profile,
      role: this.resolveRole(profile.email, profile.role ?? 'user'),
    };
  }

  private async requireProfile(userId: string): Promise<UserProfile> {
    const profile = await getJson<UserProfile>(
      this.env.APPLICATIONS,
      userProfileKey(r2Prefix(this.env), userId),
    );
    if (!profile) throw new HttpError(404, 'Usuário não encontrado');
    return this.withRole(profile);
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
