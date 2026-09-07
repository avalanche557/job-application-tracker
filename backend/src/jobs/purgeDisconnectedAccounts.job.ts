import cron from "node-cron";
import { purgeExpiredDisconnectedAccounts } from "../services/emailAccount.service.js";

export async function runPurgeDisconnectedAccounts() {
  const count = await purgeExpiredDisconnectedAccounts();
  if (count > 0) {
    console.log(`Purged ${count} email account(s) disconnected for over 3 days.`);
  }
}

export function schedulePurgeDisconnectedAccounts() {
  runPurgeDisconnectedAccounts().catch((err) => console.error("Purge disconnected accounts failed:", err));

  cron.schedule("0 3 * * *", () => {
    runPurgeDisconnectedAccounts().catch((err) => console.error("Purge disconnected accounts failed:", err));
  });
}
