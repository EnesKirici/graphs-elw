/*
  Öne Çıkan Oyuncular — challenger leaderboard ilk 5.
  Kaynak: /leaderboard?tier=challenger (entries: name, topChamps, topRoles, lp, winRate, hotStreak).
  Tasarımdaki "+N W" serisi yerine gerçek hotStreak/win-rate rozeti.
*/
import { ChampPortrait, RoleBadge, initialsOf, pctTR } from "./primitives";

function tierLabel(t) {
  if (!t) return "";
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export default function Players({ entries }) {
  const list = Array.isArray(entries) ? entries.slice(0, 5) : [];

  return (
    <div className="section" data-reveal style={{ "--d": 240 }}>
      <div className="card pad">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <h2><span className="dot-mark" />Öne Çıkan Oyuncular</h2>
          <span className="tag">TR1</span>
        </div>

        {list.length === 0 ? (
          <p className="dim" style={{ fontSize: 13, padding: "16px 4px" }}>
            Oyuncu sıralaması şu anda yüklenemedi. Kısa süre sonra tekrar deneyin.
          </p>
        ) : (
          <div className="players">
            {list.map((p, i) => {
              const name = p.name?.gameName || "Bilinmeyen";
              const tag = p.name?.tagLine;
              const role = p.topRoles?.[0]?.role;
              const href = tag ? `/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}` : undefined;
              const Row = href ? "a" : "div";
              return (
                <Row key={p.puuid || i} className="player-row" {...(href ? { href } : {})}>
                  <span className="rank-no num">{p.rank ?? i + 1}</span>
                  <ChampPortrait name={name} image={p.profileIcon} initials={initialsOf(name) || name[0]?.toUpperCase()} size={40} round />
                  <div className="player-name">
                    <b>
                      {name} {tag && <span>#{tag}</span>}
                    </b>
                    {role && <RoleBadge role={role} />}
                  </div>
                  <div className="player-rank">
                    {tierLabel(p.tier)} {p.lp != null && <span className="lp">{p.lp} LP</span>}
                  </div>
                  {p.winRate != null && <span className="streak">{pctTR(p.winRate)}</span>}
                </Row>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
