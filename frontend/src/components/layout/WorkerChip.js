"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

/**
 * Meta worker hızlı kontrolü — YALNIZ admin oturumu olan tarayıcıda görünür.
 * Tek tık: aç/kapa. Hover: mini durum paneli + panele "Yönet" linki.
 * Admin panele gitmeden worker'ı durdurup başlatmak için (Navbar sağ blok).
 */
export default function WorkerChip() {
  const { isAdmin } = useAdmin();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setStatus(null); return; }
    let mounted = true;
    const poll = () => {
      fetchAdmin("/worker")
        .then((s) => { if (mounted) setStatus(s); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [isAdmin]);

  if (!isAdmin || !status) return null;

  const on = !!status.enabled;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !on;
    setStatus((s) => ({ ...s, enabled: next })); // optimistic
    try {
      await putAdmin("/settings/worker_enabled", { value: next });
    } catch {
      setStatus((s) => ({ ...s, enabled: on })); // geri al
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={toggle}
        disabled={busy}
        className="tb-pill"
        style={{ gap: 7, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
        title={on ? "Worker çalışıyor — durdurmak için tıkla" : "Worker kapalı — başlatmak için tıkla"}
      >
        <span
          className="sf-dot"
          style={on
            ? { background: "var(--win)", boxShadow: "0 0 8px var(--win)" }
            : { background: "var(--txt-3)" }}
        />
        <span className="xp-meta" style={{ color: on ? "var(--win)" : "var(--txt-3)" }}>WORKER</span>
      </button>

      {hover && (
        <div
          className="absolute top-full right-0 mt-2 px-4 py-3 w-60 z-50"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border-strong)", borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.6)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 12, color: "var(--txt-2)" }}>Meta Worker</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: on ? "var(--win)" : "var(--txt-3)" }}>
              {on ? "ÇALIŞIYOR" : "KAPALI"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>{status.poolSize ?? 0}</p>
              <p style={{ fontSize: 9, color: "var(--txt-3)" }}>Havuz</p>
            </div>
            <div className="text-center">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>{status.queueDepth ?? 0}</p>
              <p style={{ fontSize: 9, color: "var(--txt-3)" }}>Kuyruk</p>
            </div>
            <div className="text-center">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>{status.processedToday ?? 0}</p>
              <p style={{ fontSize: 9, color: "var(--txt-3)" }}>Bugün</p>
            </div>
          </div>
          <Link
            href="/admin/worker"
            style={{ display: "block", textAlign: "center", fontSize: 11, color: "var(--accent)", padding: "6px 0", borderTop: "1px solid var(--border)" }}
          >
            Yönet →
          </Link>
        </div>
      )}
    </div>
  );
}
