import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { load, save } from "./storage";

/* Session = { token, user } kept in localStorage under "cp-auth".
   Guests simply have no session - every public page works without one. */
const AUTH_KEY = "cp-auth";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => load(AUTH_KEY, null));

  const store = useCallback((s) => {
    setSession(s);
    try {
      if (s) save(AUTH_KEY, s);
      else localStorage.removeItem(AUTH_KEY);
    } catch {
      /* storage blocked - session lives in memory only */
    }
  }, []);

  // confirm a remembered session is still valid (token may have expired)
  useEffect(() => {
    if (!session?.token) return;
    api.me().then((user) => store({ ...session, user })).catch((e) => {
      if (e.status === 401) store(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const s = await api.login({ email, password });
    store(s);
    return s.user;
  };
  const signup = async (name, email, password) => {
    const s = await api.signup({ name, email, password });
    store(s);
    return s.user;
  };
  const logout = () => {
    // shared computer? don't leave the account's portfolio or chat behind
    try {
      localStorage.removeItem("cp-portfolio");
      sessionStorage.removeItem("cp-chat");
    } catch {
      /* storage blocked */
    }
    store(null);
  };

  return (
    <AuthContext.Provider value={{ user: session?.user || null, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext) || { user: null, login: async () => {}, signup: async () => {}, logout: () => {} };
}

export function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "U";
}
