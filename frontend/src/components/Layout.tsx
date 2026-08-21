import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink font-mono text-[11px] font-semibold tracking-wide text-paper">
              JT
            </span>
            <span className="font-mono text-sm font-medium text-ink">Job Tracker</span>
          </Link>
          {user && (
            <nav className="flex items-center gap-6">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `font-mono text-[13px] transition-colors ${isActive ? "text-ink" : "text-ink-soft hover:text-ink"}`
                }
              >
                Applications
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `font-mono text-[13px] transition-colors ${isActive ? "text-ink" : "text-ink-soft hover:text-ink"}`
                }
              >
                Settings
              </NavLink>
              <span className="hidden font-mono text-[12px] text-ink-soft sm:inline">{user.email}</span>
              <button
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                className="btn px-3 py-1.5"
              >
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
