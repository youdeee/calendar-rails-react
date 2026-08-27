import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GoogleLoginButton } from "./features/auth/GoogleLoginButton";
import { CalendarPage } from "./features/calendar/CalendarPage";

const queryClient = new QueryClient();

function AuthGate() {
  const { status } = useAuth();

  if (status === "loading") return <div className="p-4">Loading...</div>;
  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <GoogleLoginButton />
      </div>
    );
  }

  return <CalendarPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
