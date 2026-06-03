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
      className="min-h-screen flex flex-col"
      style={{
        paddingLeft: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        transition: "padding-left .35s var(--ease)",
      }}
    >
      {children}
    </div>
  );
}
