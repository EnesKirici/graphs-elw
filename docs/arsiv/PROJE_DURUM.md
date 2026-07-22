# Proje Durumu & Gelecek Planı (2026-06-24 · triyaj koddan doğrulandı 2026-06-26)

Tüm planlama MD'lerinin **triyajı** (ne yaptık, ne kadar) + **kalan iş**.
> 2026-06-26: Aşağıdaki "YAPILDI" iddiaları kodda tek tek doğrulandı (servis/komut/migration/sayfa
> mevcudiyeti). Tablo gerçeği yansıtıyor; tek güncelleme WORKER_PLAN Aşama 3 satırında (iskelet notu).

> 🟢 CANLI · 🟡 KODLANDI (local, deploy edilmedi) · 🟠 KISMÎ · 🔴 YAPILMADI · 📘 doküman/referans

## MD Triyajı

| MD | Durum | ~% | Not |
|---|---|---|---|
| **WORKER_PLAN.md** | 🟢 CANLI | 80 | 5-hesap LP worker (lp:capture, cron 10dk `routes/console.php`, tracked_players, LpTrackingService). **Aşama 3 (build/ladder) İSKELETİ yazılmış:** `LadderCrawl`/`CollectMatches`/`BuildAggregationService` + `meta_build_ladder_tables` migration var **ama scheduler'a bağlı değil** → production key bekliyor (aktive + incremental aggregation kaldı). |
| **META_TIERLIST_PLAN.md** | 🟡 | 85 | Meta gerçek DB'den (champion_stats) + Wilson/**shrinkage** + **kompozit tier** + admin "veri yetersiz" toggle + maç sayısı. `/tier-list` sayfası hâlâ stat'sız (`/champions`) — meta'ya bağlanabilir. |
| **DB_OPTIMIZATION_PLAN.md** | 🟡 | 85 | `match_summaries` Faz 1+2 kodlandı/test (local). **Items/runes trim** (özet ~%50→%66) + cleanup cron + **deploy** kaldı. |
| **META_DATA_EXPLAINED.md** | 📘 | — | Doküman: meta nasıl hesaplanıyor (küçük/yanlı örneklem). |
| **CHAMPION_RANKING_METHODOLOGY.md** | 🔴 | 0 | Oyuncu-şampiyon sırası (u.gg "şu şampiyonda TR X."). **Tüm-TR veri + production key gerek.** `placeholderChampRank` demo. |
| **PROFILE_RANKINGS_PLAN.md** | 🟠 | 45 | Ladder rank + **peak (✓ bugün düzeltildi: Challenger artık Master sanılmıyor)** + tahmini MMR var. `championRank` YOK (→ üstteki MD). |
| **MERAKI_MIGRATION.md** | 🟠 | 50 | Şampiyon pozisyonları Meraki'den (statik, eski). Worker ile dinamikleşecek. |
| **BACKEND_NOTES_match_details.md** | 🟠 | 60 | Maç detay sekmeleri (Genel/Detaylar/Rünler) var; spell-cast / ping / maç-içi rank / laneDiff15 backend alanları kaldı. |
| **LIVE_CLIENT_SPELL_TRACKING.md** | 🔴 | 0 | Canlı istemci büyü takibi — Live Client API gerek (oyuncunun kendi PC'si). |
| **RIOT_API_ENDPOINTS.md** | 📘 | — | API endpoint referansı. |

## Kalan iş — ŞİMDİ yapılabilir (Personal key yeter / key gerektirmez)
1. **DB-opt items/runes trim** — özet JSON'da eşya/rün ID'lerini sakla, frontend DDragon'dan çözsün → summary ~%50'den ~%66'ya küçülür.
2. **Worker-prewarm** — `lp:capture`'a `ensureSeasonSummaries` ekle → 5 hesabın maç özetleri kimse bakmadan hazır → profilleri anında.
3. **DEPLOY** — DB-opt Faz 1+2 + FAZ 1 (shrinkage/tier) + duo + peak + slider'ı canlıya al; **server'da valid key ile e2e doğrula** (peak/MMR/live-game/duo gerçek veriyle).
4. **/tier-list sayfasını** meta verisine bağla (şu an stat göstermiyor).
5. **FAZ 5 (power spike)** — `match_timelines` verisi (item zamanlama) var; çekirdek-item dakikası grafiği üretilebilir.

## Kalan iş — PRODUCTION KEY sonrası (tüm TR ölçeği)
1. **Tüm-TR worker / `ladder:crawl`** — geniş meta örneklemi (gerçek, yansız tier list) + tüm oyuncuların verisi.
2. **`championRank`** (CHAMPION_RANKING_METHODOLOGY) — oyuncu-şampiyon sırası tüm TR için.
3. **Tahmini MMR + peak + live-game** her profil için (şu an: 5 hesap + açılan profiller; valid key + rate-limit bütçesiyle sınırlı).
4. **MERAKI** positions → worker ile dinamik.
5. Match-details backend alanları (spell-cast/ping — Match-V5).

## Şu an çalışıyor (5 hesap, server'da Personal key ile)
Peak (✓ düzeltildi) · Tahmini MMR (`getAvgGameRank` — rakip ortalama rankı) · LP timeline · **Live-game gerçek** (?mock kaldırıldı) · Duo sinerji · Meta/tier/Wilson.

## NOT — düşülen kapsam
- **FAZ 4 (ELW percentile)** — gereksiz: ladder rank percentile ("Top %0.05") zaten var.
- **FAZ 3 (rank bracket)** — veri yok: maç-başına oyuncu rankı tutmuyoruz (production key + crawler sonrası).
