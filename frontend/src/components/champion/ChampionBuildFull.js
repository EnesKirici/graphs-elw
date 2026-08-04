"use client";

import { Fragment } from "react";
import { itemIcon, runeIconById, runeInfoById } from "@/lib/buildData";
import RoleSelector, { ROLE_LABELS } from "@/components/champion/RoleSelector";

/*
  "Build" sekmesi — TAM liste.

  Genel sekmesi bilerek yalnız çoğunluğu gösteriyor (en popüler rün sayfası, ilk 2
  sihirdar çifti, slot başına 3 eşya). Karar verecek kadarı orada; ama "3. eşyada
  ikinci en iyi ne?" diye soran oyuncunun gideceği bir yer gerekiyordu — burası o
  yer. Her tablo aynı kalıpta: seçenek · seçim oranı · kazanma oranı · maç sayısı.

  ÖRNEKLEM HER SATIRDA GÖRÜNÜR. Uzun kuyrukta %70 kazanma oranlı bir seçenek 9 maça
  dayanıyor olabilir; maç sayısını göstermeden sıralamak okuyucuyu yanıltır.
*/

const SPELL_IDX = { Q: 0, W: 1, E: 2, R: 3 };
const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");
const TL_MIN_SAMPLE = 20;

function Panel({ title, extra, children }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge/40 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
        {extra}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Ortak tablo iskeleti — sol hücre serbest (ikon/isim), sağda üç sayı sütunu. */
function StatTable({ rows, renderCell, label = "Seçenek" }) {
  const total = rows.reduce((s, r) => s + (r.games || 0), 0);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] text-gray-600 uppercase tracking-wider border-b border-edge/40">
          <th className="font-medium text-left pb-2">{label}</th>
          <th className="font-medium text-right pb-2 w-24">Seçim</th>
          <th className="font-medium text-right pb-2 w-20">Kazanma</th>
          <th className="font-medium text-right pb-2 w-16">Maç</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-edge/25">
        {rows.map((r, i) => (
          <tr key={r.key ?? i} className="hover:bg-hover transition-colors">
            <td className="py-2">{renderCell(r, i)}</td>
            <td className="py-2 text-right">
              <div className="flex items-center justify-end gap-2">
                {/* İnce bar: sayıya bakmadan "bu seçenek ne kadar baskın" okunsun */}
                <span className="hidden sm:block h-1 w-12 rounded-full bg-edge/60 overflow-hidden">
                  <span className="block h-full bg-blue-400/60" style={{ width: `${Math.min(r.pickRate, 100)}%` }} />
                </span>
                <span className="text-gray-400 tabular-nums">{r.pickRate}%</span>
              </div>
            </td>
            <td className={`py-2 text-right font-bold tabular-nums ${wrCls(r.winRate)}`}>{r.winRate}%</td>
            <td className="py-2 text-right text-gray-600 tabular-nums">{(r.games ?? 0).toLocaleString("tr-TR")}</td>
          </tr>
        ))}
      </tbody>
      {total > 0 && (
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-2 text-[10px] text-gray-600">
              Toplam {total.toLocaleString("tr-TR")} maç
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function ItemCell({ id, version, names }) {
  const name = names[String(id)];
  return (
    <div className="flex items-center gap-2 min-w-0">
      <img src={itemIcon(version, id)} alt={name || ""} width={28} height={28}
        className="rounded-md border border-edge shrink-0" onError={hideOnError} />
      <span className="text-gray-200 truncate">{name || `#${id}`}</span>
    </div>
  );
}

export default function ChampionBuildFull({ champion, version, runesData = [], build, role, onRole }) {
  const positions = build?.positions || [];
  const posInfo = positions.find((p) => p.position === role);
  const cats = build?.byPosition?.[role] || {};
  const names = build?.itemNames || {};
  const samples = cats._samples || {};

  if (!positions.length) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300 font-medium">Henüz yeterli maç verisi yok</p>
      </div>
    );
  }

  const keystones = (cats.keystone || []).filter((k) => runeIconById(runesData, Number(k.key)));
  const spellPairs = cats.spell_pair || [];
  const skillOrders = ((samples.skill_order || 0) >= TL_MIN_SAMPLE && cats.skill_order) || [];
  const starters = ((samples.starter || 0) >= TL_MIN_SAMPLE && cats.starter) || [];
  const slots = (samples.item_slot1 || 0) >= TL_MIN_SAMPLE
    ? [1, 2, 3, 4, 5].map((n) => ({ n, list: cats[`item_slot${n}`] || [] })).filter((s) => s.list.length)
    : [];
  const fullItems = cats.item_full || [];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl overflow-hidden">
        <RoleSelector positions={positions} role={role} onRole={onRole} />
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-2xl">
            <b className="text-gray-300">{champion.name}</b> için {ROLE_LABELS[role] || role} koridorunda kayıtlı
            <b className="text-gray-300"> tüm</b> seçenekler. Genel sekmesi yalnız en çok tercih edileni gösterir;
            burada uzun kuyruk da var — her satırda maç sayısı yazılı, çünkü az maçlı yüksek kazanma oranı
            gerçek bir üstünlük değil, gürültü olabilir.
          </p>
          {posInfo && (
            <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
              {(posInfo.games ?? 0).toLocaleString("tr-TR")} maç · %{posInfo.winRate} kazanma
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Ana Rünler" extra={<span className="text-[10px] text-gray-600">Tüm oynanan keystone'lar</span>}>
          {keystones.length ? (
            <StatTable
              label="Keystone"
              rows={keystones}
              renderCell={(k) => {
                const info = runeInfoById(runesData, Number(k.key));
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={runeIconById(runesData, Number(k.key))} alt="" width={28} height={28}
                      className="rounded-full shrink-0" onError={hideOnError} />
                    <span className="text-gray-200 truncate">{info?.name || `#${k.key}`}</span>
                    {info?.tree && <span className="text-[10px] text-gray-600 shrink-0">{info.tree}</span>}
                  </div>
                );
              }}
            />
          ) : (
            <p className="text-[11px] text-gray-600">Rün verisi yok.</p>
          )}
        </Panel>

        <Panel title="Sihirdar Büyüleri" extra={<span className="text-[10px] text-gray-600">Tüm kombinasyonlar</span>}>
          {spellPairs.length ? (
            <StatTable
              label="Çift"
              rows={spellPairs}
              renderCell={(sp) => {
                const icons = String(sp.key).split("-").map((sid) => build?.spellMap?.[sid]).filter(Boolean);
                return (
                  <div className="flex items-center gap-2">
                    {icons.map((s, i) => (
                      <img key={i} src={s.image} alt={s.name} title={s.name} width={26} height={26}
                        className="rounded border border-edge" onError={hideOnError} />
                    ))}
                    <span className="text-gray-300 truncate">{icons.map((s) => s.name).join(" + ")}</span>
                  </div>
                );
              }}
            />
          ) : (
            <p className="text-[11px] text-gray-600">Büyü verisi yok.</p>
          )}
        </Panel>

        <Panel title="Yetenek Sırası" extra={<span className="text-[10px] text-gray-600">Maks öncelik sırası</span>}>
          {skillOrders.length ? (
            <StatTable
              label="Sıra"
              rows={skillOrders}
              renderCell={(o) => (
                <div className="flex items-center gap-1.5">
                  {String(o.key).split(">").map((L, i, arr) => (
                    <Fragment key={i}>
                      <div className="relative">
                        <img src={champion.spells?.[SPELL_IDX[L]]?.image} alt={L} width={28} height={28}
                          className="rounded border border-edge" onError={hideOnError} />
                        <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-blue-300">{L}</span>
                      </div>
                      {i < arr.length - 1 && <span className="text-gray-600">›</span>}
                    </Fragment>
                  ))}
                </div>
              )}
            />
          ) : (
            <p className="text-[11px] text-gray-600">Yetenek sırası verisi toplanıyor.</p>
          )}
        </Panel>

        <Panel title="Başlangıç Eşyaları" extra={<span className="text-[10px] text-gray-600">İlk satın alma</span>}>
          {starters.length ? (
            <StatTable
              label="Kombinasyon"
              rows={starters}
              renderCell={(s) => {
                const counts = {};
                String(s.key).split("-").forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    {Object.entries(counts).map(([id, n]) => (
                      <div key={id} className="relative shrink-0">
                        <img src={itemIcon(version, id)} alt={names[id] || ""} title={names[id]} width={28} height={28}
                          className="rounded border border-edge" onError={hideOnError} />
                        {n > 1 && (
                          <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-gray-300">×{n}</span>
                        )}
                      </div>
                    ))}
                    <span className="text-gray-300 text-[11px] truncate">
                      {Object.keys(counts).map((id) => names[id]).filter(Boolean).join(" + ")}
                    </span>
                  </div>
                );
              }}
            />
          ) : (
            <p className="text-[11px] text-gray-600">Başlangıç verisi toplanıyor.</p>
          )}
        </Panel>
      </div>

      {/* Eşya slotları — her biri kendi paneli, tam alternatif listesiyle */}
      {slots.map(({ n, list }) => (
        <Panel
          key={n}
          title={`${n}. Eşya — Tüm Alternatifler`}
          extra={<span className="text-[10px] text-gray-600">Tamamlanma sırasına göre</span>}
        >
          <StatTable
            label="Eşya"
            rows={list}
            renderCell={(it) => <ItemCell id={it.key} version={version} names={names} />}
          />
        </Panel>
      ))}

      <Panel title="Maç Sonu Envanteri" extra={<span className="text-[10px] text-gray-600">En sık bitirilen eşyalar</span>}>
        <StatTable
          label="Eşya"
          rows={fullItems}
          renderCell={(it) => <ItemCell id={it.key} version={version} names={names} />}
        />
      </Panel>

      <p className="text-[11px] text-gray-600 text-center pt-1">
        Tüm veriler Emerald+ dereceli maçlardan derlenir · Patch {(build.patches || []).join(" + ")}
      </p>
    </div>
  );
}
