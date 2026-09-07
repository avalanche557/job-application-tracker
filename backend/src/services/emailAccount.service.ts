import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";

export function listEmailAccounts(userId: string) {
  return prisma.emailAccount.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      email: true,
      createdAt: true,
      lastSyncedAt: true,
      disconnectedAt: true,
    },
  });
}

export async function upsertGmailAccount(
  userId: string,
  data: { email: string; refreshToken: string | null | undefined; scope: string; expiryDate: Date | null },
) {
  if (!data.refreshToken) {
    // Google only returns a refresh_token on first consent (or when prompt=consent forces
    // re-issue); if this ever fires it means neither happened, so there's nothing to persist.
    throw new Error("Google did not return a refresh token");
  }

  return prisma.emailAccount.upsert({
    where: { userId_provider_email: { userId, provider: "GMAIL", email: data.email } },
    create: {
      userId,
      provider: "GMAIL",
      email: data.email,
      encryptedRefreshToken: encrypt(data.refreshToken),
      scope: data.scope,
      expiryDate: data.expiryDate,
    },
    update: {
      encryptedRefreshToken: encrypt(data.refreshToken),
      scope: data.scope,
      expiryDate: data.expiryDate,
      disconnectedAt: null,
    },
  });
}

export async function getEmailAccountWithDecryptedToken(userId: string, id: string) {
  const account = await prisma.emailAccount.findFirst({ where: { id, userId } });
  if (!account) return null;
  return { ...account, refreshToken: decrypt(account.encryptedRefreshToken) };
}

export function touchLastSynced(id: string) {
  return prisma.emailAccount.update({ where: { id }, data: { lastSyncedAt: new Date() } });
}

const DISCONNECT_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

export async function deleteEmailAccount(userId: string, id: string) {
  const existing = await prisma.emailAccount.findFirst({ where: { id, userId } });
  if (!existing) return false;

  // Soft-disconnect: keep the row (and its RawEmail sync history / lastSyncedAt
  // cursor) around so a reconnect within the grace period can resume
  // incrementally instead of re-scanning from scratch.
  await prisma.emailAccount.update({ where: { id }, data: { disconnectedAt: new Date() } });
  return true;
}

export async function purgeExpiredDisconnectedAccounts() {
  const cutoff = new Date(Date.now() - DISCONNECT_GRACE_PERIOD_MS);
  const { count } = await prisma.emailAccount.deleteMany({
    where: { disconnectedAt: { lte: cutoff } },
  });
  return count;
}
