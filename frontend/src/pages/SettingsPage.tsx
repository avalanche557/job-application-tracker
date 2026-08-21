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
    mutationFn: (id: string) => api.post<SyncSummary>(`/email-accounts/${id}/sync`),
    onSuccess: (summary, id) => {
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
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>

      {statusMessage && (
        <div
          className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${
            statusMessage.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={dismissStatus} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Connected email accounts</h2>
        <p className="mb-4 text-sm text-gray-500">
          Connect Gmail to automatically detect job applications from your inbox.
        </p>

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

        {accounts && accounts.length === 0 && (
          <a
            href={`${API_URL}/auth/google`}
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Connect Gmail
          </a>
        )}

        {accounts && accounts.length > 0 && (
          <ul className="space-y-3">
            {accounts.map((account) => {
              const summary = syncSummaries[account.id];
              const isSyncingThis = syncMutation.isPending && syncMutation.variables === account.id;
              return (
                <li key={account.id} className="rounded-md border border-gray-200 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{account.email}</p>
                      <p className="text-gray-500">
                        {account.lastSyncedAt
                          ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}`
                          : "Not synced yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => syncMutation.mutate(account.id)}
                        disabled={isSyncingThis}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
                      >
                        {isSyncingThis ? "Syncing…" : "Sync now"}
                      </button>
                      <button
                        onClick={() => disconnectMutation.mutate(account.id)}
                        disabled={disconnectMutation.isPending}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                  {summary && (
                    <>
                      <p className="mt-2 text-xs text-gray-500">
                        Scanned {summary.scanned} · {summary.created} new · {summary.updated} updated ·{" "}
                        {summary.skippedNotJobRelated} not job-related · {summary.alreadyProcessed} already seen
                        {summary.failed > 0 && ` · ${summary.failed} failed`}
                      </p>
                      {summary.stoppedEarly === "quota_exceeded" && (
                        <p className="mt-1 text-xs text-amber-700">
                          Stopped early: the Gemini API quota was exhausted. Try again later, or fewer emails at a
                          time.
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
