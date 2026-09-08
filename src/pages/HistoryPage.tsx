import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiClock, 
  FiAlertCircle, 
  FiRefreshCw, 
  FiCalendar, 
  FiKey, 
  FiUserCheck, 
  FiMessageSquare, 
  FiX 
} from "react-icons/fi";
import { MdQrCode } from "react-icons/md";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../layouts/AppLayout";
import api from "../lib/axios";

export const HistoryPage: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State untuk Modal QRIS
  const [selectedBookingForQris, setSelectedBookingForQris] = useState<any | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState<boolean>(false);

  const navigate = useNavigate();

  const fetchBookings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get("/api/bookings/my-history");
      if (response.data.status === "success" || response.data.data) {
        setBookings(response.data.data || []);
      } else {
        setErrorMessage("Gagal memuat riwayat pemesanan.");
      }
    } catch (err: any) {
      console.error("Gagal mengambil riwayat booking:", err);
      setErrorMessage(err.response?.data?.message || `Terjadi kesalahan koneksi: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchBookings();
    }
  }, [authLoading, user]);

  const handleCancelBooking = async (bookingId: number) => {
    const confirm = window.confirm("Yakin ingin membatalkan pesanan ini?");
    if (!confirm) return;

    try {
      const response = await api.patch(`/api/bookings/${bookingId}/cancel`);
      if (response.status === 200) {
        alert("Booking berhasil dibatalkan.");
        fetchBookings();
      }
    } catch (err: any) {
      console.error("Gagal membatalkan booking:", err);
      alert(err.response?.data?.message || "Gagal membatalkan pesanan.");
    }
  };

  const handleCheckQrisPayment = async (bookingId: number) => {
    setIsCheckingPayment(true);
    try {
      const response = await api.get(`/api/bookings/${bookingId}/check-payment`);
      const updatedBooking = response.data.data;
      const newPaymentStatus = updatedBooking?.payment_status || "unpaid";

      if (newPaymentStatus === "paid") {
        alert("Pembayaran QRIS terkonfirmasi LUNAS!");
        setSelectedBookingForQris(null);
      } else {
        alert("Pembayaran belum diterima. Pastikan sudah scan & bayar QR, lalu coba cek lagi.");
      }
      fetchBookings();
    } catch (err: any) {
      console.error("Gagal mengecek pembayaran:", err);
      alert(err.response?.data?.message || "Gagal mengecek status pembayaran.");
      fetchBookings();
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Navigasi ke Halaman Chat Penyewa <-> Perental (Pemilik Mobil).
  //
  // 🔴 FIX (menyamakan pola guard dengan _openChatWithRentalOwner /
  // _openChatWithRenter / _openChatWithDriver di file-file lain -- BUKAN
  // meniru _openChatWithOwner versi Flutter BookingHistoryPage apa adanya,
  // karena versi itu sendiri masih memakai fallback hardcode lama):
  // - SEBELUMNYA ada fallback `carData.user_id ? ... : "2"` dan
  //   `user?.id ? ... : "3"`. Fallback ini berbahaya: kalau relasi
  //   pemilik mobil (`car.user`/`car.owner`) belum ter-load dari backend,
  //   atau data user login belum siap, chat tetap dibuka tapi diam-diam
  //   memakai ID yang SALAH (owner fiktif ID 2, atau seolah penyewa login
  //   sebagai user ID 3) tanpa pemberitahuan apapun. Sekarang di-guard
  //   eksplisit: kalau ID tidak valid, tampilkan alert dan batalkan
  //   navigasi.
  // - SEBELUMNYA juga TIDAK menyertakan parameter `receiver_id` di query
  //   string, padahal ChatPage.tsx mewajibkan receiver_id ada (lihat guard
  //   "Chat tidak bisa dibuka"). Tanpa parameter ini, tombol "Chat
  //   Perental" SELALU berakhir di halaman error tersebut.
  const handleOpenChat = (carData: any) => {
    if (!carData) {
      alert("Informasi kendaraan tidak tersedia.");
      return;
    }

    if (!user?.id) {
      alert("Data akun belum siap, coba lagi sesaat lagi.");
      return;
    }

    const ownerMap = carData.user || carData.owner;
    const ownerId =
      ownerMap && ownerMap.id != null
        ? String(ownerMap.id)
        : carData.user_id != null
          ? String(carData.user_id)
          : "";

    if (!ownerId) {
      alert("ID Perental tidak valid.");
      return;
    }

    const ownerName = (ownerMap && ownerMap.name) || "Perental";
    const ownerAvatar = (ownerMap && ownerMap.avatar) ? String(ownerMap.avatar) : "";
    const currentUserId = String(user.id);

    // PENTING: skema "room_rental_{ownerId}_user_{currentUserId}" ini
    // harus PERSIS SAMA dengan yang dipakai sisi Perental
    // (RentalsBookingPage.handleOpenChatWithRenter) untuk room yang sama.
    const uniqueChatId = `room_rental_${ownerId}_user_${currentUserId}`;

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

  const formatPrice = (raw: any) => {
    if (raw == null) return "Rp 0";
    const numValue = Number(raw) || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(numValue);
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
          <h1 className="text-2xl font-bold text-gray-800">Riwayat Pemesanan</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola dan pantau status pemesanan kendaraan rental Anda.</p>
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
              onClick={fetchBookings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              <FiRefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-4">
            <FiClock size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-600 font-semibold text-lg">Belum ada riwayat pemesanan.</p>
            <p className="text-gray-400 text-sm mt-1">Pemesanan kendaraan yang Anda lakukan akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const car = booking.car || {};
              const driver = booking.driver;
              const status = booking.status || "pending";
              const paymentStatus = booking.payment_status || "unpaid";
              const paymentMethod = booking.payment_method || "cod";
              const withDriver = booking.with_driver === 1 || booking.with_driver === true;
              const isPaid = paymentStatus === "paid";

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

                  {/* Informasi Detail */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FiCalendar className="text-gray-400" />
                        <span>Periode: <strong>{formatDate(booking.start_date)}</strong> s/d <strong>{formatDate(booking.end_date)}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiClock className="text-gray-400" />
                        <span>Durasi: <strong>{booking.total_days} Hari</strong></span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FiKey className="text-gray-400" />
                        <span>Layanan: <strong className={withDriver ? "text-indigo-600" : "text-gray-800"}>{withDriver ? "Dengan Driver" : "Lepas Kunci"}</strong></span>
                      </div>
                      {withDriver && driver && (
                        <div className="flex items-center gap-2">
                          <FiUserCheck className="text-green-600" />
                          <span>Driver: <strong className="text-green-600">{driver.name}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informasi Pembayaran & Total */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-4 rounded-xl gap-4">
                    <div>
                      <span className="text-xs text-gray-400 block">Metode & Status Pembayaran</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold uppercase text-gray-700">{paymentMethod === "qris" ? "QRIS" : "Bayar di Tempat (COD)"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {isPaid ? "Lunas" : "Belum Bayar"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Total Biaya</span>
                      <span className="text-base font-bold text-blue-600">{formatPrice(booking.total_price)}</span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {!isPaid && paymentMethod === "qris" && status !== "cancelled" && (
                      <button
                        onClick={() => setSelectedBookingForQris(booking)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        <MdQrCode size={14} /> Bayar via QRIS
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenChat(car)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <FiMessageSquare size={14} /> Chat Perental
                    </button>

                    {status === "pending" && (
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition-all ml-auto"
                      >
                        <FiX size={14} /> Batalkan Pesanan
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Modal QRIS */}
        {selectedBookingForQris && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-center relative">
              <button
                onClick={() => setSelectedBookingForQris(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>

              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <MdQrCode size={24} />
              </div>

              <h3 className="font-bold text-gray-800 text-lg">Pembayaran QRIS</h3>
              <p className="text-xs text-gray-500">Silakan scan QR Code di bawah ini menggunakan aplikasi mobile banking atau e-wallet Anda.</p>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 inline-block">
                {selectedBookingForQris.qris_url ? (
                  <img
                    src={selectedBookingForQris.qris_url}
                    alt="QRIS Code"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                    QR belum tersedia. Hubungi Perental.
                  </div>
                )}
              </div>

              <div>
                <span className="text-xs text-gray-400 block">Total Tagihan</span>
                <span className="text-lg font-bold text-blue-600">{formatPrice(selectedBookingForQris.total_price)}</span>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  disabled={isCheckingPayment}
                  onClick={() => handleCheckQrisPayment(selectedBookingForQris.id)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCheckingPayment && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Cek Status Pembayaran
                </button>
                <button
                  onClick={() => setSelectedBookingForQris(null)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default HistoryPage;