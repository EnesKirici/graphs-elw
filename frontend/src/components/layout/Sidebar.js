"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { LayoutDashboard, Swords, Trophy, ChevronsLeft, Menu, Award } from "lucide-react";
import BadgeGuideModal from "@/components/summoner/BadgeGuideModal";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/champions", label: "Şampiyonlar", icon: Swords },
  { href: "/leaderboard", label: "Sıralama", icon: Trophy },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, ready } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badgeGuideOpen, setBadgeGuideOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Hydration öncesi gizle
  if (!ready) return null;

  return (
    <>
      {/* Mobil hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-[#0d1117] border border-[#1b2230] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
      >
        <Menu size={18} />
      </button>

      {/* Mobil overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen z-40 bg-[#0a0e14] border-r border-[#1b2230]/50 flex flex-col
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[68px]" : "w-[200px]"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-[#1b2230]/30 ${collapsed ? "justify-center px-2" : "px-4"}`}>
          <Link href="/" className="flex items-center gap-0">
            {collapsed ? (
              <img src="/logo/white_3.webp" alt="ELW" width={28} height={28} className="rounded-md" />
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-black text-white tracking-wide uppercase">ELW</span>
                <span className="text-[13px] font-medium text-gray-500 tracking-wider uppercase">Graphs</span>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg transition-all duration-200 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${isActive ? "bg-blue-500/10 text-blue-400" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Alt */}
        <div className="border-t border-[#1b2230]/30 p-2 space-y-1">
          <button
            onClick={() => setBadgeGuideOpen(true)}
            className={`w-full flex items-center gap-3 rounded-lg transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer ${
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
            }`}
            title={collapsed ? "Rozet & Skor" : undefined}
          >
            <Award size={20} />
            {!collapsed && <span className="text-sm font-medium">Rozet & Skor</span>}
          </button>
          {!collapsed && (
            <div className="px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-gray-500">TR1 Sunucu</span>
            </div>
          )}
          <button
            onClick={toggle}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ChevronsLeft size={16} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span className="text-[11px]">Daralt</span>}
          </button>
        </div>
      </aside>

      <BadgeGuideModal open={badgeGuideOpen} onClose={() => setBadgeGuideOpen(false)} />
    </>
  );
}
