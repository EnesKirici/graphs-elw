"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBackground } from "@/context/BackgroundContext";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { background, removeBg } = useBackground();
  const [navQuery, setNavQuery] = useState("");

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/champions", label: "Şampiyonlar" },
  ];

  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
            G
          </div>
          <span className="text-lg font-bold text-white tracking-tight hidden sm:inline">
            GRAPHS
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Arama kutusu — aktif */}
        <form
          className="flex-1 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (navQuery.includes("#")) {
              const [n, t] = navQuery.split("#");
              if (n && t) {
                router.push(`/summoner/${encodeURIComponent(n)}/${encodeURIComponent(t)}`);
                setNavQuery("");
              }
            }
          }}
        >
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Oyuncu ara... (isim#tag)"
              className="w-full bg-white/5 border border-[#1b2230] rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all duration-300"
            />
          </div>
        </form>

        {/* Sağ taraf: Background kaldır + sunucu durumu */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Background kaldır butonu — sadece background varsa görünür */}
          {background && (
            <button
              onClick={removeBg}
              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 border border-[#1b2230] hover:border-red-500/30 px-2.5 py-1.5 rounded-lg transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              BG Kaldır
            </button>
          )}

          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-500">TR1</span>
        </div>
      </div>
    </nav>
  );
}
