# DEVAM — Kaldığımız Yer (güncel: 2026-07-20)

> Bu dosya **güncel durum + bekleyen işler**. Tamamlanan işlerin kaydı → `YAPILANLAR.md`.
> Kalıcı proje bilgisi → memory dosyaları (`project_*`, `reference_*`, `feedback_*`).

## 🟢 Son durum (2026-07-20)
**matches+timelines GZIP CANLI** (`GzipJson` cast + MEDIUMBLOB + `matches:compress --optimize`):
matches 585.5→104.7 MB (%82), timelines 4.0→0.4 MB; günlük büyüme ~215→~40 MB → disk krizi
(%80 doluluk) ~6 ay ertelendi. Round-trip birebir, stats:rebuild sorunsuz, API 200 ~0.2s.
Worker deploy sırasında kapatılıp geri açıldı. MongoDB önerisi reddedildi (erişim deseni
blob-store; kazanç yok). **Sunucu kararı bekliyor:** mevcut OpenVZ+4GB'a Rybbit KURULAMAZ
(Docker yok); öneri TR-VPS5 (6GB, 515₺/ay, önce KVM teyidi) → memory `project_server_migration`.

## 🟢 Önceki durum (2026-07-17)
Bugün: (1) **Key kesintisi teşhis+fix** (14-16 Tem 401'leri; yeni key CANLI, kaçanlar geri doldu).
(2) **`patch_starts` 16.14** eklendi (commit `6953bb5`, canlıda). (3) **`ssh graphs-elw`** kısayolu.
(4) **META WORKER CANLI & AÇIK** (`b178059`+`13c9cd7`): Zümrüt+ ladder tarama (havuz 7.803 oyuncu) +
bütçeli maç toplama (tur ~40 maç, 10dk cron) + `/admin/worker` paneli + navbar WorkerChip (admin'e
görünür aç/kapa) + 429 toast + user-yield. İlk tur doğrulandı: 34 maç tier damgalı girdi, 16.14
penceresi 1→35 maç. Detay → `YAPILANLAR.md` 2026-07-17.

## ⏳ BEKLEYEN
1. **Riot production key** bekleniyor (App **853618**, Pending Review). Gelince: worker bütçelerini
   büyüt (config `elwgraphs.worker`: match_budget, entry_pages_per_division, --players) + supervisor
   `queue:work`. ⚠️ Ara ara developer portal **MESSAGES** sekmesini kontrol et.
2. **Kullanıcıya elo filtresi** (dashboard/tier-list "hangi elodan istatistik", default Tümü) —
   veri altyapısı HAZIR (`matches.tier_bucket` damgalı birikiyor). Kalan: `champion_stats`'a
   tier kırılımı (rebuild'de `tier_bucket` gruplaması) + endpoint `?tier=` + frontend seçici.
   Veri birikince yap (şu an tek günlük damga var).
3. **LP grafik** — kullanıcı prompt yazacaktı.
4. **config `meta.patch_starts`** — SONRAKİ patch çıkınca (yama notlarından) 1 satır tarih ekle
   (16.14 eklendi ✓). Yalnız eski gameVersion'sız maçları patch'e atamak + prune eşiği için;
   yeni maçlar gameVersion taşır. `keptPatches` DataDragon'dan → pencere otomatik kayar.
5. **Prune YAPMA (kullanıcı kararı 2026-07-17):** eski patch maçları (16.12: 543) SİLİNMEYECEK —
   patch-karşılaştırma (wrChange) için tarihsel veri lazım. Zaten kritik: `stats:rebuild` her saat
   `matches`'ten TAM yeniden hesap yapıyor → maç silinirse eski patch istatistikleri de kaybolur.
   (Prune otomasyonu ancak incremental aggregation'a geçilirse gündeme alınır.) Ayrıca (DB_OPT'tan
   kalan) **6 ay+ eski `match_summaries` cleanup cron'u** — DB büyüyünce; acil değil.
6. **(Opsiyonel) `BuildAggregationService`** aynı gameVersion patch-scoping'e geçmeli (builds için, aynı
   latent bug — eski maçlar current'a yığılıyor). Meta hattı düzeldi, builds hattı henüz değil.
7. **(Opsiyonel) IndexNow** kurulumu. Search Console sitemap gönderimi → YAPILDI.
8. **(Opsiyonel) Mail SSL** — Let's Encrypt reissue (webmail dahil) + Mail Server Settings. Şu an SSL kapalı
   çalışıyor; acil değil.

## 🧩 Önemli teknik notlar
- **Deploy:** GitHub push → Plesk bare push (`ssh://elw@178.251.238.161/.../git/graphs-elw.git`) → deploy
  dizinine `git --git-dir=~/git/graphs-elw.git --work-tree=~/elwgraphs.elw.com.tr checkout -f master` →
  backend `config:clear`/`route:clear`/`cache:clear` (**config:cache YAPMA** — key tuzağı) → frontend
  `npm run build`+`pm2 restart` → gerekiyorsa `summaries:flush`. Detay: memory `project_deployment`.
- **PHP local:** `$HOME/.config/herd/bin/php.bat`. Sunucu: `/opt/plesk/php/8.4/bin/php`, node22
  `/opt/plesk/node/22/bin`, pm2 `~/.npm-global/bin/pm2`.
- **Sunucu DB (canlı):** MariaDB 10.6, `mysql -u<DB_USERNAME> -p<DB_PASSWORD> <DB_DATABASE>` (creds
  `~/elwgraphs.elw.com.tr/backend/.env`). Meta sayaçları: `php artisan stats:rebuild`.
- **Local Riot key EXPIRED** → canlı fetch/rank local'de çalışmaz; gerçek test SUNUCUDA (Personal key).
- **Test profili:** dev :3000, `/summoner/elw/0000`. **5 takip hesabı:** elw#0000, nurayore#amare,
  elwyore#amare, "1v9 acc"#mhm, kirai#mid.
- **Skor değişince:** `ALGO_VERSION` bump + `summaries:flush` ŞART (şu an 13, sabit).
- **Commit:** görev başına parça parça; her commit sonu `Co-Authored-By: Claude Opus 4.8`.
- **Çalışma tarzı:** acele etme, dikkatli, artık kod bırakma; büyük/anlam-değiştiren kararları SOR.

## ⚠️ DEV SERVER / OOM NOTU
`live-game?mock=1` (en ağır SSR: 10 kart + radar + splash) boş RAM yetmezse **OOM ile 500** verebilir
("Jest worker … exceeding retry limit"). Kod hatası DEĞİL — Next SSR worker'ını OS öldürüyor. Çözüm:
belleği boşalt + dev server'ı temiz yeniden başlat. Production build'de (worker yok) olmaz.
