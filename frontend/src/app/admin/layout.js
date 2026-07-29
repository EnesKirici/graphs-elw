"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/adminApi";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (!isLoginPage && !isAuthenticated()) {
      router.replace("/admin/login");
    } else {
      setReady(true);
    }
  }, [pathname, isLoginPage, router]);

  // Splash görselini örten opak navy zemin (dpm-scope + z-[1]) — admin bir araç.
  const shellBg = { backgroundColor: "#0c111f", backgroundImage: "radial-gradient(1100px 520px at 18% -8%, rgba(91,141,239,0.08), transparent 60%)" };

  if (!ready) {
    return (
      <div className="relative z-[1] min-h-screen dpm-scope flex items-center justify-center" style={shellBg}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#5b8def", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // Login sayfası — sidebar/topbar yok
  if (isLoginPage) {
    return <div className="relative z-[1] min-h-screen dpm-scope" style={shellBg}>{children}</div>;
  }

  // Admin sayfaları — navy shell: sidebar + topbar + içerik.
  // Arka plan OPAK: dpm-scope, site görseli aktifken (html.has-bg) saydamlaşıyor;
  // admin bir araç, splash sızmasın diye opak navy zemin + hafif üst ışıltı zorlanır.
  return (
    <div className="relative z-[1] min-h-screen dpm-scope" style={shellBg}>
      <AdminSidebar />
      <main className="ml-56 min-h-screen flex flex-col">
        <AdminTopbar />
        <div className="flex-1 w-full max-w-[1440px] px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
