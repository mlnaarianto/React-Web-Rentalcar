import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiSend, FiLock, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import api from "../lib/axios";
import echo from "../lib/echo";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../layouts/AppLayout";

export const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  const chatId = searchParams.get("room") || "";
  const receiverName = searchParams.get("name") || "Perental";
  const receiverAvatarUrl = searchParams.get("avatar") || "";

  // 🔴 FIX: sebelumnya ada fallback `|| "1"` di sini. Itu berbahaya --
  // kalau param receiver_id hilang/kosong di URL (mis. link dari halaman
  // daftar chat lupa menyertakannya), chat tetap bisa dipakai normal
  // (pesan tetap terkirim & muncul di room), TAPI notifikasi
  // (Notification::create di backend) diam-diam dibuat untuk user ID "1"
  // -- bukan customer yang sebenarnya sedang diajak chat. Akibatnya
  // penerima asli tidak pernah menerima notifikasi/badge, walau pesan
  // chat itu sendiri terlihat terkirim sukses.
  //
  // Sekarang: kalau param tidak ada / kosong, jadikan null secara
  // eksplisit supaya bisa dideteksi & diblokir SEBELUM sempat mengirim
  // notifikasi ke user yang salah.
  const receiverIdParamRaw = searchParams.get("receiver_id");
  const receiverIdParam =
    receiverIdParamRaw && receiverIdParamRaw.trim() !== ""
      ? receiverIdParamRaw
      : null;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(true);

  // State untuk modal/popup konfirmasi hapus pesan
  const [selectedMessageToDelete, setSelectedMessageToDelete] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.id ? String(user.id) : "";
  const currentUserName = user?.name || "Penyewa";

  const [realChatId, setRealChatId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Menyeragamkan bentuk data pesan dari 3 sumber berbeda (fetch riwayat,
  // event Echo 'message.sent', dan response setelah kirim pesan) menjadi
  // satu format konsisten yang dipakai UI.
  //
  // PENTING: nama pengirim SENGAJA tidak diambil dari field 'sender_name'
  // backend, karena backend tidak pernah mengirim field flat 'sender_name'
  // yang reliable -- terutama di payload event socket, yang kadang tidak
  // menyertakannya sama sekali. Pola ini sama persis dengan
  // _normalizeMessage di ChatPage Flutter. Karena room chat ini selalu
  // 1-lawan-1 (chatId unik per pasangan user <-> admin/CS), nama pengirim
  // bisa disimpulkan dengan aman hanya dari sender_id, tanpa bergantung ke
  // bentuk response backend yang bisa berubah-ubah.
  const normalizeMessage = (raw: any) => {
    const senderId = raw?.sender_id != null ? String(raw.sender_id) : "";
    const senderName =
      senderId === currentUserId ? currentUserName : receiverName;

    return {
      id: raw?.id,
      text: raw?.text ?? "",
      sender_id: senderId,
      sender_name: senderName,
      created_at: raw?.created_at,
    };
  };

  // 🔴 FIX: log eksplisit begitu terdeteksi halaman ini dibuka tanpa
  // receiver_id yang valid, supaya kejadian ini gampang ditemukan lewat
  // console / error tracking (mis. Sentry) daripada gagal diam-diam.
  useEffect(() => {
    if (!authLoading && user && chatId && !receiverIdParam) {
      console.error(
        `ChatPage dibuka tanpa receiver_id yang valid (room=${chatId}). ` +
          `Notifikasi TIDAK akan dikirim sampai halaman ini dibuka ulang ` +
          `dengan receiver_id yang benar dari daftar percakapan.`
      );
    }
  }, [authLoading, user, chatId, receiverIdParam]);

  // 1. Fetch Pesan Awal & Resolve ID numeric asli
  useEffect(() => {
    if (!chatId) return;

    const initChat = async () => {
      try {
        const resMessages = await api.get(`/api/chats/${chatId}/messages`);
        const fetchedMessages = resMessages.data.data || [];

        setMessages(fetchedMessages.map((msg: any) => normalizeMessage(msg)));
        setIsLoadingMessages(false);
        setTimeout(scrollToBottom, 100);

        const resResolve = await api.get(`/api/chats/${chatId}/resolve`);
        if (resResolve.data && resResolve.data.chat_id) {
          setRealChatId(String(resResolve.data.chat_id));
        } else {
          setRealChatId(chatId);
        }
      } catch (error) {
        console.error("Gagal menginisialisasi chat:", error);
        setIsLoadingMessages(false);
      }
    };

    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // 2. Real-time Listener menggunakan Laravel Echo & Reverb
  useEffect(() => {
    if (!realChatId) return;

    const channelName = `chat.${realChatId}`;
    console.log(`Mengaktifkan Echo listener ke channel: private-${channelName}`);

    const channel = echo.private(channelName);

    channel.listen(".message.sent", (e: any) => {
      const normalized = normalizeMessage(e.message);

      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === normalized.id);
        if (alreadyExists) return prev;
        return [...prev, normalized];
      });

      setTimeout(scrollToBottom, 100);
    });

    // Tangkap event pesan dihapus secara real-time
    channel.listen(".message.deleted", (e: any) => {
      const deletedId = e.message_id;
      setMessages((prev) => prev.filter((m) => m.id !== deletedId));
    });

    return () => {
      echo.leave(channelName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realChatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !chatId) return;

    // 🔴 FIX: blokir pengiriman kalau receiver_id tidak ada/valid.
    // Lebih baik user tidak bisa kirim pesan sama sekali daripada pesan
    // terkirim tapi notifikasi diam-diam nyasar ke user lain.
    if (!receiverIdParam) {
      alert(
        "Tidak bisa mengirim pesan: penerima tidak teridentifikasi. " +
          "Silakan kembali ke daftar percakapan dan buka chat ini lagi."
      );
      return;
    }

    const messageText = inputText.trim();
    setInputText("");

    try {
      const response = await api.post("/api/messages", {
        chat_id: realChatId || chatId,
        receiver_id: receiverIdParam,
        text: messageText,
      });

      const sentMessage = response.data.data;

      if (sentMessage?.id) {
        const normalized = normalizeMessage(sentMessage);
        setMessages((prev) => {
          const alreadyExists = prev.some((m) => m.id === normalized.id);
          if (alreadyExists) return prev;
          return [...prev, normalized];
        });
        setTimeout(scrollToBottom, 100);
      }

      if (!realChatId && sentMessage?.chat_id) {
        setRealChatId(String(sentMessage.chat_id));
      }
    } catch (err: any) {
      console.error("Gagal mengirim pesan:", err.response?.data || err.message);
      alert("Pesan gagal terkirim. Periksa koneksi Anda.");
    }
  };

  // Fungsi untuk menghapus pesan
  const handleDeleteMessage = async (msgToDelete: any) => {
    if (!msgToDelete || !msgToDelete.id) return;

    const messageId = msgToDelete.id;

    // Optimistic update: hapus dari UI terlebih dahulu
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setSelectedMessageToDelete(null);

    try {
      const response = await api.delete(`/api/messages/${messageId}`);
      if (response.status !== 200) {
        throw new Error("Gagal menghapus pesan di server");
      }
    } catch (err: any) {
      console.error("Gagal menghapus pesan:", err.response?.data || err.message);
      alert("Gagal menghapus pesan. Silakan coba lagi.");
      // Rollback jika gagal: fetch ulang dan normalisasi ulang datanya
      const resMessages = await api.get(`/api/chats/${chatId}/messages`);
      if (resMessages.data && resMessages.data.data) {
        setMessages(resMessages.data.data.map((msg: any) => normalizeMessage(msg)));
      }
    }
  };

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  };

  const formatTime = (rawTime: any) => {
    if (!rawTime) return "";
    const date = new Date(rawTime);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const formatDateSeparator = (rawTime: any) => {
    if (!rawTime) return "";
    const date = new Date(rawTime);
    if (isNaN(date.getTime())) return "";
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Hari ini";
    if (isYesterday) return "Kemarin";

    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Memuat sesi...</div>;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  // 🔴 FIX: tampilkan halaman peringatan yang jelas kalau chat dibuka
  // tanpa receiver_id yang valid, daripada membiarkan user mengetik &
  // mengira pesan+notifikasi terkirim normal padahal tidak.
  if (chatId && !receiverIdParam) {
    return (
      <AppLayout user={user} logout={logout}>
        <div className="max-w-lg mx-auto mt-10 bg-white p-6 rounded-2xl border border-red-200 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <FiAlertTriangle size={26} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Chat tidak bisa dibuka</h3>
          <p className="text-sm text-gray-500 mb-6">
            Data penerima pesan tidak ditemukan pada tautan ini, sehingga notifikasi
            tidak bisa dikirim dengan benar. Silakan kembali ke daftar percakapan dan
            buka chat ini lagi.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Kembali ke daftar percakapan
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user} logout={logout}>
      <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            aria-label="Kembali"
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer shrink-0"
          >
            <FiArrowLeft size={18} />
          </button>

          <div className="relative w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center overflow-hidden font-semibold text-xs shrink-0">
            {receiverAvatarUrl ? (
              <img src={receiverAvatarUrl} alt={receiverName} className="w-full h-full object-cover" />
            ) : (
              getInitials(receiverName)
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-800 leading-tight truncate">{receiverName}</h3>
            <p className="text-xs text-emerald-600 leading-tight">Online</p>
          </div>
        </div>

        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold shrink-0">
          <FiLock size={11} /> Terenkripsi
        </span>
      </div>

      <div className="min-h-[45vh] pb-28">
        {isLoadingMessages ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-gray-200 border-t-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100 text-sm">
            <FiLock size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-gray-700 font-medium text-sm">Pesan aman dan terenkripsi</p>
            <p className="text-gray-400 text-xs mt-1">
              Mulai percakapan terkait penyewaan kendaraan dengan {receiverName}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, index) => {
              const isMe = String(msg.sender_id) === String(currentUserId);

              let showDateSeparator = false;
              if (msg.created_at) {
                if (index === 0) {
                  showDateSeparator = true;
                } else {
                  const prevMsg = messages[index - 1];
                  if (prevMsg.created_at && msg.created_at) {
                    const prevDate = new Date(prevMsg.created_at);
                    const currDate = new Date(msg.created_at);
                    showDateSeparator = prevDate.toDateString() !== currDate.toDateString();
                  }
                }
              }

              return (
                <React.Fragment key={msg.id || index}>
                  {showDateSeparator && msg.created_at && (
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-[11px] font-medium text-gray-500">
                        {formatDateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      onClick={isMe ? () => setSelectedMessageToDelete(msg) : undefined}
                      title={isMe ? "Klik untuk opsi hapus pesan" : ""}
                      className={`max-w-[85%] sm:max-w-[55%] rounded-2xl px-4 py-2.5 space-y-1 ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-md cursor-pointer hover:bg-blue-700 transition-colors"
                          : "bg-white text-gray-900 rounded-bl-md border border-gray-100 shadow-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                      <div
                        className={`text-[10px] ${
                          isMe ? "text-blue-100 text-right" : "text-gray-400 text-left"
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Modal / Bottom Sheet Konfirmasi Hapus Pesan */}
      {selectedMessageToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Hapus Pesan</h3>
            <p className="text-sm text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus pesan ini? Pesan yang dihapus akan hilang dari sistem.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedMessageToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMessage(selectedMessageToDelete)}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
              >
                <FiTrash2 size={16} /> Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="sticky bottom-4 sm:bottom-6 bg-white p-2.5 rounded-2xl border border-gray-200 shadow-md flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ketik pesan..."
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          aria-label="Kirim pesan"
          className="w-10 h-10 shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-full transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
        >
          <FiSend size={16} />
        </button>
      </form>
    </AppLayout>
  );
};

export default ChatPage;