import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";
import googleRoutes from "./routes/google.routes.js";
import emailAccountsRoutes from "./routes/emailAccounts.routes.js";
import { schedulePurgeDisconnectedAccounts } from "./jobs/purgeDisconnectedAccounts.job.js";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/auth", googleRoutes);
app.use("/applications", applicationsRoutes);
app.use("/email-accounts", emailAccountsRoutes);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

schedulePurgeDisconnectedAccounts();
