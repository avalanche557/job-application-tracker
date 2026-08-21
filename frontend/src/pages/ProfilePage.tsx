import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { User } from "../lib/types";
import { Avatar } from "../components/Avatar";

type ProfileInput = { name: string; phone: string; location: string };

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileInput>({ name: "", phone: "", location: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name ?? "", phone: user.phone ?? "", location: user.location ?? "" });
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      api.patch<User>("/auth/me", {
        name: input.name.trim() || null,
        phone: input.phone.trim() || null,
        location: input.location.trim() || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      setSaved(true);
    },
  });

  if (!user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    updateMutation.mutate(form);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile</h1>

      <div className="card p-7">
        <div className="mb-6 flex items-center gap-4">
          <Avatar user={user} />
          <div>
            <p className="font-medium text-ink">{user.name || "No name set"}</p>
            <p className="font-mono text-[12.5px] text-ink-soft">{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {updateMutation.error instanceof ApiError && (
            <p className="rounded-[5px] border border-rust/40 bg-rust-soft px-3 py-2 text-sm text-rust-ink">
              {updateMutation.error.message}
            </p>
          )}
          {saved && !updateMutation.isPending && (
            <p className="rounded-[5px] border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent-ink">
              Profile updated.
            </p>
          )}

          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="Add your name"
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input"
              placeholder="Add a phone number"
            />
          </div>

          <div>
            <label className="label" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="input"
              placeholder="City, country"
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" value={user.email} disabled className="input opacity-60" />
          </div>

          <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary w-full">
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
