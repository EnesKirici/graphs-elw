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

async function authRequest(endpoint, options = {}) {
  const token = getToken();
  if (!token) { logout(); throw new Error("Token yok."); }

  const res = await fetch(`${API_BASE}/admin${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (res.status === 401) { logout(); throw new Error("Oturum süresi doldu."); }
  if (!res.ok) throw new Error(`API Hatası: ${res.status}`);
  return res.json();
}

export function fetchAdmin(endpoint) {
  return authRequest(endpoint);
}

export function putAdmin(endpoint, data) {
  return authRequest(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function postAdmin(endpoint, data) {
  return authRequest(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteAdmin(endpoint) {
  return authRequest(endpoint, { method: "DELETE" });
}
