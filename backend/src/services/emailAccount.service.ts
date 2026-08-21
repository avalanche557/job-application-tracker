import { prisma } from "../lib/prisma.js";
import { encrypt } from "../lib/crypto.js";

export function listEmailAccounts(userId: string) {
  return prisma.emailAccount.findMany({
    where: { userId },
    select: { id: true, provider: true, email: true, createdAt: true, lastSyncedAt: true },
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
    },
  });
}

export async function deleteEmailAccount(userId: string, id: string) {
  const existing = await prisma.emailAccount.findFirst({ where: { id, userId } });
  if (!existing) return false;

  await prisma.emailAccount.delete({ where: { id } });
  return true;
}
