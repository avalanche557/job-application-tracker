import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
} from "../services/jobApplication.service.js";

const router = Router();
router.use(requireAuth);

const statusEnum = z.enum(["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"]);

const listQuerySchema = z.object({
  q: z.string().min(1).optional(),
  status: statusEnum.optional(),
  needsReview: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sortBy: z.enum(["dateApplied", "updatedAt", "companyName", "jobTitle", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const result = await listApplications(req.userId!, parsed.data);
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const application = await getApplication(req.userId!, req.params.id);
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(application);
});

const updateBodySchema = z
  .object({
    companyName: z.string().min(1),
    jobTitle: z.string().min(1),
    status: statusEnum,
    dateApplied: z.coerce.date(),
    jobUrl: z.string().url().nullable(),
    location: z.string().nullable(),
    notes: z.string().nullable(),
    needsReview: z.boolean(),
  })
  .partial();

router.patch("/:id", async (req, res) => {
  const parsed = updateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const updated = await updateApplication(req.userId!, req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const deleted = await deleteApplication(req.userId!, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.status(204).send();
});

export default router;
