import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../api/endpoints';

const AuthContext = createContext(null);

const USER_KEY = 'rcld_user';
function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function storeUser(u) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u) => {
    setUserState(u);
    storeUser(u);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.me();
        if (alive) setUser(data.user || data);
      } catch (e) {
        const status = e?.response?.status;
        try {
          const data = await api.refreshSession();
          if (alive) setUser(data.user || data);
        } catch (e2) {
          const status2 = e2?.response?.status;
          const authFailed = [401, 403].includes(status) || [401, 403].includes(status2);
          if (alive && authFailed) setUser(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [setUser]);

  const doLogin = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data.user;
  }, [setUser]);

  const doLogout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, [setUser]);

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
