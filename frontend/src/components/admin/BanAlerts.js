"use client";

import { useState, useEffect, useRef } from "react";
import { fetchAdmin, deleteAdmin } from "@/lib/adminApi";
import Link from "next/link";
import { Badge, Button } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

// Şiddet seviyesi → tone eşlemesi (yüksek=rose, orta=gold, düşük=azure).
const SEV_CONFIG = {
  critical: { label: "KRITIK", tone: "rose", icon: "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  scan:     { label: "TARAMA", tone: "gold", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  flood:    { label: "FLOOD", tone: "gold", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  bot:      { label: "BOT", tone: "azure", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
};

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

  const hasAlerts = alerts.length > 0;
  const borderTone = hasAlerts ? TONES.rose : TONES.gold;

  return (
    <div
      className="mb-6 rounded-2xl border bg-card/80 backdrop-blur-sm transition-all duration-500"
      style={{
        borderColor: borderTone.bd,
        boxShadow: hasAlerts && flash ? `0 8px 24px -8px ${TONES.rose.bar}66` : "none",
      }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-edge/60">
        <div className="flex items-center gap-3">
          {hasAlerts && (
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: TONES.rose.bar }} />
          )}
          <h3 className="text-sm font-semibold text-gray-200">
            {hasAlerts ? "Guvenlik Bildirimleri" : "Guvenlik Durumu"}
          </h3>
          {hasAlerts && <Badge tone="rose">{alerts.length} yeni</Badge>}
          {activeBans > 0 && (
            <Link href="/admin/bans" className="hover:opacity-80 transition-opacity">
              <Badge tone="gold">{activeBans} aktif ban</Badge>
            </Link>
          )}
        </div>
        {hasAlerts && (
          <Button variant="ghost" size="sm" onClick={handleClear}>Temizle</Button>
        )}
      </div>

      {/* Alert listesi */}
      {hasAlerts && (
        <div className="max-h-72 overflow-y-auto divide-y divide-edge/20">
          {[...alerts].reverse().map((alert, i) => {
            const time = new Date(alert.time);
            const timeStr = time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const dateStr = time.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });

            const sev = alert.severity || "bot";
            const s = SEV_CONFIG[sev] || SEV_CONFIG.bot;
            const t = TONES[s.tone];

            return (
              <div
                key={i}
                className="px-5 py-3 flex items-center gap-4 transition-colors"
                style={sev === "critical" ? { background: "rgba(219,106,131,0.05)" } : undefined}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                  <svg className="w-4 h-4" style={{ color: t.fg }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium" style={{ color: TONES.rose.fg }}>{alert.ip}</span>
                    <Badge tone={s.tone} className="text-[9px] font-bold">{s.label}</Badge>
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
