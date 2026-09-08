import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Swal from "sweetalert2"; // 👈 tambahan
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import CarDetail from "./pages/CarDetail";
import { CarPage } from "./pages/CarPage";
import { CarAddPage } from "./pages/CarAddPage";
import { HistoryPage } from "./pages/HistoryPage";
import { CarBookingPage } from "./pages/CarBookingPage";
import { ChatPage } from "./pages/ChatPage";
import { RentalsBookingPage } from "./pages/RentalsBookingPage";
import { DriverBookingsPage } from "./pages/DriverBookingsPage";
import { RentalApplicationPage } from "./pages/RentalApplicationPage";
import NotificationPage from "./pages/NotificationPage";
import { useAuth } from "./hooks/useAuth";
import { listenToMessages } from "./lib/firebase";

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  const { user } = useAuth();

  // 🟢 SATU-SATUNYA listener FCM foreground untuk seluruh aplikasi.
  // Sengaja diletakkan di App.tsx (bukan AppLayout.tsx) karena App.tsx
  // cuma di-mount SEKALI untuk seluruh sesi, sedangkan AppLayout
  // di-mount ULANG setiap kali pindah halaman -- kalau listener
  // didaftarkan di AppLayout, listener akan menumpuk terus setiap kali
  // navigasi (karena FCM SDK tidak otomatis membuang listener lama),
  // dan satu notifikasi bisa muncul berkali-kali (dobel/triple/dst).
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToMessages((payload) => {
      console.log("Notifikasi FCM diterima di Foreground web:", payload);

      const title = payload.data?.title ?? payload.notification?.title ?? "Informasi Rental";
      const body = payload.data?.message ?? payload.notification?.body ?? "Anda memiliki aktivitas baru.";

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title,
        text: body,
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });
    });

    // Bersihkan listener saat user logout / komponen unmount, supaya
    // tidak menumpuk listener duplikat tiap kali user berubah.
    return () => unsubscribe();
  }, [user]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cars"
          element={
            <ProtectedRoute>
              <CarPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rentals-bookings"
          element={
            <ProtectedRoute>
              <RentalsBookingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/driver-bookings"
          element={
            <ProtectedRoute>
              <DriverBookingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rental-application"
          element={
            <ProtectedRoute>
              <RentalApplicationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/car-add"
          element={
            <ProtectedRoute>
              <CarAddPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cars/:id/edit"
          element={
            <ProtectedRoute>
              <CarAddPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cars/:id/book"
          element={
            <ProtectedRoute>
              <CarBookingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cars/:id"
          element={
            <ProtectedRoute>
              <CarDetail />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;