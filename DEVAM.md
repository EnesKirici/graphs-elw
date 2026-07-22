# DEVAM — Kaldığımız Yer (güncel: 2026-07-22)

> Bu dosya **güncel durum + bekleyen işler**. Tamamlanan işlerin kaydı → `YAPILANLAR.md`.
> Kalıcı proje bilgisi → memory dosyaları (`project_*`, `reference_*`, `feedback_*`).
> **Doküman düzeni (2026-07-22):** bekleyen plan dosyaları → `docs/plans/`
> (CHAMPION_BUILD, PROFILE_RANKINGS, CHAMPION_RANKING_METHODOLOGY, WORKER, LIVE_GAME, MERAKI),
> bitmiş/bayat dökümler → `docs/arsiv/`. Kökte yalnız DEVAM + YAPILANLAR kalır.

## 🟢 Son durum (2026-07-22 akşam) — 3 düzeltme (commit `87623c7`, CANLI)
(1) **Rate-limit'te profil boş kalmıyor**: Riot 429 verince maç listesi `match_summaries`'ten
fallback (`getCachedMatchesPaginated`, `fromCache` bayrağı) — hem profil açılışı hem sayfalama.
(2) **Admin mini-bar**: rate-limit göstergesi + worker chip + Panel linki topbar'ın ÜSTÜNDE ince
altın "Admin Modu" şeridine taşındı; header ferahladı, normal kullanıcı görünümü değişmedi.
(3) **puuid mükerrer sorunu**: Riot puuid'leri key/app bazında şifreler → 2026-07-21 key geçişi
6259 mükerrer `cached_players` açtı (aynı isim#tag, iki puuid). Autocomplete artık isim#tag'te
en günceli gösterir; `players:dedupe` komutu eklendi ve çalıştırıldı (6261 kopya silindi).
**⚠️ Production key'e geçince `players:dedupe` TEKRAR çalıştırılmalı** (puuid'ler yine değişir).
404×2 konusu kapandı: `/$` ve `/&` bot URL'siydi, aksiyon gerekmez.
**Devam 2 (`bb9b500`):** (a) **getChampionPositions DB fallback** — Meraki'de olmayan yeni
şampiyonlar (Locke/Zaahen) kendi champion_stats verimizden rol alır (min 20 maç, pay ≥%15,
UTILITY→SUPPORT); Meraki çağrısı artık try/catch'li. (b) Slider: "Yeni Şampiyon" rozetinde #1 yok;
ban ≥%20 ise sayı kırmızı cam-parlaması süpürmeli (hs-ban-hot). (c) **TESTLER ONARILDI: 32/32 yeşil**
— MEDIUMBLOB migration'ı sqlite'ta atlanır (8 feature testi migration'da patlıyordu);
AutocompleteTest (3 regresyon testi) eklendi. Test çalıştırma: `php artisan test` (Herd php84).
**Devam düzeltmeleri (`04df10f`+`693bcfa`):** (a) 429'da profil kaydı artık mevcut rank/rol/mastery'yi
EZMİYOR (tier=null yazımı "Unranked" bırakıyordu); (b) eski maç verilerindeki ESKİ puuid'ler dedupe
sonrası çıplak satırı yeniden doğuruyordu → `cacheParticipant` isim#tag zaten kayıtlıysa satır açmaz;
(c) autocomplete: dolu satır (rank/rol) önce + en yakın isim; (d) HeroCarousel aynı şampiyonu iki
kategoride göstermez (çift Locke); (e) admin mini-bar paint-öncesi `html.is-admin` ile İLK karede
görünür (flash/zıplama yok).

## 🟢 Önceki durum (2026-07-22) — SEO turu (commit `25a50cd`, CANLI)
(1) **Sitemap'e 171 şampiyon sayfası eklendi** (API'den dinamik, günlük revalidate; canlıda 180 URL
doğrulandı). lastModified=now damgası kaldırıldı. (2) **Şampiyon detay metadata zengin**: title'da
ana rol + patch ("Ambessa Build, Rünler ve İstatistikler — Top, Patch 16.14"), description'da
kazanma oranı. (3) **BreadcrumbList JSON-LD** + build sekmesine **SSR özet paragrafı** (gerçek
veriden, "ince içerik" önlemi — 107 "tarandı/dizine eklenmedi" sayfasına karşı). (4) **Admin →
Ayarlar → SEO sekmesi**: 4 statik sayfa + şampiyon-detay şablonu ({name} {position} {patch}
{winrate}) title/description deploy'suz ezme (`seo_overrides` ayarı → publicSettings.seo →
`lib/seo.js` mergeSeo/applySeoTemplate). **Bekleyen:** Search Console'da 404 olan 2 URL'nin
tespiti (Sayfalar → Bulunamadı 404 satırına tıkla) + sitemap'i yeniden gönder; hazır admin paketi
(Filament) bilinçli REDDEDİLDİ — mevcut panel genişletiliyor.

## 🟢 Önceki durum (2026-07-21)
(1) **Riot API key yenilendi** (local+sunucu, test 200). (2) **ROOT SSH açıldı** (key root'a eklendi).
(3) **Disk %79→%56** (journal 3.8G→112M kalıcı 200M limit, apt clean, vscode-server/npm cache;
17 GB boş → taşıma baskısı yok). (4) **Docker OpenVZ'de ÇALIŞIYOR** (sağlayıcı açık bırakmış) →
**Rybbit self-host CANLI: https://a.elw.com.tr** (/opt/rybbit, Caddy'siz, Plesk proxy+SSL,
mem_limit ~2.3G tavan, DISABLE_SIGNUP=true doğrulandı). İzleme script'i frontend'de canlıda
(commit `b1ab536`, yalnız production). Sunucu satın alma İPTAL (Contabo notu memory'de).
⚠️ `docker compose up` bazen "device or resource busy" → tekrar çalıştır / `systemctl restart docker`.
(5) **API throttle CANLI** (10/sn+180/dk IP başına, SSR muaf; config `elwgraphs.api_throttle`) —
arkadaş yük testi sonrası; IP banı YOK (ofis IP paylaşımlı). (6) **DataDragon ikon aynası CANLI**
(`assets:sync`, saatlik cron; 1836 ikon 16MB → /dd, ikon 0.34-1.0s→0.06s; splash'lar ddragon'da;
env: backend `DDRAGON_ASSETS_URL` + front `NEXT_PUBLIC_DD_ASSETS`). (7) API hataları artık hep
JSON (`shouldRenderJsonWhen`) — analytics/batch redirect+CORS gürültüsü bitti. (8) Rybbit bellek
limitleri düzeltildi (CH 1.5g, backend 640m); kullanıcı mesajları rate-limit ekranlarında API
detayı sızdırmıyor; kendini kayıttan çıkarma: `localStorage.setItem('disable-rybbit','1')`.

## 🟢 Önceki durum (2026-07-20)
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
0. **⏰ Rybbit takibi (2026-07-21'den itibaren):** session replay AÇIK → ara ara disk/RAM kontrol
   (`df -h /` + `docker system df` + `free -h`; taban: disk %70/12 GB boş, RAM 1.3G, Rybbit veri 50 MB;
   replay ~0.5-1.5 GB/ay beklenir). Şişerse replay retention/budama kur.
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
