import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.me();
        if (alive) setUser(data.user || data);
      } catch {
        try {
          const data = await api.refreshSession();
          if (alive) setUser(data.user || data);
        } catch {
          if (alive) setUser(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const doLogin = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const doLogout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === 'superadmin') return true;
      if (user.role === 'admin') return perm !== 'audit.view';
      if (user.role === 'subadmin') return Array.isArray(user.permissions) && user.permissions.includes(perm);
      return false;
    },
    [user]
  );

  const value = {
    user,
    loading,
    login: doLogin,
    logout: doLogout,
    setUser,
    hasPermission,
    isAdmin: user && ['superadmin', 'admin', 'subadmin'].includes(user.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
