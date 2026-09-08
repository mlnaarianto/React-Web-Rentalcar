import React, { useState, useEffect } from "react";
import { 
  FiClock, 
  FiAlertCircle, 
  FiRefreshCw, 
  FiCalendar, 
  FiKey, 
  FiUserCheck, 
  FiMessageSquare, 
  FiUserPlus, 
  FiCheck,
  FiX
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../layouts/AppLayout";
import api from "../lib/axios";
import { useNavigate } from "react-router-dom";

export const RentalsBookingPage: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State untuk melacak ID booking mana yang sedang mengecek pembayaran
  const [checkingPaymentIds, setCheckingPaymentIds] = useState<number[]>([]);

  // State untuk Dialog Penugasan Driver
  const [assigningBookingId, setAssigningBookingId] = useState<number | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [isDriversLoading, setIsDriversLoading] = useState<boolean>(false);

  const statusOptions = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];

  const fetchBookings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get("/api/bookings");
      if (response.data.status === "success" || response.data.data) {
        setBookings(response.data.data || []);
      } else {
        setErrorMessage("Gagal memuat data pesanan.");
      }
    } catch (err: any) {
      console.error("Gagal mengambil data pesanan:", err);
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

  const fetchAvailableDrivers = async () => {
    setIsDriversLoading(true);
    try {
      const response = await api.get("/api/drivers-list");
      setAvailableDrivers(response.data.data || []);
    } catch (err) {
      console.error("Gagal mengambil daftar driver:", err);
      setAvailableDrivers([]);
    } finally {
      setIsDriversLoading(false);
    }
  };

  const handleOpenAssignDriver = async (bookingId: number) => {
    setAssigningBookingId(bookingId);
    setSelectedDriverId(null);
    await fetchAvailableDrivers();
  };

  const handleSubmitAssignDriver = async () => {
    if (!assigningBookingId || !selectedDriverId) {
      alert("Silakan pilih driver terlebih dahulu!");
      return;
    }

    try {
      const response = await api.patch(`/api/bookings/${assigningBookingId}/assign-driver`, {
        driver_id: selectedDriverId,
      });

      if (response.status === 200) {
        alert("Driver berhasil ditugaskan!");
        setAssigningBookingId(null);
        fetchBookings();
      }
    } catch (err: any) {
      console.error("Gagal menugaskan driver:", err);
      alert(err.response?.data?.message || "Gagal menugaskan driver.");
    }
  };

  const handleUpdateStatus = async (bookingId: number, newStatus: string) => {
    try {
      const response = await api.patch(`/api/bookings/${bookingId}/status`, {
        status: newStatus,
      });

      if (response.status === 200) {
        alert("Status booking berhasil diperbarui!");
        fetchBookings();
      }
    } catch (err: any) {
      console.error("Gagal memperbarui status:", err);
      alert(err.response?.data?.message || "Gagal memperbarui status.");
    }
  };

  const handleCheckPaymentStatus = async (bookingId: number) => {
    setCheckingPaymentIds((prev) => [...prev, bookingId]);
    try {
      const response = await api.get(`/api/bookings/${bookingId}/check-payment`);
      const updatedBooking = response.data.data;
      const newPaymentStatus = updatedBooking?.payment_status || "unpaid";

      if (newPaymentStatus === "paid") {
        alert("Pembayaran penyewa terkonfirmasi LUNAS!");
      } else {
        alert("Penyewa belum menyelesaikan pembayaran QRIS.");
      }
      fetchBookings();
    } catch (err: any) {
      console.error("Gagal mengecek pembayaran:", err);
      alert(err.response?.data?.message || "Gagal mengecek status pembayaran.");
    } finally {
      setCheckingPaymentIds((prev) => prev.filter((id) => id !== bookingId));
    }
  };

  // Navigasi ke Halaman Chat Perental <-> Penyewa.
  //
  // 🔴 FIX (menyamakan pola dengan _openChatWithRenter di Flutter):
  // - SEBELUMNYA ada fallback `renter.id || "3"` dan `user?.id || "2"`.
  //   Fallback ini berbahaya: kalau data renter atau user belum lengkap
  //   (mis. relasi belum ter-load dari backend), chat tetap dibuka tapi
  //   diam-diam memakai ID yang SALAH (renter fiktif ID 3, atau seolah
  //   perental login sebagai user ID 2) tanpa pemberitahuan apapun ke
  //   perental. Sekarang di-guard eksplisit: kalau ID tidak valid,
  //   tampilkan alert dan batalkan navigasi -- sama seperti guard
  //   `_currentUserId == null` / `renterId.isEmpty` di Flutter.
  // - SEBELUMNYA juga TIDAK menyertakan parameter `receiver_id` di query
  //   string, padahal ChatPage.tsx mewajibkan receiver_id ada (lihat guard
  //   "Chat tidak bisa dibuka"). Tanpa parameter ini, tombol "Chat
  //   Penyewa" SELALU berakhir di halaman error tersebut.
  const handleOpenChatWithRenter = (renter: any) => {
    if (!user?.id) {
      alert("Data akun belum siap, coba lagi sesaat lagi.");
      return;
    }

    const renterId = renter?.id != null ? String(renter.id) : "";
    if (!renterId) {
      alert("ID Penyewa tidak valid.");
      return;
    }

    const renterName = renter?.name || "Penyewa";
    const renterAvatar = renter?.avatar || "";
    const currentUserId = String(user.id);

    // PENTING: skema "room_rental_{perentalId}_user_{renterId}" ini harus
    // PERSIS SAMA dengan yang dipakai halaman chat milik Penyewa untuk room
    // yang sama (backend mencocokkan chatId ke room_identifier apa adanya).
    // Kalau sisi Penyewa membangun chatId dengan urutan/format berbeda,
    // keduanya akan dianggap dua room terpisah oleh backend.
    const uniqueChatId = `room_rental_${currentUserId}_user_${renterId}`;

    const params = new URLSearchParams({
      room: uniqueChatId,
      receiver_id: renterId,
      name: `Penyewa: ${renterName}`,
    });
    if (renterAvatar) params.set("avatar", renterAvatar);

    navigate(`/chat?${params.toString()}`);
  };

  // Navigasi ke Halaman Chat Perental <-> Driver.
  // Guard dan alasan yang sama persis seperti handleOpenChatWithRenter di
  // atas -- lihat komentar di sana.
  const handleOpenChatWithDriver = (driver: any) => {
    if (!user?.id) {
      alert("Data akun belum siap, coba lagi sesaat lagi.");
      return;
    }

    const driverId = driver?.id != null ? String(driver.id) : "";
    if (!driverId) {
      alert("ID Driver tidak valid.");
      return;
    }

    const driverName = driver?.name || "Driver";
    const driverAvatar = driver?.avatar || "";
    const currentUserId = String(user.id);

    // Catatan skema chatId sama seperti di handleOpenChatWithRenter --
    // pastikan sisi Driver (kalau punya halaman chat sendiri ke Perental)
    // memakai format yang identik untuk room yang sama.
    const uniqueChatId = `room_rental_${currentUserId}_driver_${driverId}`;

    const params = new URLSearchParams({
      room: uniqueChatId,
      receiver_id: driverId,
      name: `Driver: ${driverName}`,
    });
    if (driverAvatar) params.set("avatar", driverAvatar);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
      case "active":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "completed":
        return "text-green-600 bg-green-50 border-green-200";
      case "cancelled":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-orange-600 bg-orange-50 border-orange-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return "Dikonfirmasi";
      case "active": return "Berlangsung";
      case "completed": return "Selesai";
      case "cancelled": return "Dibatalkan";
      case "pending": return "Menunggu";
      default: return status || "-";
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
          <h1 className="text-2xl font-bold text-gray-800">Kelola Pesanan & Driver</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola status pesanan masuk, verifikasi pembayaran, dan penugasan driver.</p>
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
            <p className="text-gray-600 font-semibold text-lg">Belum ada pesanan masuk.</p>
            <p className="text-gray-400 text-sm mt-1">Pesanan yang dibuat oleh penyewa untuk kendaraan Anda akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const car = booking.car || {};
              const renter = booking.user || {};
              const driver = booking.driver;
              const status = booking.status || "pending";
              const paymentStatus = booking.payment_status || "unpaid";
              const paymentMethod = booking.payment_method || "cod";
              const withDriver = booking.with_driver === 1 || booking.with_driver === true;
              const isPaid = paymentStatus === "paid";
              const isCheckingThisPayment = checkingPaymentIds.includes(booking.id);

              return (
                <div key={booking.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                  
                  {/* Header Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-800 text-lg">{car.name || "Mobil Rental"}</h3>
                        <button
                          onClick={() => handleOpenChatWithRenter(renter)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl text-xs font-semibold transition-all"
                          title="Chat Penyewa"
                        >
                          <FiMessageSquare size={13} /> Chat Penyewa
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Penyewa: <strong className="text-gray-700">{renter.name || "Tidak diketahui"}</strong> (#ID: {booking.id})</p>
                    </div>

                    {/* Selector Status Interaktif */}
                    <div>
                      <select
                        value={status}
                        onChange={(e) => handleUpdateStatus(booking.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase border focus:outline-none cursor-pointer ${getStatusColor(status)}`}
                      >
                        {statusOptions.map((st) => (
                          <option key={st} value={st} className="text-gray-800 font-normal">
                            {getStatusLabel(st)}
                          </option>
                        ))}
                      </select>
                    </div>
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

                  {/* Panel Cek Pembayaran QRIS (Jika metode QRIS dan belum lunas) */}
                  {paymentMethod === "qris" && !isPaid && (
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between gap-3">
                      <div className="text-xs text-blue-900 font-medium">
                        Menunggu penyewa menyelesaikan pembayaran QRIS. Anda dapat mengecek status terbarunya di sini.
                      </div>
                      <button
                        disabled={isCheckingThisPayment}
                        onClick={() => handleCheckPaymentStatus(booking.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                      >
                        {isCheckingThisPayment && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        Cek Status Pembayaran
                      </button>
                    </div>
                  )}

                  {/* Panel Penugasan Driver (Jika with_driver aktif) */}
                  {withDriver && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg ${driver ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            <FiUserCheck size={16} />
                          </div>
                          <div>
                            <span className="text-[11px] text-gray-400 block">Driver Bertugas</span>
                            <span className={`text-xs font-bold ${driver ? "text-green-700" : "text-red-600"}`}>
                              {driver ? driver.name : "Belum Ditugaskan"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {driver && (
                            <button
                              onClick={() => handleOpenChatWithDriver(driver)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-all"
                            >
                              <FiMessageSquare size={13} /> Chat Driver
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAssignDriver(booking.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold transition-all"
                          >
                            <FiUserPlus size={13} /> {driver ? "Ganti Driver" : "Tugaskan Driver"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* Modal Pilih Driver */}
        {assigningBookingId !== null && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl relative">
              <button
                onClick={() => setAssigningBookingId(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>

              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <FiUserPlus size={24} />
              </div>

              <h3 className="font-bold text-gray-800 text-lg text-center">Tugaskan Driver</h3>
              <p className="text-xs text-gray-500 text-center">Pilih driver yang tersedia di sistem untuk pesanan ini.</p>

              {isDriversLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : availableDrivers.length === 0 ? (
                <p className="text-xs text-red-500 text-center py-4">Tidak ada driver yang tersedia saat ini.</p>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 block">Pilih Nama Driver</label>
                  <select
                    value={selectedDriverId || ""}
                    onChange={(e) => setSelectedDriverId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Pilih Driver --</option>
                    {availableDrivers.map((drv) => (
                      <option key={drv.id} value={drv.id}>
                        {drv.name} ({drv.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  disabled={!selectedDriverId}
                  onClick={handleSubmitAssignDriver}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FiCheck size={16} /> Simpan & Tugaskan
                </button>
                <button
                  onClick={() => setAssigningBookingId(null)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default RentalsBookingPage;