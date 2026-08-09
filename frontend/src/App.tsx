import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GoogleLoginButton } from "./features/auth/GoogleLoginButton";

const queryClient = new QueryClient();

function AuthGate() {
  const { status, user, logout } = useAuth();

  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <GoogleLoginButton />;

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={() => void logout()}>Logout</button>
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
