import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "../../shared/types";
import { apiRequest } from "../api/http";

type SessionPayload = {
  accessToken: string;
  user: PublicUser;
};

type AuthContextValue = {
  user: PublicUser | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (username: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const refreshSession = useCallback(async () => {
    const response = await apiRequest<SessionPayload>("/api/auth/refresh", {
      method: "POST",
    });

    if (!response.success) {
      setAccessToken(null);
      setUser(null);
      return false;
    }

    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
    return true;
  }, []);

  useEffect(() => {
    void refreshSession().finally(() => setIsBootstrapping(false));
  }, [refreshSession]);

  useEffect(() => {
    if (!user) return;

    const refreshInterval = window.setInterval(() => {
      void refreshSession();
    }, 12 * 60 * 1000);

    return () => window.clearInterval(refreshInterval);
  }, [refreshSession, user]);

  async function login(email: string, password: string) {
    const response = await apiRequest<SessionPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!response.success) return response.message;

    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
    return null;
  }

  async function register(username: string, email: string, password: string) {
    const response = await apiRequest<SessionPayload>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.success) return response.message;

    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
    return null;
  }

  async function logout() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, accessToken, isBootstrapping, login, register, logout }),
    [user, accessToken, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
