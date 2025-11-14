import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sessionId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for existing session on mount
    const storedSessionId = localStorage.getItem("sessionId");
    if (storedSessionId) {
      setSessionId(storedSessionId);
      fetchCurrentUser(storedSessionId);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function fetchCurrentUser(session: string) {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${session}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Session invalid, clear it
        localStorage.removeItem("sessionId");
        setSessionId(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao fazer login");
    }

    const data = await response.json();
    setUser(data.user);
    setSessionId(data.sessionId);
    localStorage.setItem("sessionId", data.sessionId);
  }

  async function register(fullName: string, email: string, password: string) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao criar conta");
    }

    const data = await response.json();
    setUser(data.user);
    setSessionId(data.sessionId);
    localStorage.setItem("sessionId", data.sessionId);
  }

  async function logout() {
    if (sessionId) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionId}`,
        },
      });
    }

    setUser(null);
    setSessionId(null);
    localStorage.removeItem("sessionId");
    setLocation("/");
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, sessionId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Hook to protect routes
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  return { user, isLoading };
}
