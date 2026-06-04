# Profil — Sıralama / Percentile Verileri (PLANLANAN)

> Durum: **Frontend'de TEST VERİSİ (placeholder) ile gösteriliyor.** Gerçek veriler
> DB + worker gerektiriyor. Bu doküman, hangi verinin nereden geleceğini ve şu an
> nerede sahte veri ürettiğimizi not eder ki unutulmasın.

Kaynak ilham: op.gg profil sayfası (Personal Ratings + champion ranks).

---

## 1. Oyuncu ladder sıralaması (Solo/Duo & Flex)
**İstenen:** Her rank bloğunda "Top %X" + hover'da **Dünya sırası** ve **TR sırası**
(op.gg: `Rank: 2,889,612 (TR: 149,394) — Top 32%`).

- **Şu an:** `frontend/src/components/summoner/RankCard.js` →
  `placeholderLeagueRank(data)` tier+rank+LP'den deterministik makul değer üretiyor.
  "Top %X" görünür, dünya/TR hover tooltip'inde.
- **Gerçeği için gereken:**
  - Tüm oyuncuların (en azından TR + global örneklem) tier/LP snapshot'ı → ladder
    pozisyonu hesaplanmalı. Riot **League-EXP / apex league** endpoint'leri + kendi
    crawler'ımızla bölge oyuncu dağılımı.
  - `percentile = oyuncununAltındakiOyuncuSayısı / toplam`. Tier+division+LP'yi mutlak
    puana çevir (zaten `lpToAbsolute` var), dağılıma göre yüzdelik bul.
  - DB: bölge bazlı tier/LP histogramı (periyodik worker ile güncellenen). Tek tek tüm
    oyuncuları tutmak yerine **histogram/bucket** yeterli (LP bazında kümülatif sayım).

## 2. Ortalama Rakip Seviyesi (son 10 maç)
**İstenen:** "Average Enemies Rating (Last 10 matches): Platinum I" — son 10 maçtaki
rakiplerin ortalama rankı.

- **Şu an:** `RankCard.js` → `AvgEnemiesRating()` sabit "Platinum I" (test).
- **Gerçeği için gereken:**
  - Son 10 maçın her birindeki 5 rakip oyuncunun o anki/again güncel solo rank'ı.
  - Rakip puuid'leri maç detayında var; her biri için ranked bilgisi çekmek pahalı
    (10 maç × 5 rakip = 50 league isteği). → rakip rank'larını **cache/DB**'de tut,
    worker ile batch çek. Ortalamayı mutlak puan üzerinden al, tier'a geri çevir.

## 3. Şampiyon dünya/TR sıralaması (En Çok Oynanan)
**İstenen:** En çok oynanan listesinde her şampiyon için **Dünya** ve **TR** sırası
(op.gg: `Lucian — Rank: 54,554 (TR: 4,133)`). O şampiyonu en çok oynayanlar arasında
oyuncunun yeri (mastery puanı / oynanış bazlı).

- **Şu an:** `frontend/src/components/summoner/ChampionPool.js` →
  `placeholderChampRank(name, games)` isim+oyun sayısından deterministik üretiyor.
  "TR #X" görünür, dünya/TR hover'da.
- **Gerçeği için gereken:**
  - Şampiyon bazında oyuncuların mastery puanı (veya sezon performans skoru) sıralaması.
    Bölge + global leaderboard → DB tablosu (`champion_player_ranks` benzeri), worker ile
    beslenen. Oyuncunun o şampiyondaki mastery puanını bu sıralamada ara.
  - Alternatif: kendi DB'mizdeki taranan oyuncular üzerinden yaklaşık sıra (örneklem).

---

## Notlar
- **Bölge dinamik:** Sıralama, hesabın bulunduğu sunucuya göre olmalı (TR hesabı → TR,
  EUW hesabı → EUW...). Frontend'de bölge etiketi `profile.platform`'dan türetiliyor
  (`frontend/src/lib/region.js` → `regionLabel`), `tr1→TR`, `euw1→EUW` vb. Gerçek
  sıralama hesabı da o bölgenin ladder'ı üzerinden yapılmalı. Şu an backend tek platform
  (`config('riot.platform')`); çok bölge desteği gelince platform parametrik olmalı.
- Hepsi **DB + periyodik worker** ister (canlı API ile her istekte hesaplanamaz, pahalı).
- Placeholder fonksiyonları `placeholder*` adıyla ve "TEST VERİSİ" yorumuyla işaretli →
  gerçek veri gelince bu fonksiyonları gerçek kaynakla değiştir.
- İlişki: [[project_worker_plan]] (worker altyapısı), `WORKER_PLAN.md` Aşama 2.
