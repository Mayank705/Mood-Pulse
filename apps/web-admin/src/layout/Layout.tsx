import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ROLE_LABEL } from "../types";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  show: boolean;
}

export default function Layout() {
  const { user, can, signOut } = useAuth();
  if (!user) return null;

  const isManagerOnly = user.role === "MANAGER";

  const navItems: NavItem[] = [
    { to: "/overview", label: "Overview", icon: "📊", show: can("analytics:view_org") },
    { to: "/departments", label: "BUs", icon: "🏢", show: can("analytics:view_department") },
    { to: "/team", label: "My Team", icon: "🧑‍🤝‍🧑", show: isManagerOnly },
    { to: "/employees", label: "Employees", icon: "🗂️", show: can("employee:view_directory") },
    { to: "/organization", label: "Organization", icon: "🏗️", show: can("hierarchy:manage") },
    { to: "/trends", label: "Trends & Insights", icon: "📈", show: can("analytics:view_org") },
    { to: "/reports", label: "Reports", icon: "🧾", show: can("reports:export") },
    { to: "/settings", label: "Settings", icon: "⚙️", show: can("settings:manage") },
    { to: "/users", label: "Users & Roles", icon: "🔐", show: can("users:manage") },
    { to: "/audit-logs", label: "Audit Logs", icon: "🧭", show: can("audit:view") },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 shrink-0 bg-slate-950 text-slate-300 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">DP</div>
          <span className="font-semibold text-white">Daily Pulse</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-500/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-slate-500 mb-1">Signed in as</p>
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-slate-500 mb-3">{ROLE_LABEL[user.role]}</p>
          <button onClick={signOut} className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
