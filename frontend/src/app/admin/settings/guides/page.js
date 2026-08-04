"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { fetchApi } from "@/lib/api";
import { Card, Badge, Button, InfoNote } from "@/components/admin/ui";

/*
  Şampiyon Rehberleri — counter sayfasındaki ELLE YAZILAN metinler.

  İki tür metin var:
   - play : "X nasıl oynanır?" — şampiyonun genel oynanışı, koridor sayfasında
            kıyas tablosunun altında tam genişlikte çıkar.
   - vs   : "X, Y karşısında nasıl oynanır?" — eşleşmeye özel. Ziyaretçi şeritten
            o rakibi seçtiğinde kıyas tablosunun içinde belirir.

  NEDEN ELLE: sayılar "Talon karşısında %27.8 kazanıyorsun" der; "neden" ve "ne
  yapmalısın" sorusu oyun bilgisi ister, maç verisinden çıkarılamaz. DDragon da
  yetenek açıklaması verir, eşleşme tavsiyesi vermez.

  Depo: tek `champion_guides` admin ayarı (şampiyon id'siyle anahtarlı JSON).
  Boş metinler kaydederken AYIKLANIR → boş anahtar birikmez.
*/

export default function ChampionGuidesPage() {
  const [guides, setGuides] = useState({});
  const [champs, setChamps] = useState([]);
  const [sel, setSel] = useState(null);      // düzenlenen şampiyon id
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAdmin("/settings/champion_guides").then((r) => r.value || {}).catch(() => ({})),
      fetchApi("/champions").then((r) => r.champions || r || []).catch(() => []),
    ]).then(([g, c]) => {
      setGuides(g && typeof g === "object" ? g : {});
      // Classic varyantlarının counter sayfası zaten noindex ve veri yok — listeyi şişirmesin.
      setChamps((Array.isArray(c) ? c : []).filter((x) => !x.isClassic));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    const list = s ? champs.filter((c) => c.name.toLocaleLowerCase("tr").includes(s)) : champs;
    // Metni OLANLAR önce — hangilerini doldurduğun listede kaybolmasın.
    return [...list].sort((a, b) => {
      const fa = hasText(guides[a.id]) ? 0 : 1;
      const fb = hasText(guides[b.id]) ? 0 : 1;
      return fa - fb || a.name.localeCompare(b.name, "tr");
    });
  }, [champs, q, guides]);

  const doluSayisi = Object.keys(guides).filter((k) => hasText(guides[k])).length;
  const g = sel ? guides[sel] || {} : null;
  const selName = champs.find((c) => c.id === sel)?.name || sel;

  function setPlay(v) {
    setGuides((p) => ({ ...p, [sel]: { ...p[sel], play: v } }));
  }
  function setVs(opp, v) {
    setGuides((p) => ({ ...p, [sel]: { ...p[sel], vs: { ...p[sel]?.vs, [opp]: v } } }));
  }
  function removeVs(opp) {
    setGuides((p) => {
      const vs = { ...p[sel]?.vs };
      delete vs[opp];
      return { ...p, [sel]: { ...p[sel], vs } };
    });
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    // Boş metinleri AYIKLA: "kaydet"e her basışta boş anahtar birikmesin.
    const cleaned = {};
    for (const [id, entry] of Object.entries(guides)) {
      const out = {};
      if (entry?.play?.trim()) out.play = entry.play.trim();
      const vs = {};
      for (const [opp, t] of Object.entries(entry?.vs || {})) {
        if (t?.trim()) vs[opp] = t.trim();
      }
      if (Object.keys(vs).length) out.vs = vs;
      if (Object.keys(out).length) cleaned[id] = out;
    }
    try {
      await putAdmin("/settings/champion_guides", { value: cleaned });
      setGuides(cleaned);
      setMsg("ok");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setMsg("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <InfoNote tone="info" title="Nerede görünür?" className="flex-1 min-w-[300px]">
          <strong className="text-gray-300">Nasıl oynanır</strong> metni counter sayfasında kıyas tablosunun
          altında tam genişlikte çıkar. <strong className="text-gray-300">Eşleşme notu</strong> ise ziyaretçi
          şeritten o rakibi seçtiğinde kıyas tablosunun içinde belirir. Metin girilmemişse kutu hiç
          basılmaz — boş başlık görünmez. Satır sonları korunur, liste yazabilirsin.
          Kaydettikten sonra yayına ~1 saat içinde (rehber önbelleği) yansır.
        </InfoNote>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          <Badge tone="azure">{doluSayisi} şampiyon dolu</Badge>
          {msg === "ok" && <Badge tone="mint" dot>Kaydedildi</Badge>}
          {msg === "error" && <Badge tone="rose" dot>Hata</Badge>}
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Şampiyon seçici */}
        <Card title="Şampiyon" subtitle={`${filtered.length} sonuç`}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…"
            className="w-full mb-2 px-3 py-2 rounded-lg bg-black/25 border border-edge text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-gray-600"
          />
          <div className="max-h-[520px] overflow-y-auto space-y-0.5 pr-1">
            {filtered.map((c) => {
              const dolu = hasText(guides[c.id]);
              return (
                <button
                  key={c.id}
                  onClick={() => setSel(c.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-[13px] transition-colors cursor-pointer ${
                    sel === c.id ? "bg-[#7a94ba]/15 text-gray-100" : "text-gray-400 hover:bg-hover hover:text-gray-200"
                  }`}
                >
                  <img src={c.image} alt="" width={24} height={24} className="rounded shrink-0" />
                  <span className="truncate flex-1">{c.name}</span>
                  {dolu && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shrink-0" title="metin var" />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Düzenleme */}
        {!sel ? (
          <Card title="Düzenleme">
            <p className="text-sm text-gray-500 py-8 text-center">Soldan bir şampiyon seç.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card title={`${selName} nasıl oynanır?`} subtitle="Genel oynanış — kıyas tablosunun altında çıkar">
              <textarea
                value={g?.play || ""}
                onChange={(e) => setPlay(e.target.value)}
                rows={7}
                maxLength={4000}
                placeholder={`Örn: ${selName} ormanda erken tempo şampiyonudur…`}
                className="w-full px-3 py-2.5 rounded-lg bg-black/25 border border-edge text-[13px] leading-relaxed text-gray-200 placeholder:text-gray-600 outline-none focus:border-gray-600 resize-y"
              />
              <p className="text-[11px] text-gray-600 mt-1 text-right tabular-nums">{(g?.play || "").length}/4000</p>
            </Card>

            <Card
              title="Eşleşme notları"
              subtitle="Rakip seçildiğinde kıyas tablosunun içinde çıkar"
              actions={<AddVs champs={champs} exclude={[sel, ...Object.keys(g?.vs || {})]} onAdd={(opp) => setVs(opp, "")} />}
            >
              {Object.keys(g?.vs || {}).length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  Henüz not yok. Sağ üstten rakip ekle.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(g.vs).map(([opp, text]) => {
                    const oppName = champs.find((c) => c.id === opp)?.name || opp;
                    const oppImg = champs.find((c) => c.id === opp)?.image;
                    return (
                      <div key={opp} className="rounded-lg border border-edge/70 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {oppImg && <img src={oppImg} alt="" width={22} height={22} className="rounded" />}
                            <span className="text-[13px] font-medium text-gray-200">
                              {selName}, {oppName} karşısında
                            </span>
                          </div>
                          <button
                            onClick={() => removeVs(opp)}
                            className="text-[11px] text-gray-500 hover:text-rose-300 transition-colors cursor-pointer"
                          >
                            kaldır
                          </button>
                        </div>
                        <textarea
                          value={text}
                          onChange={(e) => setVs(opp, e.target.value)}
                          rows={4}
                          maxLength={4000}
                          placeholder={`Örn: ${oppName} erken seviyelerde daha güçlü…`}
                          className="w-full px-3 py-2 rounded-lg bg-black/25 border border-edge text-[13px] leading-relaxed text-gray-200 placeholder:text-gray-600 outline-none focus:border-gray-600 resize-y"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

/** Rehberde okunacak bir metin var mı? (boş obje "dolu" sayılmasın) */
function hasText(entry) {
  if (!entry) return false;
  if (entry.play?.trim()) return true;
  return Object.values(entry.vs || {}).some((t) => t?.trim());
}

/** Eşleşme notu için rakip ekleme — zaten notu olanlar ve şampiyonun kendisi listede yok. */
function AddVs({ champs, exclude, onAdd }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = champs
    .filter((c) => !exclude.includes(c.id))
    .filter((c) => !q.trim() || c.name.toLocaleLowerCase("tr").includes(q.trim().toLocaleLowerCase("tr")))
    .slice(0, 40);

  if (!open) return <Button onClick={() => setOpen(true)}>Rakip ekle</Button>;

  return (
    <div className="relative">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Rakip ara…"
        className="w-48 px-3 py-1.5 rounded-lg bg-black/40 border border-edge text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-gray-600"
      />
      <div className="absolute right-0 top-full mt-1 w-56 max-h-72 overflow-y-auto rounded-lg border border-edge bg-[#0a0f1c] shadow-2xl z-30 p-1">
        {list.map((c) => (
          <button
            key={c.id}
            onMouseDown={() => { onAdd(c.id); setOpen(false); setQ(""); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[13px] text-gray-300 hover:bg-hover cursor-pointer"
          >
            <img src={c.image} alt="" width={20} height={20} className="rounded" />
            <span className="truncate">{c.name}</span>
          </button>
        ))}
        {list.length === 0 && <p className="px-2 py-3 text-xs text-gray-600 text-center">sonuç yok</p>}
      </div>
    </div>
  );
}
