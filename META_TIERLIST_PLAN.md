# Meta Tier List + Şampiyon Build Sayfası (PLANLANAN)

> Durum: **Tier list TEST verisi ile çalışıyor** (`/tier-list`). Şampiyon build/detay
> verisi (rün/item/build/matchup/top players) **henüz yok** — yapılacak.
> Riot API bunların HİÇBİRİNİ vermiyor; hepsi Match-V5 ham maçlarının toplanmasıyla üretilir.

## Riot API durumu (araştırıldı, Haziran 2026)
- Riot API'de **tier list / win rate / pick rate / ban rate / build / matchup endpoint'i YOK.**
- op.gg, u.gg, metasrc, leagueofgraphs vb. hepsi **Match-V5 ham maçlarını** geniş örneklemle
  çekip kendi DB'lerinde topluyor (patch + rank + region filtreli agregasyon).
- Elimizdeki kaynaklar: **DataDragon** (statik şampiyon: yetenek, skin, base stat, tags,
  positions) + **Match-V5** (ham maç). Meta istatistiği = bizim agregasyonumuz.

## 1. Meta Tier List — `/tier-list` (YAPILDI, test verisi)
- Sayfa: `frontend/src/app/(site)/tier-list/page.js` → `/champions` (DataDragon) çeker.
- Bileşen: `frontend/src/components/champion/TierList.js` — rol filtresi (Top/Jungle/Mid/ADC/Sup),
  öne çıkan şampiyon (açıklama + WR/Pick/Ban), S/A/B/C/D tier satırları, **hover kartı**
  (WR/Pick/Ban + counter'lar + Build/Rehber/Counterlar linkleri).
- Test verisi: `frontend/src/lib/tierData.js` → `champStats`, `buildRoleTiers`, `champCounters`
  şampiyon+rol+patch'ten deterministik üretir.
- **Gerçeği için gereken:** Match-V5 agregasyonu → şampiyon×rol×patch için games/wins/picks/bans.
  `champion_stats` tablosu (zaten iskelet var, [[project_worker_plan]]) genişletilmeli:
  pickRate (rol maç sayısı / toplam), banRate (ban verisi maç detayında `bans`'ta var),
  tier skoru. Rol ataması maçtaki teamPosition'dan (şu an DataDragon positions/tags fallback).

## 2. Şampiyon Build / Detay Sayfası — `/champions/[id]` (YAPILACAK)
op.gg build sayfası tarzı; mevcut detay sayfasına (yetenek/skin/hikaye var) eklenecek:
- **Rünler** (en popüler + alternatifler), **Summoner Spells**
- **Itemler**: Starter / Early / Core / Full Build (time target'lı) + Situational
- **Ability order** (Q>E>W max sırası, 1-18 seviye)
- **Matchup** (iyi/kötü eşleşmeler, WR'li) — counter verisi
- **Top players** (o şampiyonu en iyi oynayanlar, OTP'ler + WR)
- **Önerilen buildler** = en çok alınan buildler (Most Popular / 2nd / Alternative / Off-Meta)
- **Gerçeği için gereken:** Match-V5'ten o şampiyonun maçlarında item/rune/spell/skill-order
  frekansları + kazanma oranları; OTP listesi için yüksek-maç+yüksek-WR oyuncu taraması.
  Hepsi worker + DB. Şimdilik test verisiyle UI kurulacak.

## Notlar
- Bölge/rank/patch filtreleri dinamik olmalı (şu an statik gösterim).
- Test fonksiyonları `placeholder*` / `tierData` ile işaretli; gerçek veri gelince değiştir.
- İlişki: [[project_worker_plan]], `WORKER_PLAN.md` Aşama 2; [[project_profile_rankings]].
