import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listEmailAccounts, deleteEmailAccount } from "../services/emailAccount.service.js";
import { syncEmailAccount } from "../services/emailSync.service.js";
import { GmailAuthExpiredError } from "../lib/gmailClient.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const accounts = await listEmailAccounts(req.userId!);
  res.json(accounts);
});

router.post("/:id/sync", async (req, res) => {
  try {
    const force = req.query.force === "true";
    const summary = await syncEmailAccount(req.userId!, req.params.id, { force });
    res.json(summary);
  } catch (err) {
    if (err instanceof Error && err.message === "Email account not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof GmailAuthExpiredError) {
      res.status(409).json({ error: "Gmail connection expired. Please disconnect and reconnect this account." });
      return;
    }
    console.error("Email sync failed:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await deleteEmailAccount(req.userId!, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Email account not found" });
    return;
  }
  res.status(204).send();
});

export default router;
