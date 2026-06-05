"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";

function MiniBar({ value, max, color = "bg-blue-500" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-edge overflow-hidden flex-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [pageViews, setPageViews] = useState(null);
  const [clickEvents, setClickEvents] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAdmin(`/analytics/page-views?days=${days}`),
      fetchAdmin("/analytics/events?type=click&per_page=30"),
    ])
      .then(([pv, ce]) => {
        setPageViews(pv);
        setClickEvents(ce);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Analitik</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  const maxPageView = pageViews?.pages?.[0]?.views || 1;

  // Tıklama olaylarını element'e göre grupla
  const clickGroups = {};
  clickEvents?.data?.forEach((e) => {
    const el = e.data?.element || "unknown";
    if (!clickGroups[el]) clickGroups[el] = 0;
    clickGroups[el]++;
  });
  const clickList = Object.entries(clickGroups).sort((a, b) => b[1] - a[1]);
  const maxClick = clickList.length > 0 ? clickList[0][1] : 1;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analitik</h1>
          <p className="text-sm text-gray-500 mt-1">Sayfa görüntülemeleri ve tıklama olayları</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                days === d
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-soft text-gray-400 border border-edge hover:text-gray-200"
              }`}
            >
              {d} gün
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Günlük görüntüleme grafiği */}
        {pageViews?.daily?.length > 0 && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Günlük Sayfa Görüntüleme</h3>
            <div className="flex items-end gap-1.5 h-36">
              {pageViews.daily.map((d) => {
                const maxDaily = Math.max(...pageViews.daily.map((x) => x.views));
                const h = maxDaily > 0 ? (d.views / maxDaily) * 100 : 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 font-mono">{d.views}</span>
                    <div className="w-full rounded-t bg-purple-500/60 transition-all" style={{ height: `${Math.max(h, 4)}%` }} />
                    <span className="text-[9px] text-gray-600">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sayfalar */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Sayfa Görüntülemeleri</h3>
            <div className="space-y-2.5">
              {pageViews?.pages?.length > 0 ? (
                pageViews.pages.slice(0, 15).map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 w-4 text-right">{i + 1}</span>
                    <span className="text-sm text-gray-300 flex-1 truncate font-mono">{p.page}</span>
                    <MiniBar value={p.views} max={maxPageView} color="bg-purple-500" />
                    <span className="text-xs text-gray-400 font-mono w-12 text-right">{p.views} ({p.unique_views})</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-600">Veri yok.</p>
              )}
            </div>
          </div>

          {/* Tıklama olayları */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Tıklama Olayları</h3>
            <div className="space-y-2.5">
              {clickList.length > 0 ? (
                clickList.slice(0, 15).map(([element, count], i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 w-4 text-right">{i + 1}</span>
                    <span className="text-sm text-gray-300 flex-1 truncate">{element}</span>
                    <MiniBar value={count} max={maxClick} color="bg-yellow-500" />
                    <span className="text-xs text-gray-400 font-mono w-8 text-right">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-600">Veri yok.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
