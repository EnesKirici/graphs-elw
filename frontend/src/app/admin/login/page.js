"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/adminApi";
import { Card, Button } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await adminLogin(username, password);
      router.replace("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Amblem */}
        <div
          className="w-14 h-14 rounded-2xl grid place-items-center text-white font-bold text-2xl mx-auto mb-6 border border-edge"
          style={{ background: `linear-gradient(135deg, ${TONES.azure.bar}, ${TONES.violet.bar})` }}
        >
          G
        </div>

        {/* Giriş kartı — topbar yok, sayfa başlığı kart başlığında */}
        <Card title="Admin Panel" subtitle="GRAPHS Yönetim Paneli">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adı"
                autoFocus
                className="w-full bg-soft border border-edge rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#5b8def] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                className="w-full bg-soft border border-edge rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#5b8def] transition-colors"
              />
            </div>

            {error && (
              <div
                className="text-xs rounded-lg px-3 py-2 border"
                style={{ color: TONES.rose.fg, background: TONES.rose.bg, borderColor: TONES.rose.bd }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading || !username || !password}
              className="w-full"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
