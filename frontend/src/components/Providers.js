"use client";

import { BackgroundProvider } from "@/context/BackgroundContext";
import { SidebarProvider } from "@/context/SidebarContext";

export default function Providers({ children }) {
  return (
    <SidebarProvider>
      <BackgroundProvider>{children}</BackgroundProvider>
    </SidebarProvider>
  );
}
