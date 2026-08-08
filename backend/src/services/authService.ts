import type { Env } from '../env';
import type { UserProfile } from '../models/schemas';
import { getJson, putJson } from '../repositories/r2Json';
import { hashPassword, randomId, randomSaltHex, verifyPassword } from '../utils/crypto';
import { signJwt } from '../utils/jwt';
import {
  normalizeEmail,
  r2Prefix,
  userEmailKey,
  userProfileKey,
} from '../utils/paths';
import { HttpError } from '../repositories/r2Json';
import { CategoryService } from './categoryService';

export class AuthService {
  constructor(private env: Env) {}

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
    const profile: UserProfile = {
      id,
      name: input.name.trim(),
      email,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
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
    const mapping = await getJson<{ userId: string }>(
      this.env.APPLICATIONS,
      userEmailKey(prefix, email),
    );
    if (!mapping) throw new HttpError(401, 'E-mail ou senha inválidos');

    const profile = await getJson<UserProfile>(
      this.env.APPLICATIONS,
      userProfileKey(prefix, mapping.userId),
    );
    if (!profile) throw new HttpError(401, 'E-mail ou senha inválidos');

    const ok = await verifyPassword(input.password, profile.salt, profile.passwordHash);
    if (!ok) throw new HttpError(401, 'E-mail ou senha inválidos');

    const token = await this.issueToken(profile);
    return { token, user: publicUser(profile) };
  }

  async getMe(userId: string) {
    const profile = await getJson<UserProfile>(
      this.env.APPLICATIONS,
      userProfileKey(r2Prefix(this.env), userId),
    );
    if (!profile) throw new HttpError(404, 'Usuário não encontrado');
    return publicUser(profile);
  }

  private async issueToken(profile: UserProfile) {
    const secret = this.env.JWT_SECRET;
    if (!secret) throw new HttpError(500, 'JWT_SECRET não configurado');
    return signJwt({ sub: profile.id, email: profile.email, name: profile.name }, secret);
  }
}

function publicUser(profile: UserProfile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    createdAt: profile.createdAt,
  };
}
