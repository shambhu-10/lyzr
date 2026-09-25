import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM with a server-only key. The key never leaves the server; the database only stores ciphertext. */
function key() {
  const k = Buffer.from(process.env.SECRETS_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("SECRETS_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

/** Used when a secret is injected into an app's runtime; never returned to the browser. */
export function decryptSecret(s: { ciphertext: string; iv: string; tag: string }) {
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(s.ciphertext, "base64")), d.final()]).toString("utf8");
}
