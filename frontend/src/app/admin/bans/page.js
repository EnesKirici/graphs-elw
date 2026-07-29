"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAdmin, postAdmin, deleteAdmin } from "@/lib/adminApi";
import { Card, Button, ConfirmButton, DataTable, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

const ICON_PLUS = "M12 4v16m8-8H4";
const ICON_BAN = "M18.364 5.636a9 9 0 11-12.728 12.728 9 9 0 0112.728-12.728zM5.636 5.636l12.728 12.728";
const ICON_CHECK = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";

const FILTERS = [
  { key: "active", label: "Aktif Banlar" },
  { key: "expired", label: "Suresi Dolan" },
  { key: "all", label: "Tumu" },
];

function isBanActive(ban) {
  return !ban.unbanned_at && (ban.is_permanent || new Date(ban.expires_at) > Date.now());
}

export default function BansPage() {
  const [bans, setBans] = useState(null);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Manuel ban formu
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ip_address: "", reason: "", minutes: 60, permanent: false });
  const [formLoading, setFormLoading] = useState(false);

  // Ban kaldirma isleminde hangi satirin beklemede oldugunu izler (buton busy state'i icin)
  const [unbanningId, setUnbanningId] = useState(null);

  const loadBans = useCallback(() => {
    setLoading(true);
    fetchAdmin(`/bans?filter=${filter}&per_page=50`)
      .then(setBans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { loadBans(); }, [loadBans]);

  async function handleBan(e) {
    e.preventDefault();
    if (!form.ip_address || !form.reason) return;
    setFormLoading(true);
    try {
      await postAdmin("/bans", form);
      setShowForm(false);
      setForm({ ip_address: "", reason: "", minutes: 60, permanent: false });
      setMsg("IP engellendi!");
      setTimeout(() => setMsg(""), 3000);
      loadBans();
    } catch {
      setMsg("Hata olustu!");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUnban(id) {
    setUnbanningId(id);
    try {
      await deleteAdmin(`/bans/${id}`);
      setMsg("Ban kaldirildi!");
      setTimeout(() => setMsg(""), 3000);
      loadBans();
    } catch {
      setMsg("Hata olustu!");
    } finally {
      setUnbanningId(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }

  function timeRemaining(expiresAt, isPermanent) {
    if (isPermanent) return "Kalici";
    if (!expiresAt) return "—";
    const diff = new Date(expiresAt) - Date.now();
    if (diff <= 0) return "Suresi dolmus";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}sa ${mins}dk` : `${mins}dk`;
  }

  const rows = (bans?.data || []).map((b) => ({ ...b, _active: isBanActive(b) }));

  const columns = [
    {
      key: "ip", label: "IP Adresi",
      render: (b) => <span className={`text-sm text-gray-200 font-mono ${!b._active ? "opacity-50" : ""}`}>{b.ip_address}</span>,
    },
    {
      key: "reason", label: "Sebep",
      render: (b) => <span className={`text-xs text-gray-400 ${!b._active ? "opacity-50" : ""}`}>{b.reason}</span>,
    },
    {
      key: "attempts", label: "Deneme",
      render: (b) => (
        <span className="text-xs font-mono tabular-nums" style={{ color: b.failed_attempts >= 10 ? TONES.rose.fg : undefined }}>
          {b.failed_attempts}
        </span>
      ),
    },
    {
      key: "banned_at", label: "Banlanma",
      render: (b) => <span className="text-xs text-gray-500">{formatDate(b.banned_at)}</span>,
    },
    {
      key: "remaining", label: "Kalan Sure",
      render: (b) => !b._active
        ? <span className="text-xs text-gray-600">Bitti</span>
        : <span className="text-xs font-medium" style={{ color: b.is_permanent ? TONES.rose.fg : TONES.gold.fg }}>
            {timeRemaining(b.expires_at, b.is_permanent)}
          </span>,
    },
    {
      key: "action", label: "Islem", align: "right", width: "160px",
      render: (b) => !b._active ? null : (
        <ConfirmButton
          label="Ban Kaldir"
          question={`"${b.ip_address}" icin ban kaldirilsin mi?`}
          confirmLabel="Evet, kaldir"
          busyLabel="Kaldiriliyor..."
          onConfirm={() => handleUnban(b.id)}
          busy={unbanningId === b.id}
        />
      ),
    },
  ];

  const emptyState = filter === "active" ? (
    <div className="flex flex-col items-center gap-2 py-4">
      <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: TONES.mint.bg }}>
        <svg className="w-5 h-5" style={{ color: TONES.mint.fg }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_CHECK} />
        </svg>
      </span>
      <p className="text-sm text-gray-400">Aktif ban yok — temiz!</p>
    </div>
  ) : "Kayit bulunamadi.";

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-3">
        {msg && <span className="text-xs" style={{ color: msg.includes("Hata") ? TONES.rose.fg : TONES.mint.fg }}>{msg}</span>}
        <Button variant="primary" icon={ICON_PLUS} onClick={() => setShowForm((v) => !v)}>Manuel Ban</Button>
      </div>

      <InfoNote tone="danger" title="Nasil calisir" className="mb-4">
        <b className="text-gray-300">Otomatik ban:</b> 10 basarisiz login denemesi → 1 saat ban. 20+ deneme → 24 saat ban.<br />
        <b className="text-gray-300">Manuel ban:</b> Supheli IP adreslerini asagidaki formla engelleyebilirsin.<br />
        <b className="text-gray-300">Engellenen IP:</b> Admin login dahil tum admin endpoint&apos;lerine erisimi engellenir, 403 hatasi alir.
      </InfoNote>

      {showForm && (
        <Card title="Yeni IP Engelle" icon={ICON_PLUS} className="mb-4">
          <form onSubmit={handleBan} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">IP Adresi</label>
              <input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
                placeholder="192.168.1.1" required
                className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5b8def]" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Sebep</label>
              <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Brute force, Bot, Spam..." required
                className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5b8def]" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Sure (dakika)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) }))}
                  disabled={form.permanent} min={1}
                  className="flex-1 bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 disabled:opacity-30 focus:outline-none focus:border-[#5b8def]" />
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input type="checkbox" checked={form.permanent} onChange={(e) => setForm((f) => ({ ...f, permanent: e.target.checked }))}
                    className="rounded border-gray-600" />
                  <span className="text-[11px]" style={{ color: TONES.rose.fg }}>Kalici</span>
                </label>
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={formLoading} className="w-full">
                {formLoading ? "Engelleniyor..." : "Engelle"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${active ? "" : "bg-soft text-gray-400 border-edge hover:text-gray-200"}`}
              style={active ? { color: TONES.rose.fg, background: TONES.rose.bg, borderColor: TONES.rose.bd } : undefined}>
              {f.label}
            </button>
          );
        })}
      </div>

      <Card title="Engellenen IP'ler" subtitle="IP, sebep, deneme sayisi ve kalan sureye gore listelenir." icon={ICON_BAN} flush>
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: TONES.rose.bar, borderTopColor: "transparent" }} />
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(b) => b.id} empty={emptyState} />
            {bans?.last_page > 1 && (
              <div className="px-5 py-3 border-t border-edge/50 text-xs text-gray-600 text-center">
                Toplam {bans.total} kayit
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
