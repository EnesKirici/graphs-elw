"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { LayoutDashboard, Trophy, Swords, ChevronsLeft, Menu, Award, ListOrdered } from "lucide-react";
import BadgeGuideModal from "@/components/summoner/BadgeGuideModal";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leaderboard", label: "Sıralama", icon: Trophy },
  { href: "/tier-list", label: "Tier List", icon: ListOrdered },
  { href: "/champions", label: "Tüm Şampiyonlar", icon: Swords },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, ready } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badgeGuideOpen, setBadgeGuideOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!ready) return null;

  return (
    <>
      {/* Mobil hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--txt-2)" }}
        aria-label="Menü"
      >
        <Menu size={18} />
      </button>

      {/* Mobil overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`elw-sidebar ${collapsed ? "collapsed" : ""} fixed top-0 left-0 z-40 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{
          height: "100vh",
          width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
          transition: "width .35s var(--ease), transform .35s var(--ease)",
        }}
      >
        {/* Marka */}
        <Link href="/" className="brand">
          <div className="brand-mark">E</div>
          {!collapsed && (
            <div className="brand-txt">
              <b>ELW</b>
              <span>GRAPHS</span>
            </div>
          )}
        </Link>

        {/* Nav */}
        <nav className="elw-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Alt */}
        <div className="side-foot">
          <button
            onClick={() => setBadgeGuideOpen(true)}
            className="sf-row"
            style={{ cursor: "pointer", width: "100%" }}
            title={collapsed ? "Rozet & Skor" : undefined}
          >
            <Award size={18} />
            {!collapsed && <span className="sf-txt">Rozet & Skor</span>}
          </button>

          <div className="sf-row" style={{ cursor: "default" }} title={collapsed ? "TR1 Sunucu · Çevrimiçi" : undefined}>
            <span className="sf-dot" />
            {!collapsed && <span className="sf-txt">TR1 Sunucu · Çevrimiçi</span>}
          </div>

          <button onClick={toggle} className="collapse-btn">
            <ChevronsLeft size={16} className="chev" />
            {!collapsed && <span>Daralt</span>}
          </button>
        </div>
      </aside>

      <BadgeGuideModal open={badgeGuideOpen} onClose={() => setBadgeGuideOpen(false)} />
    </>
  );
}
