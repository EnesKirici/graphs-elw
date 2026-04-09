# Admin Panel - Yapilacaklar

## 1. Performans Etiketleri Yonetimi

Suanki etiketler ve kosullari (`ElwScoreService.php` -> `calculatePerformanceLabel`):

| Oncelik | Kosul | Etiket | Renk | Aciklama |
|---------|-------|--------|------|----------|
| 1 | rank <= 2 + win + KDA >= 4 | Durdurulamaz | emerald | Essiz performans sergileyerek takimini zafere tasidi |
| 2 | rank <= 3 + win | Lider | emerald | Iyi kararlar verip takimini zafere tasidi |
| 3 | earlyGold < -300 + lateGold > 500 + win | Gec Acilan | blue | Zaman icinde artan performans |
| 4 | earlyGold > 500 + lateGold < -200 + !win | Erken Baskin | yellow | Iyi baslangic ama avantaji koruyamadi |
| 5 | rank <= 3 + !win | Direncli | blue | Yenilgiye ragmen en iyi performans |
| 6 | win + rank 4-6 | Katkici | gray | Istikrarli katki |
| 7 | rank >= 8 | Mucadele | red | Zor bir mac |
| 8 | rank 5-7 | Ortalama | gray | Standart performans |

### Admin panelden ayarlanabilir olmasi gereken alanlar:
- [ ] Etiket adi (label) duzenlenebilir
- [ ] Etiket aciklamasi (desc) duzenlenebilir
- [ ] Etiket rengi (color) seceneklerden secilebilir: emerald, blue, yellow, red, gray
- [ ] Etiket ikonu (icon) duzenlenebilir
- [ ] Kosul esik degerleri (rank, KDA, gold limitleri) ayarlanabilir
- [ ] Etiket onceligi (siralama) surukle-birak ile degistirilebilir
- [ ] Yeni etiket ekleme / mevcut etiket silme

---

## 2. ELW Score Glow (Parlama) Efekti Ayarlari

Suanki sabit deger: ELW Score >= 8.5 olunca glow aktif.

### Admin panelden ayarlanabilir olmasi gereken alanlar:
- [ ] Glow aktif olma esigi (su an 8.5, ornegin 8.0 veya 9.0 yapilabilir)
- [ ] Glow renk secimi (emerald, blue, yellow)
- [ ] Glow animasyon hizi (su an 2s pulse)
- [ ] Shimmer text efekti acma/kapama

---

## 3. ELW Score Etiket Sinir Degerleri

ElwScoreBadge icindeki label degerleri (`MatchDetail.js`):

| Skor Aralik | Etiket |
|-------------|--------|
| >= 8.0 | Olaganustu |
| >= 6.5 | Cok Iyi |
| >= 5.0 | Iyi |
| >= 3.5 | Mucadele |
| < 3.5 | Zor Mac |

### Admin panelden ayarlanabilir olmasi gereken alanlar:
- [ ] Skor aralik esikleri (8.0, 6.5, 5.0, 3.5) duzenlenebilir
- [ ] Her araliga karsilik gelen etiket adi duzenlenebilir
- [ ] Renk aralik esikleri (7, 5, 3) ayarlanabilir

---

## 4. Rozet (Badge) Sistemi Yonetimi

BadgeService.php'deki tum rozetler:

### Savas Rozetleri:
- Duellocu (solo kills >= 2)
- Yuksek KDA (kda >= 4, k+a >= 5)
- Olumsuz (0 olum + win)
- Ilk Kan (firstBloodKill)
- PENTA KILL / Quadra Kill
- Son Nefes (survived low HP)
- Kacis Ustasi (skillshots dodged >= 20)

### Hasar Rozetleri:
- Hasar Makinesi (dmg pct >= 28%)
- Yuksek DPM (dpm >= 600)
- Duvar (tank pct >= 28%, top/jg/sup)

### Farm Rozetleri:
- CS Ustasi (cs10 >= 65)
- CS Baskini (cs advantage >= 15)
- Altin Madencisi (gpm >= 400)

### Objektif Rozetleri:
- Kule Yikici (plates >= 3)
- Hirsiz (epic monster steals >= 1)
- Ilk Kule (firstTowerKill)

### Gorus Rozetleri:
- Gorus Ustasi (vsPerMin >= 1.0)
- Ward Ustasi (control wards >= 4)

### Takim Rozetleri:
- Takim Oyuncusu (kp >= 65%)

### Fallback:
- ???? (bos rozet + 6+ olum)

### Admin panelden ayarlanabilir olmasi gereken alanlar:
- [ ] Her rozet icin esik degerleri duzenlenebilir
- [ ] Rozet adi ve aciklamasi duzenlenebilir
- [ ] Tier sinir degerleri (challenger/grandmaster/diamond/emerald/gold/silver) ayarlanabilir
- [ ] Rozet acma/kapama (aktif/pasif)
- [ ] Yeni rozet ekleme
- [ ] Fallback mesajlari duzenleme

---

## 5. Teknik Notlar

- Performans etiketleri: `backend/app/Services/RiotApi/ElwScoreService.php` -> `calculatePerformanceLabel()`
- Rozet sistemi: `backend/app/Services/RiotApi/BadgeService.php` -> `calculateBadges()`
- Frontend gosterim: `frontend/src/components/summoner/MatchCard.js` -> `PerfLabelTag`
- Frontend detay: `frontend/src/components/summoner/MatchDetail.js` -> `ElwScoreBadge`, `AnalysisPanel`
- Glow CSS: `frontend/src/app/globals.css` -> `.perf-glow`, `.perf-shimmer-text`
- Admin panelden ayar yapildiginda bu degerlerin bir config/settings tablosundan cekilmesi gerekecek (su an hardcoded)
- Oneri: `admin_settings` tablosu olusturup JSON olarak bu ayarlari saklamak, frontend'in `/api/settings` endpoint'inden okumasi
