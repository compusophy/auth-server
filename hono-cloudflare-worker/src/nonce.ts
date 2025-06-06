export async function generateNonce(): Promise<string> {
  // Generate a nonce with 128 bits of entropy (16 bytes)
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);

  const nonce = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return nonce;
}

export async function storeNonce(env: Cloudflare.Env, nonce: string): Promise<void> {
  const nonceId = env.NONCE.idFromName(nonce);
  const nonceObject = env.NONCE.get(nonceId);

  // optimistically assume the nonce will get persisted
  await nonceObject.initialize();

}

export async function consumeNonce(env: Cloudflare.Env, nonce: string): Promise<boolean> {
  const nonceId = env.NONCE.idFromName(nonce);
  const nonceObject = env.NONCE.get(nonceId);

  return await nonceObject.consume();
}
