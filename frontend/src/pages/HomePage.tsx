import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ApplicationStatus, JobApplication } from "../lib/types";
import { StatusBadge } from "../components/StatusBadge";

type SortBy = "dateApplied" | "companyName" | "jobTitle" | "status";

const STATUS_OPTIONS: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"];

export function HomePage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("dateApplied");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (status) params.set("status", status);
  if (needsReviewOnly) params.set("needsReview", "true");
  params.set("sortBy", sortBy);
  params.set("order", order);

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["applications", debouncedSearch, status, needsReviewOnly, sortBy, order],
    queryFn: () => api.get<JobApplication[]>(`/applications?${params.toString()}`),
  });

  return (
    <div>
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Applications</h1>
          <p className="mt-1 font-mono text-[13px] text-ink-soft">
            {applications ? `${applications.length} tracked` : " "}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company…"
          className="input w-56 py-1.5"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}
          className="input w-auto py-1.5"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 font-mono text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={needsReviewOnly}
            onChange={(e) => setNeedsReviewOnly(e.target.checked)}
            className="rounded-sm border-line-strong text-ink accent-ink"
          />
          Needs review only
        </label>

        <div className="ml-auto flex items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="input w-auto py-1.5">
            <option value="dateApplied">Sort: Date applied</option>
            <option value="companyName">Sort: Company</option>
            <option value="jobTitle">Sort: Job title</option>
            <option value="status">Sort: Status</option>
          </select>
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="btn px-3 py-1.5"
            title="Toggle sort direction"
          >
            {order === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
      </div>

      {isLoading && <p className="font-mono text-[13px] text-ink-soft">Loading…</p>}
      {error && (
        <p className="rounded-[5px] border border-rust/40 bg-rust-soft px-3 py-2 text-sm text-rust-ink">
          Failed to load applications.
        </p>
      )}

      {applications && applications.length === 0 && (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm text-ink-soft">
            No applications yet. Once Gmail sync is connected, applications you apply to will show up here
            automatically.
          </p>
        </div>
      )}

      {applications && applications.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper-dim/60 text-left font-mono text-[11px] tracking-wider text-ink-soft uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Job title</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {applications.map((app) => (
                <tr key={app.id} className="transition-colors hover:bg-paper-dim/50">
                  <td className="px-5 py-3.5">
                    <Link to={`/applications/${app.id}`} className="font-medium text-ink hover:text-accent-ink">
                      {app.companyName}
                    </Link>
                    {app.needsReview && (
                      <span className="ml-2 inline-flex items-center rounded-[4px] border border-glow/40 bg-glow-soft px-2 py-0.5 font-mono text-[11px] text-glow-ink">
                        Needs review
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">{app.jobTitle}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink-soft">
                    {new Date(app.dateApplied).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
