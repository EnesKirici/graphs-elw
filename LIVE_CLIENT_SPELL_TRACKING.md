# Yetenek Kullanım Sayısı (Spell Cast) Toplama Rehberi

> "Bir maçta hangi yeteneği (Q/W/E/R) ve sihirdar büyüsünü (D/F) kaç kez kullandım?"
> verisini nasıl elde ederiz — tüm yollar, riskleri ve bizim için doğru seçim.

---

## 0. TL;DR — Önce bunu oku

| İhtiyacın | Doğru yöntem | Geçmiş maç? | Oyuncu PC'sinde agent? | Ban riski |
|---|---|---|---|---|
| **Toplam sayı** (Q 56 kez) | **Match-V5 `spellXCasts`** ✅ | Evet | Hayır | Yok (resmi) |
| Dakika-bazlı / canlı akış | Overwolf GEP `usedAbility` | Hayır (canlı) | Evet (overlay) | Düşük (Riot-uyumlu) |
| Tam zaman çizelgesi | `.rofl` replay parse | Maç sonrası | Hayır | Gri alan |

**Bizim sitemiz için cevap: Match-V5 `spellXCasts`.** Görselde gördüğün "SPELL CASTED: Q 56 kez" tablosu için Live Client API'ye, Overwolf'a veya oyuncunun bilgisayarına **hiç gerek yok.** Veri zaten her maçın Riot kaydında duruyor; sadece backend'in onu okuyup frontend'e geçirmesi gerekiyor.

> İlk incelemede "imkansız" dedik çünkü Match **Timeline** verisine baktık (orada gerçekten yok — sadece `SKILL_LEVEL_UP` = yetenek *seviye atlama* var). Ama cast sayıları Timeline'da değil, **maç özeti** (`match.info.participants[i]`) içinde duruyor.

---

## 1. YÖNTEM 1 — Match-V5 `spellXCasts` (ÖNERİLEN)

### Veri nerede?
`GET /lol/match/v5/matches/{matchId}` yanıtında, her oyuncu için:

```jsonc
match.info.participants[i] = {
  // ...
  "spell1Casts": 56,   // Q toplam cast
  "spell2Casts": 43,   // W
  "spell3Casts": 83,   // E
  "spell4Casts": 19,   // R
  "summoner1Casts": 5, // 1. sihirdar büyüsü (genelde D tuşu)
  "summoner2Casts": 6  // 2. sihirdar büyüsü (genelde F tuşu)
}
```

- Maç **sonu toplam** değerlerdir (hangi dakikada kaç kez DEĞİL — sadece toplam).
- **Geçmiş maçlar dahil** herkesin maçında vardır, sunucudan gelir.
- Resmî, ToS-uyumlu, sıfır ban riski, ekstra altyapı yok.

### Bilinen Riot bug'ı
Form/dönüşüm değiştiren bazı şampiyonlarda (Jayce, Elise, Nidalee, Gnar, Kayn vb.) `spellXCasts` yanlış veya 0 dönebilir. Bu Riot tarafı bilinen bir sorundur ([developer-relations #569](https://github.com/RiotGames/developer-relations/issues/569), [#754](https://github.com/RiotGames/developer-relations/issues/754)). UI'da 0 görünürse "veri yok" gibi ele almak yeterli.

### Bizim projede ne yapılmalı? (backend)
`backend/app/Services/RiotApi/MatchDataService.php` → `extractMatchData()` (~satır 252) Riot'un ~150 alanından ~40'ını alıyor; bu 6 alan listede yok. Eklenmeli. Detaylar: **`BACKEND_NOTES_match_details.md`**.

Frontend zaten hazır: `MatchDetailsTab.js` içindeki `SpellCasts` bileşeni `p.spellCasts = {q,w,e,r}` ve `p.summonerCasts = {d,f}` gelince otomatik render eder.

---

## 2. YÖNTEM 2 — Live Client Data API (canlı, sadece anlık maç)

Bu yöntem **toplam cast sayısı İÇİN GEREKMEZ.** Yalnızca *canlı maç sırasında dakika-bazlı* bir şey yapmak istersen (örn. /live-game sayfasında anlık "şu an Q'yu X kez bastı") düşün.

### Temel gerçekler
- Taban URL: `https://127.0.0.1:2999/liveclientdata/`
- **Sadece oyuncunun KENDİ makinesinde, oyun AKTİFKEN** çalışır. Lobi/menüde 404. Ev ağından bile erişilemez (yalnız localhost).
- HTTPS + Riot'un self-signed sertifikası. Doğrulamayı atla (`verify=False` / `rejectUnauthorized:false`) veya `riotgames.pem`'i CA olarak ver.
- Auth yok (localhost kısıtı güvenlik sınırı). Resmî rate limit belgelenmemiş; pratikte ~250ms–1sn polling.

### ⚠️ EN KRİTİK NOKTA: Live Client API cast SAYISI VERMEZ
- `/liveclientdata/activeplayerabilities` → her yetenek için yalnızca **`abilityLevel`** (0-5 seviye), **cast sayısı yok.**
- `/liveclientdata/eventdata` → sadece üst-düzey olaylar (`ChampionKill`, `DragonKill`, `BaronKill`, `Multikill`, `Ace`...). **"AbilityCast" diye bir event türü YOK.**
- Başka oyuncuların yetenek bilgisi hiç yok (`abilities` sadece `activeplayer`'da).

Yani Live Client API ile cast saymak ancak cooldown/level farkını yüksek frekansta diff'leyerek *tahmin* etmektir — kırılgan, spam/iptal/buff'larla yanılır. **Cast toplama için ana kaynak yapma.**

### Endpoint özeti (ne işe yarar)
| Endpoint | Verir |
|---|---|
| `/allgamedata` | Hepsi tek yanıtta |
| `/activeplayer` | Kendi: abilities (level), championStats, currentGold, fullRunes, level |
| `/activeplayerabilities` | Kendi Q/W/E/R/Passive → **abilityLevel** (cast yok) |
| `/playerlist` | Tüm oyuncular: champ, scores (k/d/a/cs/ward), items, spells, runes, position |
| `/playerscores?riotId=` | Tek oyuncu: kills/deaths/assists/creepScore/wardScore |
| `/eventdata?eventID=N` | Olay listesi (kill/objektif), incremental |
| `/gamestats` | gameMode, gameTime, mapName |

### Örnek (Python, lokal)
```python
import requests
r = requests.get(
    "https://127.0.0.1:2999/liveclientdata/allgamedata",
    verify=False,          # veya verify="riotgames.pem"
    timeout=2,
)
data = r.json()  # maç dışıysa bağlantı hatası fırlatır
```

---

## 3. YÖNTEM 3 — Overwolf GEP `usedAbility` (Porofessor'un yolu)

Porofessor / Mobalytics / Blitz overlay'leri **Overwolf** platformu üzerine kuruludur. Overwolf'un Game Events Provider (GEP) mekanizması, Live Client API'nin veremediği per-cast event'i sağlar:

- `usedAbility` event'i → payload `{ "type": "1" }`..`{ "type": "4" }` (1=Q, 2=W, 3=E, 4=R)
- Overwolf **sayıyı tutmaz**; uygulama her `usedAbility` geldiğinde kendi sayacını artırır.
- Riot-uyumlu, izinli platform (Vanguard ile uyumlu). Kısıt: Udyr için `usedAbility` devre dışı.
- Kaynak: [Overwolf LoL Game Events](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends/)

Bu yol **gerçek canlı, dakika-bazlı cast akışı** istiyorsan tek güvenilir yöntemdir ama bir Overwolf masaüstü uygulaması geliştirip dağıtmayı gerektirir — bizim "geçmiş maç detayı" ihtiyacımız için aşırı kapsamlı.

---

## 4. REDDEDİLEN yöntemler

- **Bellek okuma (memory reading):** Riot **Vanguard** anti-cheat harici bellek okumayı engelliyor — hem **artık çalışmıyor** hem yüksek ban riski. ([Vanguard FAQ](https://www.riotgames.com/en/DevRel/vanguard-faq))
- **`.rofl` replay parse:** Tam zaman çizelgesiyle cast verir ama dosya şifreli, parse karmaşık, her patch'te kırılır, Riot onaylı değil (gri alan). Sadece indirilebilir kendi replay'lerin için, araştırma amaçlı.
- **Live EVENTS API (port 34243):** Live Client API'den ayrı, sadece spectator/replay'de manuel açılır; spell cast event'i belgesiz ve **14.1'de kaldırılmış görünüyor** → güvenilmez.

---

## 5. Mimari karar şeması

```
"Q kaç kez kullanıldı?" istiyorum
        │
        ├─ Sadece TOPLAM yeterli mi?  ──── EVET ─► Match-V5 spellXCasts  ✅ (BİZ BUNU SEÇTİK)
        │                                          (backend 6 alan ekler, biter)
        │
        └─ Dakika-bazlı / canlı akış mı lazım?
                 │
                 ├─ Overwolf app yazmaya hazırım ─► Overwolf GEP usedAbility
                 └─ Hayır ─► pratikte mümkün değil (Live Client API cast saymaz)
```

---

## 6. Kaynaklar
- Riot Developer Portal — LoL Docs: https://developer.riotgames.com/docs/lol
- Live Client Data örnek JSON: https://static.developer.riotgames.com/docs/lol/liveclientdata_sample.json
- Match-V5 cast bug: https://github.com/RiotGames/developer-relations/issues/569 , /issues/754
- Live Client API cast vermez (teknik blog): https://maknee.github.io/blog/2025/League-Data-Scraping/
- Overwolf LoL events: https://overwolf.github.io/api/games/events/league-of-legends
- Vanguard FAQ (memory reading öldü): https://www.riotgames.com/en/DevRel/vanguard-faq
- Python wrapper: https://github.com/Plutokekz/LeagueClientLiveDataApi
- Event polling örneği: https://github.com/agroth01/LeagueOfEvents

---

### Doğrulanamayan noktalar
- Live Client API'nin kendi makinede replay izlerken erişilebilirliği kaynaklarda netleşmedi.
- Overwolf'un `usedAbility`'yi hangi düşük seviye mekanizmayla aldığı (motor enjeksiyonu vb.) belgelenmemiş — ama Live Client API'den gelmediği kesin.
- Port 2999 için resmî rate limit değeri bulunamadı.
