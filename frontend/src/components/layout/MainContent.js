"use client";

import { useSidebar } from "@/context/SidebarContext";

export default function MainContent({ children }) {
  const { collapsed, ready } = useSidebar();

  // Hydration öncesi: sidebar state bilinmiyor → gizle (flash önle)
  if (!ready) {
    return <div className="min-h-screen opacity-0">{children}</div>;
  }

  return (
    <div
      className="min-h-screen flex flex-col transition-all duration-300"
      style={{ paddingLeft: collapsed ? "68px" : "200px" }}
    >
      {children}
    </div>
  );
}
