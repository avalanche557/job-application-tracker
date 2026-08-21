import type { User } from "../lib/types";

function getInitials(user: Pick<User, "name" | "email">): string {
  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return user.email[0]?.toUpperCase() ?? "?";
}

export function Avatar({ user, size = "md" }: { user: Pick<User, "name" | "email">; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-8 w-8 text-[11px]" : "h-14 w-14 text-lg";
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-ink font-mono font-semibold text-paper ${dimensions}`}
    >
      {getInitials(user)}
    </span>
  );
}
