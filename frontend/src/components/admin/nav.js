// Admin navigasyonunun TEK kaynağı — hem AdminSidebar hem AdminTopbar buradan
// beslenir (breadcrumb + aktif sayfa başlığı da buradan türetilir). Yeni sayfa
// eklerken yalnızca burayı güncelle.

export const NAV_SECTIONS = [
  {
    title: "Genel",
    items: [
      { href: "/admin", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
      { href: "/admin/searches", label: "Aramalar", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
      { href: "/admin/analytics", label: "Analitik", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
      { href: "/admin/worker", label: "Meta Worker", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
      { href: "/admin/retention", label: "Veri Saklama", icon: "M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3" },
      { href: "/admin/bans", label: "IP Engelleme", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
    ],
  },
  {
    title: "Ayarlar",
    items: [
      { href: "/admin/settings/labels", label: "Performans Etiketleri", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" },
      { href: "/admin/settings/live-labels", label: "Canlı Maç Etiketleri", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
      { href: "/admin/settings/badges", label: "Rozetler", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
      { href: "/admin/settings/elw-score", label: "ELW Skor", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { href: "/admin/settings/design", label: "Tasarım", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
      { href: "/admin/settings/meta-insufficient", label: "Meta Verisi", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
      { href: "/admin/settings/seo", label: "SEO", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    ],
  },
];

// Yalnız süper adminin sidebar'ında görünür (yetki kontrolü sunucuda).
export const SUPER_ITEM = {
  href: "/admin/admins",
  label: "Adminler",
  icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
};

/**
 * Rol'e göre bölümleri döndür — super_admin ise "Adminler" item'i "Genel"e eklenir.
 */
export function sectionsFor(role) {
  return NAV_SECTIONS.map((s) =>
    s.title === "Genel" && role === "super_admin"
      ? { ...s, items: [...s.items, SUPER_ITEM] }
      : s
  );
}

/**
 * Aktif rota → { section, item }. Nested rotalarda (settings/*) en uzun eşleşen
 * href kazanır. Bilinmeyen rota → { section: null, item: null }.
 */
export function findNav(pathname) {
  const all = [...NAV_SECTIONS, { title: "Genel", items: [SUPER_ITEM] }];
  let best = { section: null, item: null, len: -1 };
  for (const section of all) {
    for (const item of section.items) {
      const exact = pathname === item.href;
      const nested = item.href !== "/admin" && pathname.startsWith(item.href + "/");
      if ((exact || nested) && item.href.length > best.len) {
        best = { section, item, len: item.href.length };
      }
    }
  }
  return { section: best.section, item: best.item };
}
