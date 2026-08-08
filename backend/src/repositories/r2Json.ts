export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflito de versão — tente novamente') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export async function getJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return (await obj.json()) as T;
}

export async function putJson(
  bucket: R2Bucket,
  key: string,
  data: unknown,
  options?: { onlyIfNoneMatch?: boolean },
): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  if (options?.onlyIfNoneMatch) {
    const result = await bucket.put(key, body, {
      httpMetadata: { contentType: 'application/json' },
      onlyIf: { etagDoesNotMatch: '*' },
    });
    if (!result) {
      throw new ConflictError('Registro já existe');
    }
    return;
  }
  await bucket.put(key, body, {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function deleteKey(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export async function listAllKeys(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const obj of page.objects) {
      keys.push(obj.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

export async function listJsonUnderPrefix<T>(bucket: R2Bucket, prefix: string): Promise<T[]> {
  const keys = await listAllKeys(bucket, prefix);
  const items: T[] = [];
  for (const key of keys) {
    if (!key.endsWith('.json')) continue;
    const data = await getJson<T>(bucket, key);
    if (data) items.push(data);
  }
  return items;
}

/** Update com versionamento otimista. */
export async function updateWithVersion<T extends { version: number }>(
  bucket: R2Bucket,
  key: string,
  mutator: (current: T) => T,
): Promise<T> {
  const current = await getJson<T>(bucket, key);
  if (!current) throw new HttpError(404, 'Registro não encontrado');
  const next = mutator(current);
  if (next.version !== current.version + 1) {
    next.version = current.version + 1;
  }
  await putJson(bucket, key, next);
  return next;
}
