"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminUser } from "@/lib/adminApi";
import { sectionsFor } from "./nav";

// Sol menü. Nav verisi ortak nav.js'ten; kullanıcı/çıkış aksiyonları AdminTopbar'da.
// Genişlik w-56; aktif item'de sol accent bar + mavi vurgu.
export default function AdminSidebar() {
  const pathname = usePathname();
  const [me, setMe] = useState(null);
  useEffect(() => { setMe(getAdminUser()); }, []);

  const sections = sectionsFor(me?.role);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#0a0f1c] border-r border-edge flex flex-col z-40">
      {/* Logo */}
      <div className="h-14 px-5 flex items-center border-b border-edge/60">
        <Link href="/admin" className="flex items-center gap-2.5">
          <img src="/logo/elw-wordmark.png" alt="ELW GRAPHS" style={{ height: 15 }} />
          <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-[0.2em] border-l border-edge pl-2.5">Admin</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-lg text-[13px] transition-colors ${
                      isActive
                        ? "bg-[#7a94ba]/12 text-[#aebfd6] font-medium"
                        : "text-gray-400 hover:text-gray-100 hover:bg-hover"
                    }`}
                  >
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-colors" style={{ background: isActive ? "#6d87ad" : "transparent" }} />
                    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Dip: ince marka etiketi */}
      <div className="px-5 py-3 border-t border-edge/60">
        <p className="text-[10px] text-gray-600">ELW Graphs · Yönetim</p>
      </div>
    </aside>
  );
}
