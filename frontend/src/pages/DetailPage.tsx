import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { ApplicationStatus, JobApplicationDetail } from "../lib/types";
import { StatusBadge } from "../components/StatusBadge";

const STATUS_OPTIONS: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"];

type FormState = {
  companyName: string;
  jobTitle: string;
  status: ApplicationStatus;
  dateApplied: string;
  jobUrl: string;
  location: string;
  notes: string;
};

function toFormState(app: JobApplicationDetail): FormState {
  return {
    companyName: app.companyName,
    jobTitle: app.jobTitle,
    status: app.status,
    dateApplied: app.dateApplied.slice(0, 10),
    jobUrl: app.jobUrl ?? "",
    location: app.location ?? "",
    notes: app.notes ?? "",
  };
}

export function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const { data: application, isLoading } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => api.get<JobApplicationDetail>(`/applications/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (application) setForm(toFormState(application));
  }, [application]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FormState> & { needsReview?: boolean }) =>
      api.patch<JobApplicationDetail>(`/applications/${id}`, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["applications", id], updated);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/applications/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["applications", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      navigate("/");
    },
  });

  if (isLoading || !application || !form) {
    return <p className="font-mono text-[13px] text-ink-soft">Loading…</p>;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateMutation.mutate({
      ...form,
      jobUrl: form.jobUrl || null,
      location: form.location || null,
      notes: form.notes || null,
    } as never);
  }

  function handleDelete() {
    if (confirm(`Delete the application to ${application?.companyName}? This can't be undone.`)) {
      deleteMutation.mutate();
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 font-mono text-[13px] text-ink-soft hover:text-ink">
        ← Back to applications
      </Link>

      {application.needsReview && (
        <div className="flex items-center justify-between rounded-[6px] border border-glow/40 bg-glow-soft px-5 py-3.5">
          <p className="text-sm text-glow-ink">
            This application was auto-detected from email and hasn't been reviewed yet.
          </p>
          <button
            onClick={() => updateMutation.mutate({ needsReview: false })}
            className="btn border-glow/50 bg-paper px-3 py-1.5 text-glow-ink hover:border-glow hover:bg-paper"
          >
            Confirm
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Application details</h1>
          <StatusBadge status={application.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Company">
            <input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Job title">
            <input
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })}
              className="input"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date applied">
            <input
              type="date"
              value={form.dateApplied}
              onChange={(e) => setForm({ ...form, dateApplied: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Job URL">
            <input
              value={form.jobUrl}
              onChange={(e) => setForm({ ...form, jobUrl: e.target.value })}
              className="input"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            className="input"
          />
        </Field>

        {updateMutation.isError && (
          <p className="rounded-[5px] border border-rust/40 bg-rust-soft px-3 py-2 text-sm text-rust-ink">
            Failed to save changes.
          </p>
        )}

        <div className="flex items-center justify-between border-t border-line pt-5">
          <button type="button" onClick={handleDelete} className="btn btn-danger">
            Delete
          </button>
          <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary px-5">
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="card p-7">
        <h2 className="label mb-5">Status history</h2>
        <ol className="relative space-y-6 border-l border-line pl-6">
          {application.statusHistory.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute top-1 -left-[27px] h-2.5 w-2.5 rounded-full border-2 border-paper bg-ink ring-1 ring-line-strong" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <span className="font-mono text-[11px] text-ink-soft">via {entry.source.toLowerCase()}</span>
                </div>
                <span className="font-mono text-[12px] text-ink-soft">{new Date(entry.changedAt).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
