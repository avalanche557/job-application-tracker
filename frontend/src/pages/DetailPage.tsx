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
    return <p className="text-sm text-gray-500">Loading…</p>;
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
      <Link to="/" className="text-sm text-gray-500 hover:underline">
        ← Back to applications
      </Link>

      {application.needsReview && (
        <div className="flex items-center justify-between rounded-md border border-purple-200 bg-purple-50 px-4 py-3">
          <p className="text-sm text-purple-800">
            This application was auto-detected from email and hasn't been reviewed yet.
          </p>
          <button
            onClick={() => updateMutation.mutate({ needsReview: false })}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Confirm
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Application details</h1>
          <StatusBadge status={application.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        {updateMutation.isError && <p className="text-sm text-red-600">Failed to save changes.</p>}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Status history</h2>
        <ol className="space-y-2">
          {application.statusHistory.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge status={entry.status} />
                <span className="text-gray-400">via {entry.source.toLowerCase()}</span>
              </div>
              <span className="text-gray-500">{new Date(entry.changedAt).toLocaleString()}</span>
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
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
