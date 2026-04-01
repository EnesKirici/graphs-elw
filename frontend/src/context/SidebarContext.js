"use client";

import { createContext, useContext, useState, useEffect } from "react";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  // null = henüz okunmadı (SSR veya hydration öncesi)
  const [collapsed, setCollapsed] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    setCollapsed(saved === "true");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", !prev);
      return !prev;
    });
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, ready: collapsed !== null }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
