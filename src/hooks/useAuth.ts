import { useState, useEffect } from "react";
import api, { getCsrfCookie } from "../lib/axios";
import { requestForToken, removeFcmToken } from "../lib/firebase"; // 👈 removeFcmToken dikembalikan ke import

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  login_type?: string;
  roles?: string[];
  permissions?: string[];
  created_at: string;
}

interface AuthResponse {
  status: string;
  data?: User;
  message?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setError(null);
      await getCsrfCookie();
      const response = await api.get<AuthResponse>("/api/user");

      if (response.data.status === "success" && response.data.data) {
        setUser(response.data.data);

        // 🟢 Setelah user terkonfirmasi login, daftarkan FCM web.
        // Sengaja tidak di-await (fire and forget) supaya tidak
        // memperlambat proses fetchUser -- kalau gagal, tinggal
        // di-log, tidak perlu mem-block UI login.
        requestForToken().catch((err) =>
          console.error("requestForToken gagal:", err)
        );

        return true;
      }

      setUser(null);
      return false;
    } catch (err: any) {
      console.error("Fetch user error:", err);
      setUser(null);
      if (err.response?.status !== 401) {
        setError(err.message || "Failed to fetch user");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = () => {
    // Route redirect Google OAuth sekarang didaftarkan di routes/web.php
    // (bukan lagi routes/api.php), jadi TIDAK ada prefix "/api" di depannya.
    window.location.href = "http://localhost:8000/auth/google";
  };

  const logout = async () => {
    try {
      setLoading(true);

      // 🔴 DIPERBAIKI: skema fcm_token sekarang PER-DEVICE (tabel
      // user_fcm_tokens, unique per token), bukan lagi 1 kolom tunggal
      // di users yang otomatis ke-overwrite tiap login. Kalau token
      // browser ini tidak dihapus di sini, baris token-nya akan
      // nyangkut selamanya di database dan browser ini TETAP menerima
      // push notification walau user sudah logout -- baru berhenti
      // kalau suatu saat login lagi dari browser yang sama (dan itu
      // pun tidak dijamin terjadi).
      //
      // Wajib dipanggil SEBELUM /api/logout, karena endpoint hapus
      // token butuh header Authorization (Sanctum) yang masih valid.
      await removeFcmToken();

      await getCsrfCookie();
      await api.post("/api/logout");
      sessionStorage.removeItem("welcomed_this_session");
      setUser(null);
      window.location.href = "/login";
    } catch (err: any) {
      console.error("Logout error:", err);
      setError(err.message || "Failed to logout");
    } finally {
      setLoading(false);
    }
  };

  // Cek autentikasi & tangkap token Google OAuth sekali saja saat mount
  useEffect(() => {
    const initAuth = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const loginSuccess = hash === '#success' || params.get('login') === 'success';
      const token = params.get('token');
      const loginError = params.get("error");

      if (loginError) {
        setError(decodeURIComponent(loginError));
        window.history.replaceState({}, "", "/login");
        setLoading(false);
        return;
      }

      if (loginSuccess || token) {
        if (token) localStorage.setItem('auth_token', token);
        window.history.replaceState({}, '', '/dashboard');
        await getCsrfCookie();
        await fetchUser();
      } else {
        await fetchUser();
      }
    };

    initAuth();
  }, []);

  return {
    user,
    loading,
    error,
    loginWithGoogle,
    logout,
    fetchUser,
    isAuthenticated: !!user,
  };
};