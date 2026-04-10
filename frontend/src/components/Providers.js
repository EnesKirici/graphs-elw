"use client";

import { BackgroundProvider } from "@/context/BackgroundContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";

export default function Providers({ children }) {
  return (
    <AnalyticsProvider>
      <SidebarProvider>
        <BackgroundProvider>{children}</BackgroundProvider>
      </SidebarProvider>
    </AnalyticsProvider>
  );
}
