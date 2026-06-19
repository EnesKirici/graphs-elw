"use client";

// Sidebar kaldırıldı → içerik tam viewport'a göre ortalanır (sayfa içi
// `max-w-7xl mx-auto` / `.content` zaten ortalıyor). Padding/flash gating yok.
export default function MainContent({ children }) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}
