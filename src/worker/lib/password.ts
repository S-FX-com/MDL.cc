// MDL.cc - PBKDF2 password hashing (Cloudflare Workers compatible)

export async function hashPassword(
  password: string,
  saltPrefix: string
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomUUID();
  const fullSalt = saltPrefix + salt;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(fullSalt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return { hash, salt };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  saltPrefix: string
): Promise<boolean> {
  const fullSalt = saltPrefix + storedSalt;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(fullSalt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return hash === storedHash;
}
