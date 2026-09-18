// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, onMessage, type MessagePayload } from "firebase/messaging";
import api from "./axios";

// 🟢 Config asli dari Firebase Console (Project settings → Web App "Rental Web")
// Diambil dari environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const DEVICE_ID_STORAGE_KEY = "fcm_device_id";

/**
 * Ambil device_id yang persisten di browser ini. Kalau belum ada,
 * generate UUID baru dan simpan di localStorage supaya tetap sama
 * setiap kali user buka app lagi dari browser yang sama -- ini yang
 * membedakan "device" ini dari device/browser lain di backend
 * (tabel user_fcm_tokens), independen dari akun mana yang login.
 */
const getOrCreateDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }

  return deviceId;
};

/**
 * Registrasi service worker + minta izin notifikasi + kirim token ke backend.
 * Dipanggil setelah user terkonfirmasi login (bukan di top-level app load),
 * supaya browser tidak menampilkan prompt izin ke user yang belum kenal app.
 */
export const requestForToken = async () => {
  try {
    if (!("serviceWorker" in navigator)) {
      console.warn("Browser ini tidak mendukung Service Worker, FCM web tidak akan jalan.");
      return;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Izin notifikasi ditolak oleh pengguna.");
      return;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!currentToken) {
      console.log("Tidak dapat memperoleh token pendaftaran FCM.");
      return;
    }

    await api.post("/api/fcm-token", {
      fcm_token: currentToken,
      device_id: getOrCreateDeviceId(),
      platform: "web",
    });

    console.log("FCM Token web berhasil dikirim ke backend:", currentToken);
  } catch (err) {
    console.error("Gagal mengambil token FCM web:", err);
  }
};

/**
 * Hapus token FCM device ini dari backend (dipanggil saat logout), lalu
 * hapus juga token dari Firebase SDK di browser supaya kalau user login
 * lagi nanti, getToken() bikin token baru yang bersih -- bukan cuma
 * kirim ulang token lama yang sebenarnya sudah dihapus dari server.
 *
 * PENTING: panggil ini SEBELUM token auth (Sanctum) dihapus dari
 * storage, karena endpoint DELETE /api/fcm-token butuh header
 * Authorization yang masih valid.
 */
export const removeFcmToken = async () => {
  try {
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (currentToken) {
      await api.delete("/api/fcm-token", { data: { fcm_token: currentToken } });
      console.log("FCM Token web berhasil dihapus dari backend.");
    }

    await deleteToken(messaging);
  } catch (err) {
    // Tidak perlu blok proses logout kalau ini gagal (misal browser
    // sudah cabut izin notifikasi duluan) -- cukup log saja.
    console.error("Gagal menghapus token FCM web:", err);
  }
};

/**
 * Listener pesan foreground yang bisa dipakai berkali-kali (bukan
 * Promise sekali pakai). Return unsubscribe function dari onMessage.
 */
export const listenToMessages = (callback: (payload: MessagePayload) => void) => {
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};