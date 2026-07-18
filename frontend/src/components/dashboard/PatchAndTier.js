/*
  Patch değişimleri (▲ Yükselen / ▼ Düşen) + Meta Tier List.
  Kaynak: /meta/dashboard champions[] (wrChange ve tier alanlarından türetilir).
*/
import { ChampPortrait, RoleBadge, ChangeChip, TierBadge } from "./primitives";

function deriveChanges(champions) {
  const withChange = champions.filter((c) => typeof c.wrChange === "number" && c.wrChange !== 0);
  const rising = withChange.filter((c) => c.wrChange > 0).sort((a, b) => b.wrChange - a.wrChange).slice(0, 5);
  const falling = withChange.filter((c) => c.wrChange < 0).sort((a, b) => a.wrChange - b.wrChange).slice(0, 5);
  return { rising, falling };
}

function deriveTiers(champions) {
  const groups = { S: [], A: [], B: [] };
  for (const c of champions) {
    if (c.tier === "S+" || c.tier === "S") groups.S.push(c);
    else if (c.tier === "A") groups.A.push(c);
    else if (c.tier === "B") groups.B.push(c);
  }
  for (const k of Object.keys(groups)) {
    groups[k] = groups[k].sort((a, b) => b.winRate - a.winRate).slice(0, 6);
  }
  return groups;
}

function PatchRow({ champ }) {
  return (
    <a className="patch-row" href={`/champions/${champ.id}`}>
      <ChampPortrait name={champ.name} image={champ.image} size={30} />
      <div className="elw-row" style={{ gap: 8, minWidth: 0 }}>
        <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{champ.name}</b>
        <span className="pr-role"><RoleBadge role={champ.positions} /></span>
      </div>
      <ChangeChip value={champ.wrChange} />
    </a>
  );
}

export default function PatchAndTier({ champions = [], patch, patchChanges }) {
  const { rising, falling } = deriveChanges(champions);
  const tiers = deriveTiers(champions);
  // Backend önceki patch örneklemini yetersiz bulduysa wrChange üretmez → listeler boş
  // kalır ve aşağıdaki not gösterilir. Yeni patch'te otomatik dolar.
  const insufficient = patchChanges && !patchChanges.sufficient;

  return (
    <div className="section two-col" data-reveal style={{ "--d": 200 }}>
      {/* Patch changes */}
      <div className="card pad">
        <div className="section-head" style={{ marginBottom: 16 }}>
          <h2>Patch {patch} Değişimleri</h2>
        </div>
        {insufficient || (rising.length === 0 && falling.length === 0) ? (
          <p className="muted" style={{ fontSize: 13, padding: "6px 0", lineHeight: 1.5 }}>
            Patch değişimleri, önceki yamanın verisiyle karşılaştırılarak hesaplanır.
            {patchChanges?.prevPatch
              ? ` Önceki yama (${patchChanges.prevPatch}) için henüz yeterli maç toplanmadı` +
                (patchChanges.prevGames ? ` (${patchChanges.prevGames} maç)` : "") + "."
              : " Önceki yamaya ait veri henüz yok."}
            {" "}Bir sonraki yamada bu bölüm otomatik olarak dolacak.
          </p>
        ) : (
          <div className="patch-grid">
            <div>
              <div className="patch-head up">▲ Yükselen</div>
              {rising.map((c) => <PatchRow key={c.id} champ={c} />)}
            </div>
            <div>
              <div className="patch-head down">▼ Düşen</div>
              {falling.map((c) => <PatchRow key={c.id} champ={c} />)}
            </div>
          </div>
        )}
      </div>

      {/* Tier list */}
      <div className="card pad">
        <div className="section-head" style={{ marginBottom: 16 }}>
          <h2><span className="dot-mark" />Meta Tier List</h2>
          <span className="tag">Tüm roller</span>
        </div>
        <div className="tier-board">
          {["S", "A", "B"].map((t) => (
            <div key={t} className="tier-line">
              <div className="tl-rank"><TierBadge tier={t} /></div>
              <div className="tier-champs">
                {tiers[t].map((c) => (
                  <a key={c.id} className="tier-champ" href={`/champions/${c.id}`}>
                    <ChampPortrait name={c.name} image={c.image} size={42} />
                    <small>{c.name}</small>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
