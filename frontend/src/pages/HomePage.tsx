import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ApplicationStatus, JobApplication } from "../lib/types";
import { StatusBadge } from "../components/StatusBadge";

type SortBy = "dateApplied" | "updatedAt" | "companyName" | "jobTitle" | "status";

type ApplicationsPage = {
  applications: JobApplication[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_OPTIONS: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"];
const PAGE_SIZE = 20;

export function HomePage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, needsReviewOnly, sortBy, order]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (status) params.set("status", status);
  if (needsReviewOnly) params.set("needsReview", "true");
  params.set("sortBy", sortBy);
  params.set("order", order);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", debouncedSearch, status, needsReviewOnly, sortBy, order, page],
    queryFn: () => api.get<ApplicationsPage>(`/applications?${params.toString()}`),
  });

  const applications = data?.applications;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Applications</h1>
          <p className="mt-1 font-mono text-[13px] text-ink-soft">
            {data ? `${data.total} tracked` : " "}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company…"
          className="input py-1.5 sm:w-56"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}
          className="input py-1.5 sm:w-auto"
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

        <div className="flex items-center gap-2 sm:ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="input flex-1 py-1.5 sm:w-auto sm:flex-none"
          >
            <option value="updatedAt">Sort: Last updated</option>
            <option value="dateApplied">Sort: Date applied</option>
            <option value="companyName">Sort: Company</option>
            <option value="jobTitle">Sort: Job title</option>
            <option value="status">Sort: Status</option>
          </select>
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="btn shrink-0 px-3 py-1.5"
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
        <>
          {/* Narrow viewports: stacked cards instead of a table that can't fit four columns. */}
          <div className="grid gap-3 sm:hidden">
            {applications.map((app) => (
              <Link
                key={app.id}
                to={`/applications/${app.id}`}
                className="card block px-4 py-3.5 transition-colors hover:bg-paper-dim/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{app.companyName}</p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">{app.jobTitle}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-ink-soft">
                  <span>{new Date(app.dateApplied).toLocaleDateString()}</span>
                  {app.needsReview && (
                    <span className="inline-flex items-center rounded-[4px] border border-glow/40 bg-glow-soft px-2 py-0.5 text-glow-ink">
                      Needs review
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Wider viewports: the full table. */}
          <div className="card hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[560px] text-sm">
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

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between font-mono text-[13px] text-ink-soft">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
