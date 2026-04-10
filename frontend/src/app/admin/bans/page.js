"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAdmin, postAdmin, deleteAdmin } from "@/lib/adminApi";

export default function BansPage() {
  const [bans, setBans] = useState(null);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Manuel ban formu
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ip_address: "", reason: "", minutes: 60, permanent: false });
  const [formLoading, setFormLoading] = useState(false);

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
    try {
      await deleteAdmin(`/bans/${id}`);
      setMsg("Ban kaldirildi!");
      setTimeout(() => setMsg(""), 3000);
      loadBans();
    } catch {
      setMsg("Hata olustu!");
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

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">IP Engelleme</h1>
          <p className="text-sm text-gray-500 mt-1">Brute force ve bot denemelerini yonet</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes("Hata") ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>}
          <button onClick={() => setShowForm(!showForm)}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Manuel Ban
          </button>
        </div>
      </div>

      {/* Bilgi */}
      <div className="glass rounded-2xl p-5 mb-6 border border-red-500/10">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p><strong className="text-gray-300">Otomatik ban:</strong> 10 basarisiz login denemesi → 1 saat ban. 20+ deneme → 24 saat ban.</p>
            <p><strong className="text-gray-300">Manuel ban:</strong> Supheli IP adreslerini asagidaki formla engelleyebilirsin.</p>
            <p><strong className="text-gray-300">Engellenen IP:</strong> Admin login dahil tum admin endpoint&apos;lerine erisimi engellenir, 403 hatasi alir.</p>
          </div>
        </div>
      </div>

      {/* Manuel ban formu */}
      {showForm && (
        <div className="glass rounded-2xl p-6 mb-6 border border-red-500/20">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Yeni IP Engelle</h3>
          <form onSubmit={handleBan} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">IP Adresi</label>
              <input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
                placeholder="192.168.1.1" required
                className="w-full bg-[#0d1117] border border-[#1b2230] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-red-500/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Sebep</label>
              <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Brute force, Bot, Spam..." required
                className="w-full bg-[#0d1117] border border-[#1b2230] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-red-500/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Sure (dakika)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) }))}
                  disabled={form.permanent} min={1}
                  className="flex-1 bg-[#0d1117] border border-[#1b2230] rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-30 focus:outline-none focus:border-red-500/50" />
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input type="checkbox" checked={form.permanent} onChange={(e) => setForm((f) => ({ ...f, permanent: e.target.checked }))}
                    className="rounded border-gray-600" />
                  <span className="text-[11px] text-red-400">Kalici</span>
                </label>
              </div>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={formLoading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white text-sm font-medium py-2 rounded-xl transition-colors cursor-pointer">
                {formLoading ? "Engelleniyor..." : "Engelle"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtre */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: "active", label: "Aktif Banlar" },
          { key: "expired", label: "Suresi Dolan" },
          { key: "all", label: "Tumu" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === f.key
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-white/5 text-gray-400 border border-[#1b2230] hover:text-gray-200"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tablo */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-[#1b2230]/50 text-[10px] text-gray-600 uppercase tracking-wider">
          <div className="col-span-2">IP Adresi</div>
          <div className="col-span-3">Sebep</div>
          <div className="col-span-1">Deneme</div>
          <div className="col-span-2">Banlanma</div>
          <div className="col-span-2">Kalan Sure</div>
          <div className="col-span-2 text-right">Islem</div>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : !bans?.data?.length ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-sm text-gray-400">{filter === "active" ? "Aktif ban yok — temiz!" : "Kayit bulunamadi."}</p>
          </div>
        ) : (
          bans.data.map((ban) => {
            const isActive = !ban.unbanned_at && (ban.is_permanent || new Date(ban.expires_at) > Date.now());
            return (
              <div key={ban.id} className={`grid grid-cols-12 gap-3 px-5 py-3 border-b border-[#1b2230]/20 hover:bg-white/[0.02] transition-colors ${!isActive ? "opacity-50" : ""}`}>
                <div className="col-span-2">
                  <span className="text-sm text-gray-200 font-mono">{ban.ip_address}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-xs text-gray-400">{ban.reason}</span>
                </div>
                <div className="col-span-1">
                  <span className={`text-xs font-mono ${ban.failed_attempts >= 10 ? "text-red-400" : "text-gray-500"}`}>
                    {ban.failed_attempts}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">{formatDate(ban.banned_at)}</span>
                </div>
                <div className="col-span-2">
                  {isActive ? (
                    <span className={`text-xs font-medium ${ban.is_permanent ? "text-red-400" : "text-yellow-400"}`}>
                      {timeRemaining(ban.expires_at, ban.is_permanent)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">Bitti</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  {isActive && (
                    <button onClick={() => handleUnban(ban.id)}
                      className="text-xs text-gray-500 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/10 px-3 py-1 rounded-lg transition-colors cursor-pointer">
                      Ban Kaldir
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {bans?.last_page > 1 && (
          <div className="px-5 py-3 border-t border-[#1b2230]/50 text-xs text-gray-600 text-center">
            Toplam {bans.total} kayit
          </div>
        )}
      </div>
    </>
  );
}
