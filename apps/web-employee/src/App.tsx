import { AuthProvider, authMode, useAuth } from "./auth/AuthProvider";
import DevSignInScreen from "./components/DevSignInScreen";
import CheckIn from "./pages/CheckIn";

function Gate() {
  const { status, error } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  if (status === "signed-out") {
    if (authMode === "dev") return <DevSignInScreen />;
    return null; // Entra ID redirect/popup flow is in progress
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-600">{error ?? "We couldn't verify your account. Please contact IT support."}</p>
        </div>
      </div>
    );
  }

  return <CheckIn />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
