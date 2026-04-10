const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function isAuthenticated() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem("admin_token");
  window.location.href = "/admin/login";
}

export async function adminLogin(password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Giriş başarısız.");
  }

  localStorage.setItem("admin_token", data.token);
  return data;
}

export async function fetchAdmin(endpoint) {
  const token = getToken();
  if (!token) {
    logout();
    throw new Error("Token yok.");
  }

  const res = await fetch(`${API_BASE}/admin${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    logout();
    throw new Error("Oturum süresi doldu.");
  }

  if (!res.ok) {
    throw new Error(`API Hatası: ${res.status}`);
  }

  return res.json();
}

export async function putAdmin(endpoint, data) {
  const token = getToken();
  if (!token) {
    logout();
    throw new Error("Token yok.");
  }

  const res = await fetch(`${API_BASE}/admin${endpoint}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (res.status === 401) {
    logout();
    throw new Error("Oturum süresi doldu.");
  }

  if (!res.ok) {
    throw new Error(`API Hatası: ${res.status}`);
  }

  return res.json();
}
