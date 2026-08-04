"use client";

import Link from "next/link";
import { profileIcon } from "@/lib/buildData";

/*
  Şampiyonun en çok oynayan oyuncuları — bir SIRALAMA tablosu.

  Serbest ızgara denendi ve kötüydü: sıra/maç/kazanma farklı hizalarda yüzen
  sayılardı, hangisinin ne olduğu belli değildi. Burası bir liderlik tablosu, o
  yüzden sütun başlıkları, madalyalı ilk üç sıra ve tek satırda okunabilen bir
  düzen var.

  USTALIK PUANI ŞU AN ÖRNEK VERİDİR. Gerçeği Riot'un champion-mastery ucundan
  oyuncu başına 1 istekle gelir; dev anahtarın kotası zaten dar olduğu için
  (prod anahtar bekleniyor) şimdilik oynanan maçtan TÜRETİLİYOR ve tablo
  görünür biçimde "örnek veri" diyor — sahte sayıyı gerçekmiş gibi göstermek
  ziyaretçiyi yanıltırdı. Gerçek veriye geçince mockMastery + not silinir.
*/

const MEDAL = ["text-amber-300", "text-gray-300", "text-orange-400"];

// Ustalık seviyesi eşikleri (oyunun kendi eşikleri): 1-3 arası düşük, 4+ ciddi oyuncu.
const MASTERY_LEVEL = (pts) => (pts >= 500000 ? 10 : pts >= 200000 ? 9 : pts >= 100000 ? 8 : pts >= 50000 ? 7 : pts >= 21600 ? 6 : 5);

/*
  Deterministik yer tutucu: aynı oyuncu her sayfa yenilemesinde aynı sayıyı görsün
  (Math.random olsaydı her istekte değişir, "veri oynak" izlenimi verirdi).
  Maç başına ~1.500 puan gerçekçi bir orandır; isimden türeyen sapma listeyi
  tekdüze olmaktan çıkarır.
*/
function mockMastery(name, games) {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const spread = 0.6 + ((h % 1000) / 1000) * 1.8; // 0.6x - 2.4x
  return Math.round(((games || 1) * 1500 * spread) / 100) * 100;
}

const fmtPts = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

export default function ChampionTopPlayers({ players, version }) {
  if (!players?.length) {
    return (
      <p className="text-[11px] text-gray-600 leading-relaxed py-2">
        Bu şampiyon için henüz yeterli oyuncu verisi toplanmadı.
      </p>
    );
  }

  const rows = players.map((p, i) => ({
    ...p,
    rank: i + 1,
    mastery: mockMastery(p.name, p.games),
  }));
  const half = Math.ceil(rows.length / 2);
  const cols = rows.length > 5 ? [rows.slice(0, half), rows.slice(half)] : [rows];
  const hasTier = rows.some((p) => p.tier);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
        {cols.map((col, ci) => (
          <table key={ci} className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-600 uppercase tracking-wider border-b border-edge/40">
                <th className="font-medium text-left pb-2 w-7">#</th>
                <th className="font-medium text-left pb-2">Oyuncu</th>
                {hasTier && <th className="font-medium text-right pb-2 hidden md:table-cell">Derece</th>}
                <th className="font-medium text-right pb-2 w-20">Ustalık</th>
                <th className="font-medium text-right pb-2 w-12">Maç</th>
                <th className="font-medium text-right pb-2 w-16">Kazanma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/25">
              {col.map((p) => (
                <tr key={`${p.name}-${p.tag}`} className="group hover:bg-hover transition-colors">
                  <td className={`py-2 font-bold tabular-nums ${MEDAL[p.rank - 1] || "text-gray-600"}`}>{p.rank}</td>
                  <td className="py-2">
                    <Link
                      href={`/summoner/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag || "")}`}
                      className="flex items-center gap-2 min-w-0"
                      title={`${p.name}#${p.tag}`}
                    >
                      {p.profileIconId != null ? (
                        <img src={profileIcon(version, p.profileIconId)} alt="" width={26} height={26}
                          className="rounded-md border border-edge shrink-0"
                          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                      ) : (
                        <span className="w-[26px] h-[26px] rounded-md bg-edge/50 border border-edge shrink-0" />
                      )}
                      <span className="text-gray-200 truncate group-hover:text-white transition-colors">{p.name}</span>
                    </Link>
                  </td>
                  {hasTier && (
                    <td className="py-2 text-right text-[10px] text-gray-500 hidden md:table-cell">
                      {p.tier ? `${p.tier.charAt(0)}${p.tier.slice(1).toLowerCase()}${p.rank ? ` ${p.rank}` : ""}` : "—"}
                    </td>
                  )}
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[9px] font-bold text-violet-300/90 bg-violet-500/10 border border-violet-400/20 rounded px-1 leading-[14px]">
                        {MASTERY_LEVEL(p.mastery)}
                      </span>
                      <span className="text-gray-300 tabular-nums">{fmtPts(p.mastery)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right text-gray-400 tabular-nums">{p.games}</td>
                  <td
                    className={`py-2 text-right font-bold tabular-nums ${
                      p.winRate >= 52 ? "text-blue-300" : p.winRate >= 49 ? "text-gray-200" : "text-red-400"
                    }`}
                  >
                    {p.winRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {/* Sahte sayıyı gerçekmiş gibi göstermemek için görünür uyarı. */}
      <p className="text-[10px] text-gray-600 mt-3 pt-2.5 border-t border-edge/30">
        Sıralama ve maç sayıları gerçek veridir.{" "}
        <span className="text-amber-400/80">Ustalık puanları şimdilik örnek veridir</span> — Riot ustalık ucu
        prod anahtarla bağlanınca gerçek değerlerle değişecek.
      </p>
    </div>
  );
}
