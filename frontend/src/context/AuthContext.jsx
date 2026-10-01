import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null=checking, false=anon, obj=auth
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("secu_token");
    if (!token) { setUser(false); setReady(true); return; }
    api.me()
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem("secu_token"); setUser(false); })
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const r = await api.login(email, password);
    localStorage.setItem("secu_token", r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("secu_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
