"use client";

import { useSidebar } from "@/context/SidebarContext";

export default function MainContent({ children }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className="min-h-screen flex flex-col transition-all duration-300"
      style={{ paddingLeft: collapsed ? "68px" : "200px" }}
    >
      {children}
    </div>
  );
}
