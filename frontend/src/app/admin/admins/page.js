"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAdmin, postAdmin, putAdmin, deleteAdmin, getAdminUser } from "@/lib/adminApi";

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(14);
  crypto.getRandomValues(buf);
  for (const n of buf) out += chars[n % chars.length];
  return out;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const me = getAdminUser();

  // Yeni hesap formu
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [formLoading, setFormLoading] = useState(false);

  // Şifre sıfırlama (satır içi)
  const [resetId, setResetId] = useState(null);
  const [resetPass, setResetPass] = useState("");

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };

  const loadAdmins = useCallback(() => {
    setLoading(true);
    fetchAdmin("/admins")
      .then((d) => { setAdmins(d.admins); setErr(""); })
      .catch((e) => setErr(e.message.includes("403") ? "Bu sayfa yalnız süper admin içindir." : "Liste yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.username || form.password.length < 8) return;
    setFormLoading(true);
    try {
      await postAdmin("/admins", form);
      flash(`"${form.username}" oluşturuldu!`);
      setShowForm(false);
      setForm({ username: "", password: "" });
      loadAdmins();
    } catch {
      flash("Hata: kullanıcı adı alınmış veya geçersiz olabilir.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(admin) {
    if (!window.confirm(`"${admin.username}" hesabı silinsin mi? Açık oturumları da kapanır.`)) return;
    try {
      await deleteAdmin(`/admins/${admin.id}`);
      flash(`"${admin.username}" silindi.`);
      loadAdmins();
    } catch {
      flash("Hata oluştu!");
    }
  }

  async function handleReset(admin) {
    if (resetPass.length < 8) return;
    try {
      await putAdmin(`/admins/${admin.id}/password`, { password: resetPass });
      flash(`"${admin.username}" şifresi güncellendi, açık oturumları kapatıldı.`);
      setResetId(null);
      setResetPass("");
      loadAdmins();
    } catch {
      flash("Hata oluştu!");
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Adminler</h1>
          <p className="text-sm text-gray-500 mt-1">Panele giriş yapabilen hesapları yönet</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes("Hata") ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>}
          <button onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Admin
          </button>
        </div>
      </div>

      {/* Bilgi */}
      <div className="glass rounded-2xl p-5 mb-6 border border-blue-500/10">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p><strong className="text-gray-300">Her hesap kendi oturumunu açar</strong> — kimse kimseyi panelden atmaz.</p>
            <p><strong className="text-gray-300">Şifre sıfırlanınca</strong> o hesabın açık oturumları güvenlik için kapatılır, yeni şifreyle tekrar girer.</p>
            <p><strong className="text-gray-300">Süper admin</strong> hesabı silinemez; bu sayfayı yalnız süper admin görür.</p>
          </div>
        </div>
      </div>

      {/* Yeni hesap formu */}
      {showForm && (
        <div className="glass rounded-2xl p-6 mb-6 border border-blue-500/20">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Yeni Admin Hesabı</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Kullanıcı Adı</label>
              <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="ornek: nuray" required minLength={3}
                className="w-full bg-card border border-edge rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Şifre (en az 8 karakter)</label>
              <div className="flex items-center gap-2">
                <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Şifre" required minLength={8} type="text" autoComplete="off"
                  className="flex-1 bg-card border border-edge rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none focus:border-blue-500/50" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}
                  className="text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 rounded-lg transition-colors cursor-pointer shrink-0">
                  Üret
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={formLoading || !form.username || form.password.length < 8}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium py-2 rounded-xl transition-colors cursor-pointer">
                {formLoading ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tablo */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-edge/50 text-[10px] text-gray-600 uppercase tracking-wider">
          <div className="col-span-3">Kullanıcı</div>
          <div className="col-span-2">Rol</div>
          <div className="col-span-2">Oluşturulma</div>
          <div className="col-span-2">Son Aktivite</div>
          <div className="col-span-3 text-right">İşlem</div>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : err ? (
          <div className="p-10 text-center text-sm text-gray-400">{err}</div>
        ) : (
          admins?.map((admin) => (
            <div key={admin.id}>
              <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-edge/20 hover:bg-hover transition-colors items-center">
                <div className="col-span-3 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${admin.online ? "bg-emerald-400" : "bg-gray-600"}`}
                    title={admin.online ? "Aktif oturumu var" : "Oturum yok"} />
                  <span className="text-sm text-gray-200">{admin.username}</span>
                  {admin.username === me?.username && <span className="text-[10px] text-gray-600">(sen)</span>}
                </div>
                <div className="col-span-2">
                  {admin.role === "super_admin" ? (
                    <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 uppercase tracking-wider">Süper Admin</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-blue-400/90 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5 uppercase tracking-wider">Admin</span>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">{formatDate(admin.created_at)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">{formatDate(admin.last_active_at)}</span>
                </div>
                <div className="col-span-3 text-right space-x-2">
                  {(admin.role !== "super_admin" || admin.username === me?.username) && (
                    <button onClick={() => { setResetId(resetId === admin.id ? null : admin.id); setResetPass(""); }}
                      className="text-xs text-gray-500 hover:text-blue-400 bg-soft hover:bg-blue-500/10 px-3 py-1 rounded-lg transition-colors cursor-pointer">
                      Şifre Sıfırla
                    </button>
                  )}
                  {admin.role !== "super_admin" && (
                    <button onClick={() => handleDelete(admin)}
                      className="text-xs text-gray-500 hover:text-red-400 bg-soft hover:bg-red-500/10 px-3 py-1 rounded-lg transition-colors cursor-pointer">
                      Sil
                    </button>
                  )}
                </div>
              </div>

              {/* Satır içi şifre sıfırlama */}
              {resetId === admin.id && (
                <div className="px-5 py-3 border-b border-edge/20 bg-soft/50 flex items-center gap-2 justify-end">
                  <span className="text-[11px] text-gray-500 mr-auto">Yeni şifre — kaydedilince açık oturumları kapanır:</span>
                  <input value={resetPass} onChange={(e) => setResetPass(e.target.value)}
                    placeholder="En az 8 karakter" type="text" autoComplete="off" autoFocus
                    className="w-52 bg-card border border-edge rounded-lg px-3 py-1.5 text-xs text-gray-300 font-mono focus:outline-none focus:border-blue-500/50" />
                  <button onClick={() => setResetPass(randomPassword())}
                    className="text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                    Üret
                  </button>
                  <button onClick={() => handleReset(admin)} disabled={resetPass.length < 8}
                    className="text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                    Kaydet
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
