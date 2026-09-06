import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { defineAbilityFor, type AppAbility, type UserRole } from './ability';
import { AbilityContext } from './ability';

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  provider: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  ability: AppAbility;
  isAuthenticated: boolean;
  isLoading: boolean;
  canEdit: boolean;
  canPublish: boolean;
  isAdmin: boolean;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  login: (username: string, password: string, provider?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (username: string, password: string) => Promise<boolean>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'openc4_auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const role = user?.role || null;
  const ability = useMemo(() => defineAbilityFor(role), [role]);

  const canEdit = ability.can('update', 'Workspace');
  const canPublish = ability.can('publish', 'Workspace');
  const isAdmin = ability.can('manage', 'all');

  // Authenticated fetch wrapper
  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const res = await fetch(input, {
        ...init,
        headers
      });

      if (res.status === 401) {
        // If unauthenticated, clear local token and trigger login modal
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setIsLoginModalOpen(true);
      }

      return res;
    },
    [token]
  );

  const login = useCallback(
    async (
      username: string,
      password: string,
      provider: string = 'local'
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, provider })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.message || 'Login failed' };
        }

        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        setIsLoginModalOpen(false);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsLoginModalOpen(true);
  }, []);

  const switchUser = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const result = await login(username, password);
      return result.success;
    },
    [login]
  );

  // Initialize and validate session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.user) {
              setUser(data.user);
              setToken(savedToken);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // fallback
        }
      }

      // If no valid saved session, automatically sign in with default admin account
      // so the studio works immediately out of the box with full capabilities
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            setToken(data.token);
            setUser(data.user);
          }
        }
      } catch {
        // ignore
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      role,
      ability,
      isAuthenticated: Boolean(user && token),
      isLoading,
      canEdit,
      canPublish,
      isAdmin,
      isLoginModalOpen,
      setIsLoginModalOpen,
      login,
      logout,
      switchUser,
      authFetch
    }),
    [
      user,
      token,
      role,
      ability,
      isLoading,
      canEdit,
      canPublish,
      isAdmin,
      isLoginModalOpen,
      login,
      logout,
      switchUser,
      authFetch
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
