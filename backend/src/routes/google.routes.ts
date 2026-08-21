import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { signOAuthState, verifyOAuthState } from "../lib/jwt.js";
import { generateGoogleAuthUrl, exchangeCodeForTokens } from "../lib/googleOAuth.js";
import { upsertGmailAccount } from "../services/emailAccount.service.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

router.get("/google", requireAuth, (req, res) => {
  const state = signOAuthState(req.userId!);
  res.redirect(generateGoogleAuthUrl(state));
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`${FRONTEND_URL}/settings?gmail=denied`);
    return;
  }

  if (typeof code !== "string" || typeof state !== "string") {
    res.status(400).json({ error: "Missing code or state" });
    return;
  }

  let userId: string;
  try {
    userId = verifyOAuthState(state).sub;
  } catch {
    res.status(401).json({ error: "Invalid or expired OAuth state" });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await upsertGmailAccount(userId, tokens);
    res.redirect(`${FRONTEND_URL}/settings?gmail=connected`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.redirect(`${FRONTEND_URL}/settings?gmail=error`);
  }
});

export default router;
