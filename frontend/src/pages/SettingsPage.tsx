import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, API_URL } from "../lib/api";
import type { EmailAccount } from "../lib/types";

const GMAIL_STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Gmail connected.", tone: "success" },
  denied: { text: "Gmail connection was cancelled.", tone: "error" },
  error: { text: "Something went wrong connecting Gmail. Please try again.", tone: "error" },
};

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const gmailStatus = searchParams.get("gmail");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => api.get<EmailAccount[]>("/email-accounts"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-accounts"] }),
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
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{account.email}</p>
                  <p className="text-gray-500">
                    {account.lastSyncedAt
                      ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}`
                      : "Not synced yet"}
                  </p>
                </div>
                <button
                  onClick={() => disconnectMutation.mutate(account.id)}
                  disabled={disconnectMutation.isPending}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
