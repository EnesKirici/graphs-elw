"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAdmin, postAdmin, putAdmin, deleteAdmin, getAdminUser } from "@/lib/adminApi";
import { Card, Badge, Button, ConfirmButton, DataTable, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

const ICON_PLUS = "M12 4v16m8-8H4";
const ICON_USERS = "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z";

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

  // Silme isleminde hangi satirin beklemede oldugunu izler (buton busy state'i icin)
  const [deletingId, setDeletingId] = useState(null);

  // Sifre sifirlama (satir ici)
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
    setDeletingId(admin.id);
    try {
      await deleteAdmin(`/admins/${admin.id}`);
      flash(`"${admin.username}" silindi.`);
      loadAdmins();
    } catch {
      flash("Hata oluştu!");
    } finally {
      setDeletingId(null);
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

  const columns = [
    {
      key: "user", label: "Kullanıcı",
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.online ? TONES.mint.dot : TONES.neutral.dot }}
            title={a.online ? "Aktif oturumu var" : "Oturum yok"} />
          <span className="text-sm text-gray-200">{a.username}</span>
          {a.username === me?.username && <span className="text-[10px] text-gray-600">(sen)</span>}
        </div>
      ),
    },
    {
      key: "role", label: "Rol",
      render: (a) => a.role === "super_admin"
        ? <Badge tone="gold" dot>Süper Admin</Badge>
        : <Badge tone="azure" dot>Admin</Badge>,
    },
    {
      key: "created", label: "Oluşturulma",
      render: (a) => <span className="text-xs text-gray-500">{formatDate(a.created_at)}</span>,
    },
    {
      key: "active", label: "Son Aktivite",
      render: (a) => <span className="text-xs text-gray-500">{formatDate(a.last_active_at)}</span>,
    },
    {
      key: "actions", label: "İşlem", align: "right", width: "300px",
      render: (a) => {
        const canReset = a.role !== "super_admin" || a.username === me?.username;
        const canDelete = a.role !== "super_admin";
        return (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center justify-end gap-2">
              {canReset && (
                <Button variant="neutral" size="sm" onClick={() => { setResetId(resetId === a.id ? null : a.id); setResetPass(""); }}>
                  Şifre Sıfırla
                </Button>
              )}
              {canDelete && (
                <ConfirmButton
                  label="Sil"
                  question={`"${a.username}" silinsin mi?`}
                  confirmLabel="Evet, sil"
                  busyLabel="Siliniyor..."
                  onConfirm={() => handleDelete(a)}
                  busy={deletingId === a.id}
                />
              )}
            </div>
            {resetId === a.id && (
              <div className="w-full flex flex-wrap items-center justify-end gap-2 bg-soft border border-edge rounded-lg px-3 py-2">
                <span className="text-[11px] text-gray-500 mr-auto">Yeni şifre — kaydedilince açık oturumları kapanır:</span>
                <input value={resetPass} onChange={(e) => setResetPass(e.target.value)}
                  placeholder="En az 8 karakter" type="text" autoComplete="off" autoFocus
                  className="w-44 bg-card border border-edge rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-[#5b8def]" />
                <Button variant="neutral" size="sm" onClick={() => setResetPass(randomPassword())}>Üret</Button>
                <Button variant="primary" size="sm" disabled={resetPass.length < 8} onClick={() => handleReset(a)}>Kaydet</Button>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-3">
        {msg && <span className="text-xs" style={{ color: msg.includes("Hata") ? TONES.rose.fg : TONES.mint.fg }}>{msg}</span>}
        <Button variant="primary" icon={ICON_PLUS} onClick={() => setShowForm((v) => !v)}>Yeni Admin</Button>
      </div>

      <InfoNote tone="info" title="Hesap ve oturum kuralları" className="mb-4">
        <b className="text-gray-300">Her hesap kendi oturumunu açar</b> — kimse kimseyi panelden atmaz.<br />
        <b className="text-gray-300">Şifre sıfırlanınca</b> o hesabın açık oturumları güvenlik için kapatılır, yeni şifreyle tekrar girer.<br />
        <b className="text-gray-300">Süper admin</b> hesabı silinemez; bu sayfayı yalnız süper admin görür.
      </InfoNote>

      {showForm && (
        <Card title="Yeni Admin Hesabı" icon={ICON_PLUS} className="mb-4">
          <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Kullanıcı Adı</label>
              <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="ornek: nuray" required minLength={3}
                className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5b8def]" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Şifre (en az 8 karakter)</label>
              <div className="flex items-center gap-2">
                <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Şifre" required minLength={8} type="text" autoComplete="off"
                  className="flex-1 bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#5b8def]" />
                <Button type="button" variant="neutral" size="sm" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}>
                  Üret
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={formLoading || !form.username || form.password.length < 8} className="w-full">
                {formLoading ? "Oluşturuluyor..." : "Oluştur"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Adminler" subtitle="Panele giriş yapabilen hesapları yönetir." icon={ICON_USERS} flush>
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: TONES.azure.bar, borderTopColor: "transparent" }} />
          </div>
        ) : err ? (
          <div className="p-10 text-center text-sm text-gray-400">{err}</div>
        ) : (
          <DataTable columns={columns} rows={admins || []} rowKey={(a) => a.id} empty="Kayıt yok." />
        )}
      </Card>
    </>
  );
}
