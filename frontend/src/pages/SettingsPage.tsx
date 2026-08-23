import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api, API_URL } from "../lib/api";
import type { EmailAccount } from "../lib/types";

const GMAIL_STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Gmail connected.", tone: "success" },
  denied: { text: "Gmail connection was cancelled.", tone: "error" },
  error: { text: "Something went wrong connecting Gmail. Please try again.", tone: "error" },
};

type SyncSummary = {
  scanned: number;
  created: number;
  updated: number;
  skippedNotJobRelated: number;
  alreadyProcessed: number;
  failed: number;
  resolvedByRegex: number;
  resolvedByLlm: number;
  skippedQuotaExhausted: number;
  stoppedEarly: "quota_exceeded" | null;
};

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const gmailStatus = searchParams.get("gmail");
  const [syncSummaries, setSyncSummaries] = useState<Record<string, SyncSummary>>({});

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => api.get<EmailAccount[]>("/email-accounts"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-accounts"] }),
  });

  const syncMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api.post<SyncSummary>(`/email-accounts/${id}/sync${force ? "?force=true" : ""}`),
    onSuccess: (summary, { id }) => {
      setSyncSummaries((prev) => ({ ...prev, [id]: summary }));
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const statusMessage = gmailStatus ? GMAIL_STATUS_MESSAGES[gmailStatus] : null;

  function dismissStatus() {
    setSearchParams((params) => {
      params.delete("gmail");
      return params;
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>

      {statusMessage && (
        <div
          className={`flex items-center justify-between rounded-[6px] border px-5 py-3.5 text-sm ${
            statusMessage.tone === "success"
              ? "border-accent/40 bg-accent-soft text-accent-ink"
              : "border-rust/40 bg-rust-soft text-rust-ink"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={dismissStatus} className="font-mono text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="card p-7">
        <h2 className="mb-1 text-sm font-semibold text-ink">Connected email accounts</h2>
        <p className="mb-5 text-sm text-ink-soft">
          Connect Gmail to automatically detect job applications from your inbox.
        </p>

        {isLoading && <p className="font-mono text-[13px] text-ink-soft">Loading…</p>}

        {accounts && accounts.length === 0 && (
          <a href={`${API_URL}/auth/google`} className="btn btn-primary inline-flex px-5">
            Connect Gmail
          </a>
        )}

        {accounts && accounts.length > 0 && (
          <ul className="space-y-3">
            {accounts.map((account) => {
              const summary = syncSummaries[account.id];
              const isSyncingThis = syncMutation.isPending && syncMutation.variables?.id === account.id;
              return (
                <li key={account.id} className="rounded-[6px] border border-line px-5 py-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink">{account.email}</p>
                      <p className="mt-0.5 font-mono text-[12px] text-ink-soft">
                        {account.lastSyncedAt
                          ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}`
                          : "Not synced yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => syncMutation.mutate({ id: account.id })}
                        disabled={isSyncingThis}
                        className="btn px-3 py-1.5"
                      >
                        {isSyncingThis ? "Syncing…" : "Sync now"}
                      </button>
                      <button
                        onClick={() => syncMutation.mutate({ id: account.id, force: true })}
                        disabled={isSyncingThis}
                        title="Re-scan the last 3 weeks of email, including messages already processed"
                        className="btn px-3 py-1.5"
                      >
                        {isSyncingThis ? "Syncing…" : "Resync (3 weeks)"}
                      </button>
                      <button
                        onClick={() => disconnectMutation.mutate(account.id)}
                        disabled={disconnectMutation.isPending}
                        className="btn btn-danger px-3 py-1.5"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                  {summary && (
                    <>
                      <p className="mt-3 border-t border-line pt-3 font-mono text-[11.5px] text-ink-soft">
                        Scanned {summary.scanned} · {summary.created} new · {summary.updated} updated ·{" "}
                        {summary.skippedNotJobRelated} not job-related · {summary.alreadyProcessed} already seen
                        {summary.failed > 0 && ` · ${summary.failed} failed`}
                      </p>
                      <p className="mt-1 font-mono text-[11.5px] text-ink-soft">
                        {summary.resolvedByRegex} resolved by pattern match, {summary.resolvedByLlm} by AI
                      </p>
                      {summary.stoppedEarly === "quota_exceeded" && (
                        <p className="mt-1.5 font-mono text-[11.5px] text-glow-ink">
                          Gemini quota ran out partway through — {summary.skippedQuotaExhausted} email
                          {summary.skippedQuotaExhausted === 1 ? "" : "s"} that needed AI were skipped and will be
                          retried on the next sync.
                        </p>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
