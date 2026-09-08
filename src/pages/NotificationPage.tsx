import React, { useState, useEffect } from "react";
import { 
  FiBell, 
  FiAlertCircle, 
  FiRefreshCw, 
  FiBookmark, 
  FiDollarSign, 
  FiMapPin, 
  FiXCircle, 
  FiClock, 
  FiBellOff,
  FiTrash2,
  FiTrash
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../layouts/AppLayout";
import api from "../lib/axios";
import echo from "../lib/echo"; // 🟢 TAMBAHAN: koneksi real-time Reverb

export const NotificationPage: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 🟢 TAMBAHAN: state untuk modal konfirmasi "Hapus Semua"
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // 🟢 TAMBAHAN: id notifikasi yang sedang dalam proses hapus (biar bisa dikasih spinner kecil)
  const [deletingIds, setDeletingIds] = useState<Set<number | string>>(new Set());

  // Ambil data notifikasi dari API backend
  const fetchNotifications = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get("/api/notifications");
      if (response.data.status === "success" || response.data.data) {
        setNotifications(response.data.data || []);
      } else {
        setErrorMessage("Gagal memuat notifikasi.");
      }
    } catch (err: any) {
      console.error("Gagal mengambil notifikasi:", err);
      setErrorMessage(err.response?.data?.message || `Terjadi kesalahan koneksi: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Tandai sudah dibaca otomatis saat halaman dibuka
  const markNotificationsAsRead = async () => {
    try {
      await api.post("/api/notifications/read-all");
    } catch (_) {
      // Abaikan error jika gagal agar tidak mengganggu UI
    }
  };

  // 🟢 TAMBAHAN: Hapus satu notifikasi (optimistic update, rollback kalau gagal)
  const deleteSingleNotification = async (notifId: number | string) => {
    const targetIndex = notifications.findIndex((n) => n.id === notifId);
    if (targetIndex === -1) return;

    const deletedNotif = notifications[targetIndex];

    // Tandai sedang dihapus (untuk spinner kecil di ikon trash)
    setDeletingIds((prev) => new Set(prev).add(notifId));

    // 1. Optimistic UI update: hapus dulu dari tampilan
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));

    try {
      await api.delete(`/api/notifications/${notifId}`);
    } catch (err) {
      console.error("Gagal menghapus notifikasi:", err);
      // Rollback: kembalikan ke posisi semula kalau gagal
      setNotifications((prev) => {
        const next = [...prev];
        next.splice(targetIndex, 0, deletedNotif);
        return next;
      });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    }
  };

  // 🟢 TAMBAHAN: Hapus semua notifikasi
  const clearAllNotifications = async () => {
    setIsClearing(true);
    try {
      await api.delete("/api/notifications");
      setNotifications([]);
    } catch (err) {
      console.error("Gagal menghapus semua notifikasi:", err);
      setErrorMessage("Gagal menghapus semua notifikasi.");
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchNotifications();
      markNotificationsAsRead();
    }
  }, [authLoading, user]);

  // 🟢 TAMBAHAN: Listener real-time — notifikasi baru langsung nempel
  // di atas list begitu event masuk dari Reverb, tanpa perlu refetch.
  useEffect(() => {
    if (!user) return;

    const channelName = `notifications.${user.id}`;

    echo
      .private(channelName)
      .listen(".notification.created", (event: { data: any }) => {
        setNotifications((prev) => {
          const alreadyExists = prev.some((n) => n.id === event.data.id);
          if (alreadyExists) return prev;
          return [event.data, ...prev];
        });
      });

    return () => {
      echo.leave(channelName);
    };
  }, [user]);

  // Helper Ikon berdasarkan tipe notifikasi
  const getNotifIcon = (type: string) => {
    switch (type) {
      case "booking":
        return <FiBookmark className="w-5 h-5 text-blue-600" />;
      case "payment":
        return <FiDollarSign className="w-5 h-5 text-green-600" />;
      case "driver_assignment":
        return <FiMapPin className="w-5 h-5 text-orange-500" />;
      case "booking_cancelled":
        return <FiXCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FiBell className="w-5 h-5 text-indigo-600" />;
    }
  };

  const getNotifColor = (type: string) => {
    switch (type) {
      case "booking":
        return "bg-blue-50 text-blue-600";
      case "payment":
        return "bg-green-50 text-green-600";
      case "driver_assignment":
        return "bg-orange-50 text-orange-500";
      case "booking_cancelled":
        return "bg-red-50 text-red-600";
      default:
        return "bg-indigo-50 text-indigo-600";
    }
  };

  const formatDate = (rawDate: string) => {
    if (!rawDate) return "";
    try {
      const date = new Date(rawDate);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (_) {
      return rawDate.split("T")[0];
    }
  };

  const formatTime = (rawDate: string) => {
    if (!rawDate) return "";
    try {
      const date = new Date(rawDate);
      return date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).replace(".", ":");
    } catch (_) {
      return "";
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
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        
        {/* Header Halaman */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Notifikasi Aktivitas</h1>
            <p className="text-sm text-gray-500 mt-1">Pantau informasi terbaru seputar pesanan, pembayaran, dan penugasan Anda.</p>
          </div>

          {/* 🟢 TAMBAHAN: Tombol Hapus Semua, hanya muncul kalau ada notifikasi */}
          {!isLoading && !errorMessage && notifications.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-all"
              title="Bersihkan Semua"
            >
              <FiTrash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          )}
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
              onClick={fetchNotifications}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              <FiRefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-3">
              <FiBellOff className="w-8 h-8" />
            </div>
            <p className="text-gray-600 font-semibold text-lg">Belum ada notifikasi kejadian.</p>
            <p className="text-gray-400 text-sm mt-1">Aktivitas terbaru seputar pesanan Anda akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const type = notif.type || "default";
              const isUnread = notif.is_read === false;
              const createdAt = notif.created_at || "";
              const isDeleting = deletingIds.has(notif.id);

              return (
                <div 
                  key={notif.id || Math.random()} 
                  className={`group p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                    isUnread 
                      ? "bg-blue-50/40 border-blue-100 shadow-sm" 
                      : "bg-white border-gray-100 shadow-sm"
                  } ${isDeleting ? "opacity-50" : ""}`}
                >
                  <div className={`p-3 rounded-full flex-shrink-0 ${getNotifColor(type)}`}>
                    {getNotifIcon(type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={`text-sm font-bold truncate ${isUnread ? "text-gray-900" : "text-gray-800"}`}>
                        {notif.title || "Informasi"}
                      </h3>
                      {isUnread && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      {notif.message || ""}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <FiClock size={12} />
                      <span>{formatDate(createdAt)} {formatTime(createdAt) ? `• ${formatTime(createdAt)}` : ""}</span>
                    </div>
                  </div>

                  {/* 🟢 TAMBAHAN: Tombol hapus satu notifikasi */}
                  <button
                    onClick={() => deleteSingleNotification(notif.id)}
                    disabled={isDeleting}
                    className="flex-shrink-0 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Hapus notifikasi ini"
                  >
                    <FiTrash size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 🟢 TAMBAHAN: Modal konfirmasi Hapus Semua */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Hapus Semua Notifikasi?</h3>
            <p className="text-sm text-gray-500 mb-6">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={clearAllNotifications}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isClearing && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default NotificationPage;