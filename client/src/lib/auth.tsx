import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./utils";

export type Role = "startup" | "mentor" | "investor" | "admin";
export type OnboardingStatus = "needs_role" | "needs_profile" | "complete";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  age: number;
  country: string;
  email: string;
  password: string;
  confirmPassword: string;
  captchaToken?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  country: string | null;
  avatarUrl: string | null;
  role: Role | null;
  onboardingStatus: OnboardingStatus;
  emailVerified: boolean;
  pendingEmail: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const u = await api<AuthUser>("/api/auth/me");
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    const u = await api<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(u);
  }

  async function register(input: RegisterInput) {
    const u = await api<AuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(u);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, refresh, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
