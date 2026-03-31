/*
  API Wrapper - Laravel backend ile iletişim

  Laravel'deki Http::get() gibi düşün. Bu dosya frontend'in
  "Laravel API'sine istek atan" tek noktası.

  Kullanım:
    import { fetchApi } from "@/lib/api";
    const data = await fetchApi("/champions");
    // Bu aslında http://localhost:8000/api/v1/champions adresine gider
*/

// .env.local dosyasından veya varsayılan değerden API URL'sini al
// NEXT_PUBLIC_ prefix'i = bu değişken tarayıcıda da görünür (public)
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Laravel API'sine GET isteği atar.
 *
 * @param {string} endpoint - API endpoint'i (örnek: "/champions")
 * @returns {Promise<any>} - JSON response
 */
export async function fetchApi(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    // next.cache: Bu veriyi Next.js sunucu tarafında cache'ler
    // revalidate: 60 saniye sonra yeni veri çek
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API Hatası: ${res.status} - ${endpoint}`);
  }

  return res.json();
}
