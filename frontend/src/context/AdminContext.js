"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AdminContext = createContext({ isAdmin: false, token: null });

export function AdminProvider({ children }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    const read = () => {
      const t = localStorage.getItem("admin_token");
      setToken(t);
      // Admin cihazı Rybbit'e de görünmesin — script bu anahtara bakar
      // (bir sonraki sayfa yüklemesinden itibaren geçerli, kalıcı).
      if (t) {
        try { localStorage.setItem("disable-rybbit", "1"); } catch {}
      }
      // Admin mini-bar görünürlüğü CSS'te html.is-admin ile — login/logout'ta
      // sayfa yenilenmeden senkron kalsın (ilk yükleme: layout'taki paint-öncesi script).
      try {
        document.documentElement.classList.toggle("is-admin", !!t);
      } catch {}
    };
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
