# DEVAM — Kaldığımız Yer (güncel: 2026-07-08)

> Bu dosya **güncel durum + bekleyen işler**. Tamamlanan işlerin kaydı → `YAPILANLAR.md`.
> Kalıcı proje bilgisi → memory dosyaları (`project_*`, `reference_*`, `feedback_*`).

## 🟢 Son durum (2026-07-08) — hepsi canlıda, doğrulandı
Meta artık gerçek patch'e oturdu: `matches` kaydına **gameVersion** eklendi, **PatchService** patch
mantığını topladı (gameVersion→yoksa tarih; `keptPatches` DataDragon'dan otomatik), meta **güncel+önceki
patch birleşik** (~625 maç → listeler dolu), **`matches:prune`** eski maçları temizledi (2417→725).
Locke yeni-şampiyon fix + "Beta sürüm" pill canlıda. Riot **production key başvurusu** yapıldı
(App 853618, Pending Review). Detaylar: `YAPILANLAR.md` (2026-07-08).

## ⏳ BEKLEYEN
1. **Riot production key** bekleniyor (App **853618**, Pending Review). Gelince: `ladder:crawl` +
   `matches:collect` + `queue:work` **off-peak cron** → gerçek TR meta (şu an 6 hesap → küçük örneklem).
   ⚠️ Ara ara developer portal **MESSAGES** sekmesini kontrol et (Riot soru sorarsa askıda kalır).
2. **LP grafik** — kullanıcı prompt yazacaktı.
3. **config `meta.patch_starts`** — yeni patch çıkınca (yama notlarından) 1 satır tarih ekle. Bu yalnız
   eski gameVersion'sız maçları patch'e atamak + prune eşiği için; yeni maçlar zaten gameVersion taşır.
   `keptPatches` DataDragon'dan geldiği için pencere otomatik kayar.
4. **(Opsiyonel) prune otomasyonu + cleanup:** `matches:prune --force`'u cron'a bağla → patch kayınca
   kendiliğinden temizler (patch-bazlı siler, yaşa göre değil; güvenli). Şu an elle. Ayrıca (DB_OPT'tan kalan
   tek madde) **6 ay+ eski `match_summaries` cleanup cron'u** — DB büyüyünce; şu an DB küçük, acil değil.
5. **(Opsiyonel) `BuildAggregationService`** aynı gameVersion patch-scoping'e geçmeli (builds için, aynı
   latent bug — eski maçlar current'a yığılıyor). Meta hattı düzeldi, builds hattı henüz değil.
6. **(Opsiyonel) IndexNow** kurulumu. Search Console sitemap gönderimi → YAPILDI.
7. **(Opsiyonel) Mail SSL** — Let's Encrypt reissue (webmail dahil) + Mail Server Settings. Şu an SSL kapalı
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
