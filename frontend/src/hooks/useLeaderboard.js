"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/* Sekme geçişi neden yavaştı: her (lig, kuyruk) bileşimi ayrı istek + ayrı backend
   cache anahtarı, üstelik component'te hiç bellek yoktu — aynı sekmeye geri dönmek
   bile baştan ağ turu demekti.

   Burada iki şey yapılır:
     1. Çekilen her bileşim modül belleğinde tutulur → ikinci geçiş ANINDA.
     2. İlk veri gelir gelmez komşu ligler arka planda önden çekilir → ilk geçiş de
        anında olur (kullanıcı sekmeye bastığında istek çoktan bitmiştir).

   Bu istekler Riot'a GİTMEZ: backend tarafı cache'li ve `leaderboard:warm` ile
   15 dakikada bir önden dolduruluyor (LeaderboardService). */
const cache = new Map();
const inflight = new Map();

/** Bellekteki kaydın taze sayıldığı süre — backend zaten 15 dk'da bir tazeleniyor. */
const TTL_MS = 5 * 60 * 1000;

const keyOf = (tier, queue) => `${tier}:${queue}`;

function readFresh(tier, queue) {
  const hit = cache.get(keyOf(tier, queue));
  if (!hit || Date.now() - hit.at > TTL_MS) return null;
  return hit.data;
}

/** Tek uçuş kuralı: önden çekme ile tıklama aynı bileşimi iki kez istemesin. */
function load(tier, queue) {
  const key = keyOf(tier, queue);
  const fresh = readFresh(tier, queue);
  if (fresh) return Promise.resolve(fresh);
  if (inflight.has(key)) return inflight.get(key);

  const req = fetch(`${API_BASE}/leaderboard?tier=${tier}&queue=${queue}`)
    .then((r) => r.json())
    .then((data) => {
      // Hata gövdesini ({error: ...}) cache'leme — sonraki denemede tekrar sorulsun.
      if (data && Array.isArray(data.entries)) cache.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, req);
  return req;
}

/**
 * @param {string} tier          seçili lig
 * @param {string} queue         seçili kuyruk
 * @param {string[]} prefetchTiers  arka planda hazırlanacak ligler — MODÜL SABİTİ
 *   olmalı, her render'da yeni dizi verilirse effect boşuna tekrar koşar.
 */
export default function useLeaderboard(tier, queue, prefetchTiers = []) {
  const [data, setData] = useState(() => readFresh(tier, queue));
  const [loading, setLoading] = useState(() => !readFresh(tier, queue));
  const prefetched = useRef(new Set());

  useEffect(() => {
    const hit = readFresh(tier, queue);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }

    // Sekme hızlı değiştirilirse geç dönen eski yanıt yeni seçimi ezmesin.
    let alive = true;
    setLoading(true);

    load(tier, queue)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [tier, queue]);

  useEffect(() => {
    if (loading) return;

    for (const t of prefetchTiers) {
      const key = keyOf(t, queue);
      if (t === tier || prefetched.current.has(key) || readFresh(t, queue)) continue;
      prefetched.current.add(key);
      load(t, queue).catch(() => prefetched.current.delete(key));
    }
  }, [loading, tier, queue, prefetchTiers]);

  return { data, loading };
}
