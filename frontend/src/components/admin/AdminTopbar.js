"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, getAdminUser } from "@/lib/adminApi";
import { findNav } from "./nav";

// Üst bar — sol: breadcrumb (Admin › Bölüm › Sayfa), sağ: kullanıcı + siteye dön +
// çıkış. Global aksiyonlar sidebar dibinden buraya toplandı (tek yer, temiz sidebar).
export default function AdminTopbar() {
  const pathname = usePathname();
  const [me, setMe] = useState(null);
  useEffect(() => { setMe(getAdminUser()); }, []);

  const { section, item } = findNav(pathname);
  const crumb = (item?.label) || "Panel";

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 px-6 border-b border-edge/70 bg-card/70 backdrop-blur-md">
      {/* Başlık + bölüm (topbar aynı zamanda sayfa başlığı barı) */}
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h1 className="text-[15px] font-semibold text-white truncate tracking-tight">{crumb}</h1>
        {section && <span className="hidden md:inline text-[11px] text-gray-600 shrink-0">· {section.title}</span>}
      </div>

      {/* Sağ: kullanıcı + aksiyonlar */}
      <div className="flex items-center gap-2 shrink-0">
        {me && (
          <div className="hidden sm:flex items-center gap-2 pr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#45c592]" />
            <span className="text-[12px] text-gray-400">{me.username}</span>
            {me.role === "super_admin" && (
              <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 uppercase tracking-wider">Süper</span>
            )}
          </div>
        )}
        <Link
          href="/"
          title="Siteye Dön"
          className="w-8 h-8 grid place-items-center rounded-lg border border-edge text-gray-400 hover:text-white hover:bg-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <button
          onClick={logout}
          title="Çıkış Yap"
          className="w-8 h-8 grid place-items-center rounded-lg border border-edge text-[#ef8ba0]/80 hover:text-[#ef8ba0] hover:bg-[#ef8ba0]/10 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
