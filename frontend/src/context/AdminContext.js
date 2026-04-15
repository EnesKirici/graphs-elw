"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AdminContext = createContext({ isAdmin: false, token: null });

export function AdminProvider({ children }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    const read = () => setToken(localStorage.getItem("admin_token"));
    read();
    window.addEventListener("storage", read);
    window.addEventListener("admin-auth-change", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("admin-auth-change", read);
    };
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin: !!token, token }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}

export function notifyAdminAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("admin-auth-change"));
  }
}
