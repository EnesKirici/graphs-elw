"use client";

import { BackgroundProvider } from "@/context/BackgroundContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { AdminProvider } from "@/context/AdminContext";

export default function Providers({ children }) {
  return (
    <AdminProvider>
      <AnalyticsProvider>
        <SidebarProvider>
          <BackgroundProvider>{children}</BackgroundProvider>
        </SidebarProvider>
      </AnalyticsProvider>
    </AdminProvider>
  );
}
