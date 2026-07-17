# DEVAM — Kaldığımız Yer (güncel: 2026-07-17)

> Bu dosya **güncel durum + bekleyen işler**. Tamamlanan işlerin kaydı → `YAPILANLAR.md`.
> Kalıcı proje bilgisi → memory dosyaları (`project_*`, `reference_*`, `feedback_*`).

## 🟢 Son durum (2026-07-17)
Bugün: (1) **Key kesintisi teşhis+fix** — 16.14 patch'i 14 Tem'de geldi, aynı gün key öldü →
14-16 Tem maç toplanamadı; yeni key CANLI, `lp:capture` doğrulandı, kaçan maçlar geri doluyor.
(2) **`patch_starts`'a `'16.14' => '2026-07-14'`** eklendi — sunucuya scp basıldı + rebuild;
⚠️ **local'de COMMIT BEKLİYOR** (commit'lenmezse sonraki deploy'un `checkout -f`'i sunucudaki
düzeltmeyi geri alır!). (3) **`ssh graphs-elw`** kısayolu kuruldu (şifresiz, proje dizininde açılır).
Detay → `YAPILANLAR.md` 2026-07-17. Önceki durum (07-13: cache fix + Plaka Savaşı) → `YAPILANLAR.md`.

## ⏳ BEKLEYEN
1. **Riot production key** bekleniyor (App **853618**, Pending Review). Gelince: `ladder:crawl` +
   `matches:collect` + `queue:work` **off-peak cron** → gerçek TR meta (şu an 6 hesap → küçük örneklem).
   ⚠️ Ara ara developer portal **MESSAGES** sekmesini kontrol et (Riot soru sorarsa askıda kalır).
2. **Worker aktivasyonu (Personal key ile, bütçeli) + admin toggle** — kullanıcı istedi (2026-07-17):
   Zümrüt+ taransın, admin panelden aç/kapa olsun, ayrıca admin oturumuyla sitede görünen hızlı bir
   kontrol/durum bölmesi. Plan: `ladder:crawl`'a Emerald+ entries sayfalama (sınırlı sayfa) +
   `matches:collect`'e istek bütçesi (`--budget`) + oyuncu başına son N maç + `AdminSetting`
   `worker_crawl_enabled` toggle + scheduler `->when(...)` + queue çözümü (QUEUE=database →
   pm2 `queue:work` YA DA schedule'da `--stop-when-empty`). ⚠️ Personal key ~100 istek/2dk —
   bütçesiz `matches:collect` ÇALIŞTIRMA (tüm sezon ID'lerini çekip yüzlerce job dispatch eder).
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
