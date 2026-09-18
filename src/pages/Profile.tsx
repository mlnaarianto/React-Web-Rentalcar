import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../layouts/AppLayout";
import api from "../lib/axios";
import {
  FiUser,
  FiCalendar,
  FiSave,
  FiCheckCircle,
  FiUploadCloud,
  FiCreditCard,
  FiFileText,
  FiZoomIn,
  FiX,
  FiEdit2,
} from "react-icons/fi";

/**
 * Normalisasi nomor HP dari server ke format internasional (E.164).
 * Data lama bisa berformat "0812...", "62812...", atau sudah "+62812...".
 */
const normalizePhone = (raw?: string): string => {
  if (!raw) return "";
  const cleaned = raw.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0")) return "+62" + cleaned.slice(1);
  if (cleaned.startsWith("62")) return "+" + cleaned;
  return cleaned;
};

const Profile: React.FC = () => {
  const { user, logout, fetchUser } = useAuth();

  // State Form Utama
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); // format E.164, mis. "+6281234567890"
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");

  // State Form SIM
  const [simNumber, setSimNumber] = useState("");
  const [simType, setSimType] = useState("");
  const [simExpiredDate, setSimExpiredDate] = useState("");

  // State File & Preview URL untuk KTP & SIM
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpPreview, setKtpPreview] = useState<string | null>(null);

  const [simFile, setSimFile] = useState<File | null>(null);
  const [simPreview, setSimPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // State untuk Modal Zoom Gambar Fullscreen
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // State untuk mendeteksi jika foto profil Google broken
  const [avatarError, setAvatarError] = useState(false);

  // Sync state ketika data user berubah / termuat dari API
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");

      const personal = (user as any).personal_data || {};
      setPhone(normalizePhone(personal.phone));
      setBirthDate(personal.birth_date ? personal.birth_date.split("T")[0] : "");
      setAddress(personal.address || "");

      setSimNumber(personal.sim_number || "");
      setSimType(personal.sim_type || "");
      setSimExpiredDate(personal.sim_expired_date ? personal.sim_expired_date.split("T")[0] : "");

      if (personal.ktp_image) setKtpPreview(personal.ktp_image);
      if (personal.sim_image) setSimPreview(personal.sim_image);
    }
  }, [user]);

  if (!user) {
    return null;
  }

  // Handle pilih file KTP
  const handleKtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setKtpFile(file);
      setKtpPreview(URL.createObjectURL(file));
    }
  };

  // Handle pilih file SIM
  const handleSimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSimFile(file);
      setSimPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi nomor HP (format internasional)
    if (!phone || !isValidPhoneNumber(phone)) {
      Swal.fire({
        icon: "warning",
        title: "Nomor HP tidak valid",
        text: "Periksa kembali nomor HP dan kode negaranya.",
        confirmButtonColor: "#2563EB",
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("_method", "PATCH");
      formData.append("name", name);
      formData.append("phone", phone); // sudah E.164 (+62...)
      formData.append("birth_date", birthDate);
      formData.append("address", address);
      formData.append("sim_number", simNumber);
      formData.append("sim_type", simType);
      formData.append("sim_expired_date", simExpiredDate);

      if (ktpFile) {
        formData.append("ktp", ktpFile);
      }

      if (simFile) {
        formData.append("sim_image", simFile);
      }

      await api.post("/api/user", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      await fetchUser();

      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Data personal & SIM berhasil disimpan.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      // Gabungkan semua pesan validasi 422 dari Laravel (sama seperti di Flutter)
      const data = err.response?.data;
      const validationMessages = data?.errors
        ? Object.values(data.errors).flat().join("\n")
        : null;

      Swal.fire({
        icon: "error",
        title: "Gagal",
        text:
          validationMessages ||
          data?.message ||
          "Terjadi kesalahan saat memperbarui profil.",
        confirmButtonColor: "#2563EB",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout user={user} logout={logout}>
      {/* Header Halaman */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Lengkapi Data & SIM</h2>
        <p className="text-gray-600 mt-1">
          Kelola informasi akun, verifikasi data personal, dan dokumen SIM Anda.
        </p>
      </div>

      <form onSubmit={handleUpdateProfile} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Kolom Kiri: Kartu Ringkasan Akun & KTP */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col items-center text-center">
              <div
                className="relative mb-4 group cursor-pointer"
                onClick={() =>
                  user.avatar && !avatarError && setZoomImage({ url: user.avatar, title: "Foto Profil" })
                }
              >
                {user.avatar && !avatarError ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    onError={() => setAvatarError(true)}
                    className="w-24 h-24 rounded-full object-cover border-4 border-blue-500 shadow-md transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                {user.avatar && !avatarError && (
                  <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FiZoomIn className="text-white h-6 w-6" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 h-5 w-5 bg-green-500 rounded-full border-4 border-white"></span>
              </div>

              <h3 className="text-xl font-bold text-gray-800">{user.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{user.email}</p>

              <div className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 text-[#2563EB] rounded-full text-xs font-semibold mb-6">
                <FiCheckCircle className="h-4 w-4" />
                Akun Terverifikasi
              </div>

              <div className="w-full border-t border-gray-100 pt-4 text-left space-y-3">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Metode Masuk:</span>
                  <span className="font-semibold text-gray-700 uppercase">
                    {user.login_type || "Google"}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ID Pengguna:</span>
                  <span className="font-semibold text-gray-700">#{user.id}</span>
                </div>
              </div>
            </div>

            {/* Kartu Upload KTP dengan Tombol Zoom */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <FiCreditCard className="text-[#2563EB]" /> Foto KTP
                </h4>
                {ktpPreview && (
                  <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-semibold">
                    Terupload
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Wajib diupload, pastikan foto jelas dan tidak buram.
              </p>

              <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-3 text-center hover:border-blue-500 transition-colors bg-gray-50">
                {ktpPreview ? (
                  <div className="relative group">
                    <img
                      src={ktpPreview}
                      alt="KTP Preview"
                      className="w-full h-36 object-cover rounded-lg mb-2 cursor-pointer"
                      onClick={() => setZoomImage({ url: ktpPreview, title: "Foto KTP" })}
                    />
                    {/* Floating Action Buttons */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setZoomImage({ url: ktpPreview, title: "Foto KTP" })}
                        className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors"
                        title="Perbesar Foto"
                      >
                        <FiZoomIn size={14} />
                      </button>
                      <label
                        className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors cursor-pointer"
                        title="Ganti Foto"
                      >
                        <FiEdit2 size={14} />
                        <input type="file" accept="image/*" onChange={handleKtpChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center py-4">
                    <FiUploadCloud className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-xs font-medium text-gray-600">Ketuk untuk upload KTP</span>
                    <input type="file" accept="image/*" onChange={handleKtpChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Form Data Personal & SIM */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bagian Akun & Data Personal */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center gap-3 text-white">
                <FiUser className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Data Personal & Akun</h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama (Dari Google)
                    </label>
                    <input
                      type="text"
                      value={name}
                      disabled
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nomor HP dengan kode negara */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nomor HP / WhatsApp
                    </label>
                    <PhoneInput
                      international
                      defaultCountry="ID"
                      countryCallingCodeEditable={false}
                      value={phone}
                      onChange={(value) => setPhone(value || "")}
                      placeholder="Contoh: 812 3456 7890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        <FiCalendar />
                      </span>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Masukkan alamat domisili saat ini"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Bagian Informasi & Foto SIM */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center gap-3 text-white">
                <FiFileText className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Informasi SIM (Driver / Penyewa)</h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nomor SIM</label>
                    <input
                      type="text"
                      value={simNumber}
                      onChange={(e) => setSimNumber(e.target.value)}
                      placeholder="Masukkan nomor SIM"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Golongan SIM</label>
                    <input
                      type="text"
                      value={simType}
                      onChange={(e) => setSimType(e.target.value)}
                      placeholder="Contoh: A, C, B1"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Masa Berlaku SIM</label>
                  <input
                    type="date"
                    value={simExpiredDate}
                    onChange={(e) => setSimExpiredDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                {/* Upload Foto SIM dengan Tombol Zoom */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Foto SIM</label>
                    {simPreview && (
                      <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-semibold">
                        Terupload
                      </span>
                    )}
                  </div>
                  <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-3 text-center hover:border-orange-500 transition-colors bg-gray-50">
                    {simPreview ? (
                      <div className="relative group">
                        <img
                          src={simPreview}
                          alt="SIM Preview"
                          className="w-full h-40 object-cover rounded-lg mb-2 cursor-pointer"
                          onClick={() => setZoomImage({ url: simPreview, title: "Foto SIM" })}
                        />
                        {/* Floating Action Buttons */}
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setZoomImage({ url: simPreview, title: "Foto SIM" })}
                            className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors"
                            title="Perbesar Foto"
                          >
                            <FiZoomIn size={14} />
                          </button>
                          <label
                            className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors cursor-pointer"
                            title="Ganti Foto"
                          >
                            <FiEdit2 size={14} />
                            <input type="file" accept="image/*" onChange={handleSimChange} className="hidden" />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center py-4">
                        <FiUploadCloud className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-xs font-medium text-gray-600">Ketuk untuk upload foto SIM</span>
                        <input type="file" accept="image/*" onChange={handleSimChange} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tombol Simpan */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-sm px-8 py-3 rounded-xl shadow-md shadow-blue-500/20 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              >
                <FiSave className="h-5 w-5" />
                <span>{loading ? "Menyimpan..." : "Simpan Data Personal & SIM"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* MODAL ZOOM / PREVIEW GAMBAR FULLSCREEN */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fadeIn"
          onClick={() => setZoomImage(null)}
        >
          {/* Header Modal */}
          <div className="absolute top-4 left-6 right-6 flex justify-between items-center text-white">
            <span className="text-sm font-semibold tracking-wide">{zoomImage.title}</span>
            <button
              onClick={() => setZoomImage(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              title="Tutup"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Gambar yang Di-zoom */}
          <div
            className="relative max-w-4xl max-h-[80vh] overflow-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImage.url}
              alt={zoomImage.title}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl transition-transform duration-200 cursor-zoom-in hover:scale-105"
            />
          </div>
          <p className="text-white/60 text-xs mt-4">Klik di luar gambar atau tombol X untuk keluar</p>
        </div>
      )}
    </AppLayout>
  );
};

export default Profile;