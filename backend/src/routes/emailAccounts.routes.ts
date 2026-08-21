import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listEmailAccounts, deleteEmailAccount } from "../services/emailAccount.service.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const accounts = await listEmailAccounts(req.userId!);
  res.json(accounts);
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
