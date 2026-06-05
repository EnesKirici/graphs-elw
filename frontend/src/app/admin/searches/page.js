"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";

export default function SearchesPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAdmin(`/analytics/searches?page=${page}&per_page=25`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Arama Geçmişi</h1>
        <p className="text-sm text-gray-500 mt-1">Kullanıcıların aradığı tüm profiller</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        {/* Tablo başlık */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-edge/50 text-[11px] text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">Tarih</div>
          <div className="col-span-4">Arama</div>
          <div className="col-span-3">Sayfa</div>
          <div className="col-span-2">IP</div>
        </div>

        {/* Satırlar */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : !data?.data?.length ? (
          <div className="p-8 text-center text-sm text-gray-600">Henüz arama verisi yok.</div>
        ) : (
          data.data.map((event) => {
            const query = event.data?.query || "—";
            const date = new Date(event.created_at);
            const dateStr = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
            const timeStr = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
            const ip = event.ip_address ? event.ip_address.replace(/^::ffff:/, "") : "—";

            return (
              <div key={event.id} className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-edge/20 hover:bg-hover transition-colors">
                <div className="col-span-3">
                  <span className="text-sm text-gray-300">{dateStr}</span>
                  <span className="text-xs text-gray-600 ml-2">{timeStr}</span>
                </div>
                <div className="col-span-4">
                  <span className="text-sm text-emerald-400 font-medium">{query}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-xs text-gray-500 font-mono truncate block">{event.page || "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-600 font-mono">{ip}</span>
                </div>
              </div>
            );
          })
        )}

        {/* Sayfalama */}
        {data?.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-edge/50">
            <span className="text-xs text-gray-500">
              Toplam {data.total} arama — Sayfa {data.current_page}/{data.last_page}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs text-gray-400 hover:text-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg bg-soft hover:bg-hover transition-colors cursor-pointer"
              >
                Önceki
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.last_page}
                className="text-xs text-gray-400 hover:text-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg bg-soft hover:bg-hover transition-colors cursor-pointer"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
