"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/adminApi";

const NAV_SECTIONS = [
  {
    title: "Genel",
    items: [
      { href: "/admin", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
      { href: "/admin/searches", label: "Aramalar", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
      { href: "/admin/analytics", label: "Analitik", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
      { href: "/admin/bans", label: "IP Engelleme", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
    ],
  },
  {
    title: "Ayarlar",
    items: [
      { href: "/admin/settings/labels", label: "Etiketler", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" },
      { href: "/admin/settings/badges", label: "Rozetler", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
      { href: "/admin/settings/elw-score", label: "ELW Skor", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { href: "/admin/settings/design", label: "Tasarım", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 tip-dark bg-[#0a0e14] border-r border-edge flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-edge/50">
        {/* Admin sidebar her temada koyu (tip-dark) → wordmark filtresiz beyaz kalır */}
        <Link href="/admin" className="block">
          <img src="/logo/elw-wordmark.png" alt="ELW GRAPHS" style={{ height: 16 }} />
          <span className="text-[10px] text-gray-500 block mt-1.5">Admin Panel</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-3 mb-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                      isActive
                        ? "bg-blue-500/15 text-blue-400 font-medium shadow-sm shadow-blue-500/5"
                        : "text-gray-400 hover:text-gray-200 hover:bg-hover"
                    }`}
                  >
                    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
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

      {/* Alt */}
      <div className="px-3 py-3 border-t border-edge/50 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-gray-300 hover:bg-hover transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="truncate">Siteye Don</span>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="truncate">Cikis Yap</span>
        </button>
      </div>
    </aside>
  );
}
