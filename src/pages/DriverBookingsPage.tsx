import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiClock, 
  FiAlertCircle, 
  FiRefreshCw, 
  FiCalendar, 
  FiUser, 
  FiShoppingBag, 
  FiMessageSquare, 
  FiNavigation 
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../layouts/AppLayout";
import api from "../lib/axios";

export const DriverBookingsPage: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [assignedBookings, setAssignedBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDriverBookings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get("/api/bookings");
      if (response.data.status === "success" || response.data.data) {
        setAssignedBookings(response.data.data || []);
      } else {
        setErrorMessage("Gagal memuat data penugasan.");
      }
    } catch (err: any) {
      console.error("Gagal mengambil data penugasan driver:", err);
      setErrorMessage(err.response?.data?.message || `Terjadi kesalahan koneksi: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchDriverBookings();
    }
  }, [authLoading, user]);

  // Navigasi ke Halaman Chat Driver <-> Perental (Pemilik Rental).
  //
  // 🔴 FIX (menyamakan pola dengan _openChatWithRentalOwner di Flutter):
  // - SEBELUMNYA hanya `ownerId` yang di-guard, `currentUserId` (dari
  //   `user?.id`) tidak pernah dicek sama sekali sebelum dipakai membangun
  //   uniqueChatId. Kalau fungsi ini sempat dipanggil sebelum data user
  //   selesai dimuat, chatId bisa berakhir kosong di ujung
  //   ("room_rental_{ownerId}_driver_") -- bug yang sama yang sudah pernah
  //   diperbaiki di sisi Flutter. Sekarang currentUserId di-guard eksplisit
  //   di awal, sama seperti Flutter (`_currentUserId == null || isEmpty`).
  // - SEBELUMNYA juga TIDAK menyertakan parameter `receiver_id` di query
  //   string navigasi, padahal ChatPage.tsx mewajibkan receiver_id ada
  //   (lihat guard "Chat tidak bisa dibuka" di halaman chat). Tanpa
  //   parameter ini, tombol "Chat Perental" SELALU berakhir di halaman
  //   error tersebut.
  const handleOpenChatWithRentalOwner = (rentalOwner: any) => {
    if (!rentalOwner) {
      alert("Informasi perental tidak tersedia.");
      return;
    }

    if (!user?.id) {
      alert("Data akun belum siap, coba lagi sesaat lagi.");
      return;
    }

    const ownerId = rentalOwner.id != null ? String(rentalOwner.id) : "";
    if (!ownerId) {
      alert("ID Perental tidak valid.");
      return;
    }

    const ownerName = rentalOwner.name || "Perental";
    const ownerAvatar = rentalOwner.avatar ? String(rentalOwner.avatar) : "";
    const currentUserId = String(user.id);

    // Format unik room chat antara perental dan driver -- HARUS sama persis
    // dengan sisi Perental (RentalsBookingPage.handleOpenChatWithDriver):
    // room_rental_{perentalId}_driver_{driverId}. Di sini ownerId berperan
    // sebagai perentalId, currentUserId sebagai driverId.
    const uniqueChatId = `room_rental_${ownerId}_driver_${currentUserId}`;

    const params = new URLSearchParams({
      room: uniqueChatId,
      receiver_id: ownerId,
      name: `Perental: ${ownerName}`,
    });
    if (ownerAvatar) params.set("avatar", ownerAvatar);

    navigate(`/chat?${params.toString()}`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
      case "active":
        return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase">Berlangsung</span>;
      case "completed":
        return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase">Selesai</span>;
      case "cancelled":
        return <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase">Dibatalkan</span>;
      default:
        return <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase">Menunggu</span>;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <AppLayout user={user} logout={logout}>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        
        {/* Header Halaman */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800">Tugas Penugasan</h1>
          <p className="text-sm text-gray-500 mt-1">Lihat jadwal dan tugas antar-jemput kendaraan rental Anda.</p>
        </div>

        {/* Konten Utama */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : errorMessage ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-full mb-3">
              <FiAlertCircle className="w-8 h-8" />
            </div>
            <p className="text-gray-700 font-medium mb-4">{errorMessage}</p>
            <button
              onClick={fetchDriverBookings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              <FiRefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          </div>
        ) : assignedBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-4">
            <FiNavigation size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-600 font-semibold text-lg">Belum ada penugasan rental.</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs">Perental yang terhubung akan muncul di sini setelah kamu ditugaskan pada sebuah booking.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignedBookings.map((booking) => {
              const car = booking.car || {};
              const renter = booking.user || {};
              const rentalOwner = booking.rental_owner || booking.perental || car.user || {};
              const status = booking.status || "pending";

              const startDateFormatted = formatDate(booking.start_date);
              const endDateFormatted = formatDate(booking.end_date);

              return (
                <div key={booking.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                  
                  {/* Header Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{car.name || "Mobil Rental"}</h3>
                      <p className="text-xs text-gray-400">ID Booking: #{booking.id}</p>
                    </div>
                    <div>{getStatusBadge(status)}</div>
                  </div>

                  {/* Informasi Detail Penugasan */}
                  <div className="space-y-2.5 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <FiUser className="text-gray-400" />
                      <span>Penyewa Mobil: <strong className="text-gray-800">{renter.name || "-"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiCalendar className="text-gray-400" />
                      <span>Jadwal: <strong>{startDateFormatted}</strong> s/d <strong>{endDateFormatted}</strong></span>
                    </div>
                  </div>

                  {/* Info Perental & Tombol Chat */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-4 rounded-xl gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FiShoppingBag size={18} />
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Pengelola / Perental</span>
                        <span className="text-xs font-bold text-gray-800">{rentalOwner.name || "Admin Rental"}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenChatWithRentalOwner(rentalOwner)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      <FiMessageSquare size={14} /> Chat Perental
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default DriverBookingsPage;