import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GoogleLoginButton } from "./features/auth/GoogleLoginButton";
import { CalendarPage } from "./features/calendar/CalendarPage";

const queryClient = new QueryClient();

function AuthGate() {
  const { status, logout } = useAuth();

  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <GoogleLoginButton />;

  return (
    <div>
      <button onClick={() => void logout()}>Logout</button>
      <CalendarPage />
    </div>
  );
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
