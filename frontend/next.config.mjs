/** @type {import('next').NextConfig} */
const nextConfig = {
  // DDragon'dan gelen şampiyon/item görsellerini Next.js Image ile kullanabilmek için
  // Normalde Next.js harici URL'lerden görsel yüklemeye izin vermez (güvenlik).
  // "remotePatterns" ile izin verdiğimiz domain'leri belirtiyoruz.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
        // DDragon CDN: şampiyon ikonları, item görselleri, profil ikonları vs.
      },
    ],
  },
};

export default nextConfig;
