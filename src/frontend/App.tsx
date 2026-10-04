import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthScreen } from "./components/AuthScreen";
import { ChatDashboard } from "./components/ChatDashboard";
import { SocketProvider } from "./socket/SocketContext";
import { LoaderCircle } from "lucide-react";

function ApplicationBody() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="boot-screen"><LoaderCircle className="spin" size={30} /><span>Restoring secure session…</span></div>;
  }

  if (!user) return <AuthScreen />;

  return (
    <SocketProvider>
      <ChatDashboard />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ApplicationBody />
    </AuthProvider>
  );
}
