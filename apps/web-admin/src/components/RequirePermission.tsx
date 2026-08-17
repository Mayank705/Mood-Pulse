import { Permission, useAuth } from "../auth/AuthProvider";

/**
 * UI-level gating only, for a clean experience — every endpoint this page
 * calls independently enforces the same permission server-side, so this is
 * not the security boundary, just a courtesy so a role without access
 * doesn't see a broken/empty page.
 */
export default function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-10 text-center">
        <p className="text-3xl mb-2">🔒</p>
        <p className="text-slate-500 text-sm">You don't have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}
