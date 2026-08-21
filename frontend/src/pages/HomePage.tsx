import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import type { ApplicationStatus, JobApplication } from "../lib/types";
import { StatusBadge } from "../components/StatusBadge";

type SortBy = "dateApplied" | "companyName" | "jobTitle" | "status";

const STATUS_OPTIONS: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"];

export function HomePage() {
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("dateApplied");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (needsReviewOnly) params.set("needsReview", "true");
  params.set("sortBy", sortBy);
  params.set("order", order);

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["applications", status, needsReviewOnly, sortBy, order],
    queryFn: () => api.get<JobApplication[]>(`/applications?${params.toString()}`),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={needsReviewOnly}
            onChange={(e) => setNeedsReviewOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Needs review only
        </label>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="dateApplied">Sort: Date applied</option>
            <option value="companyName">Sort: Company</option>
            <option value="jobTitle">Sort: Job title</option>
            <option value="status">Sort: Status</option>
          </select>
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            title="Toggle sort direction"
          >
            {order === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load applications.</p>}

      {applications && applications.length === 0 && (
        <p className="text-sm text-gray-500">
          No applications yet. Once Gmail sync is connected, applications you apply to will show up here automatically.
        </p>
      )}

      {applications && applications.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Job title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/applications/${app.id}`} className="font-medium text-gray-900 hover:underline">
                      {app.companyName}
                    </Link>
                    {app.needsReview && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                        Needs review
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{app.jobTitle}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(app.dateApplied).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
