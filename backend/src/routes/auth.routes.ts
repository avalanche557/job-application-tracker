import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

router.post("/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  setAuthCookies(res, signAccessToken(user.id), signRefreshToken(user.id));
  res.status(201).json({ id: user.id, email: user.email });
});

router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  setAuthCookies(res, signAccessToken(user.id), signRefreshToken(user.id));
  res.json({ id: user.id, email: user.email });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    setAuthCookies(res, signAccessToken(payload.sub), signRefreshToken(payload.sub));
    res.status(204).send();
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(user);
});

export default router;
