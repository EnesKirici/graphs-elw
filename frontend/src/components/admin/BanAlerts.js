"use client";

import { useState, useEffect, useRef } from "react";
import { fetchAdmin, deleteAdmin } from "@/lib/adminApi";
import Link from "next/link";

export default function BanAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [activeBans, setActiveBans] = useState(0);
  const prevCount = useRef(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let mounted = true;

    function poll() {
      fetchAdmin("/dashboard")
        .then((data) => {
          if (!mounted) return;
          const newAlerts = data.banAlerts || [];
          setAlerts(newAlerts);
          setActiveBans(data.activeBans || 0);

          // Yeni alert geldi mi?
          if (newAlerts.length > prevCount.current && prevCount.current > 0) {
            setFlash(true);
            setTimeout(() => setFlash(false), 2000);
          }
          prevCount.current = newAlerts.length;
        })
        .catch(() => {});
    }

    poll();
    const id = setInterval(poll, 10_000); // 10 saniyede bir
    return () => { mounted = false; clearInterval(id); };
  }, []);

  async function handleClear() {
    try {
      await deleteAdmin("/ban-alerts");
      setAlerts([]);
      prevCount.current = 0;
    } catch {}
  }

  if (alerts.length === 0 && activeBans === 0) return null;

  return (
    <div className={`mb-6 glass rounded-2xl border transition-all duration-500 ${
      alerts.length > 0
        ? `border-red-500/30 ${flash ? "shadow-lg shadow-red-500/20" : ""}`
        : "border-yellow-500/20"
    }`}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-edge/50">
        <div className="flex items-center gap-3">
          {alerts.length > 0 && (
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
          <h3 className="text-sm font-semibold text-gray-200">
            {alerts.length > 0 ? "Guvenlik Bildirimleri" : "Guvenlik Durumu"}
          </h3>
          {alerts.length > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
              {alerts.length} yeni
            </span>
          )}
          {activeBans > 0 && (
            <Link href="/admin/bans" className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium hover:bg-yellow-500/30 transition-colors">
              {activeBans} aktif ban
            </Link>
          )}
        </div>
        {alerts.length > 0 && (
          <button onClick={handleClear}
            className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors">
            Temizle
          </button>
        )}
      </div>

      {/* Alert listesi */}
      {alerts.length > 0 && (
        <div className="max-h-72 overflow-y-auto divide-y divide-edge/20">
          {[...alerts].reverse().map((alert, i) => {
            const time = new Date(alert.time);
            const timeStr = time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const dateStr = time.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });

            const sev = alert.severity || "bot";
            const sevConfig = {
              critical: { label: "KRITIK", bg: "bg-red-600/20", text: "text-red-400", icon: "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", rowBg: "bg-red-500/[0.05]" },
              scan:     { label: "TARAMA", bg: "bg-orange-500/20", text: "text-orange-400", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", rowBg: "" },
              flood:    { label: "FLOOD", bg: "bg-yellow-500/20", text: "text-yellow-400", icon: "M13 10V3L4 14h7v7l9-11h-7z", rowBg: "" },
              bot:      { label: "BOT", bg: "bg-red-500/20", text: "text-red-400", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636", rowBg: "" },
            };
            const s = sevConfig[sev] || sevConfig.bot;

            return (
              <div key={i} className={`px-5 py-3 flex items-center gap-4 transition-colors ${s.rowBg}`}>
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <svg className={`w-4 h-4 ${s.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-400 font-mono font-medium">{alert.ip}</span>
                    <span className={`text-[9px] ${s.bg} ${s.text} px-1.5 py-0.5 rounded font-bold`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-gray-500 font-mono">{timeStr}</p>
                  <p className="text-[10px] text-gray-600">{dateStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
