importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// 🟢 Config HARUS sama persis dengan yang di src/lib/firebase.ts,
// termasuk appId -- kalau beda, getToken() di sisi client tetap bisa
// sukses (karena itu terpisah dari file ini), tapi push saat tab
// tertutup/background bisa gagal diam-diam karena service worker
// gagal init dengan Firebase project yang tepat.
firebase.initializeApp({
  apiKey: "AIzaSyDtPm0ThLZOu7VEeGsAu0cBv-SvIIQ1rqQ",
  authDomain: "rental-b9f93.firebaseapp.com",
  projectId: "rental-b9f93",
  storageBucket: "rental-b9f93.firebasestorage.app",
  messagingSenderId: "380636655706",
  appId: "1:380636655706:web:49ffee0de61b75f103e863"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Menerima background message:', payload);
  const notificationTitle = payload.data?.title || 'Informasi Rental';
  const notificationOptions = {
    body: payload.data?.message || 'Anda memiliki aktivitas baru.',
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/notifikasi');
      }
    })
  );
});