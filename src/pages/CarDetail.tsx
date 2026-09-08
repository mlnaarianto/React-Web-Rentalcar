import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import YouTube from "react-youtube";
import { AppLayout } from "../layouts/AppLayout";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/axios";
import {
  FiArrowLeft, FiTruck, FiUser, FiSettings,
  FiFileText, FiCheckCircle, FiXCircle, FiPlayCircle,
  FiMapPin, FiMap, FiExternalLink, FiCopy, FiCheck,
  FiZoomIn, FiX, FiNavigation
} from "react-icons/fi";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icon marker Leaflet bawaan agar tampil sempurna di React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Car {
  id: number;
  name: string;
  brand: string;
  plate_number: string;
  engine_type: string;
  fuel_spec?: string;
  seats: number;
  year: number;
  price_per_day: number;
  driver_price_per_day?: number;
  description?: string;
  image?: string;
  video_url?: string;
  status: string;
  user?: {
    name: string;
    email: string;
    personal_data?: {
      phone?: string;
      address?: string;
    };
    rental_application?: {
      business_name?: string;
      formatted_address?: string;
      business_address?: string;
      latitude?: string | number;
      longitude?: string | number;
    };
  };
}

const CarDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState<boolean>(false);

  // State untuk Modal Zoom Gambar, Player Instance YouTube, & Durasi Video
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  useEffect(() => {
    const fetchCarDetail = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/cars/${id}`);
        if (response.data.status === "success") {
          setCar(response.data.data);
        }
      } catch (err: any) {
        console.error("Gagal memuat detail mobil:", err);
        setErrorMessage("Gagal memuat detail mobil atau data tidak ditemukan.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCarDetail();
    }
  }, [id]);

  // Interval untuk melacak durasi real-time dari instance player YouTube di dalam kartu
  useEffect(() => {
    let interval: any;
    if (playerInstance && isVideoPlaying) {
      interval = setInterval(() => {
        try {
          const time = playerInstance.getCurrentTime();
          if (typeof time === "number") {
            setCurrentTime(time);
          }
        } catch (e) {}
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playerInstance, isVideoPlaying]);

  if (authLoading || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Memuat detail kendaraan...</div>;
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
  };

  const getCarImageUrl = (imagePath?: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `http://localhost:8000${cleanPath}`;
  };

  const extractYoutubeId = (url: string) => {
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const resolveVideoUrl = (url: string) => {
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
  };

  if (errorMessage || !car) {
    return (
      <AppLayout user={user} logout={() => {}}>
        <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg mx-auto mt-10">
          <p className="text-red-500 font-semibold mb-4">{errorMessage || 'Mobil tidak ditemukan.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </AppLayout>
    );
  }

  const owner = car.user;
  const personalData = owner?.personal_data;
  const isAvailable = car.status === 'tersedia';

  const rentalApplication = owner?.rental_application;
  const businessName = rentalApplication?.business_name?.toString() || "";
  const businessAddress =
    rentalApplication?.formatted_address?.toString() ||
    rentalApplication?.business_address?.toString() ||
    "";
  const businessLat =
    rentalApplication?.latitude !== undefined && rentalApplication?.latitude !== null
      ? Number(rentalApplication.latitude)
      : null;
  const businessLng =
    rentalApplication?.longitude !== undefined && rentalApplication?.longitude !== null
      ? Number(rentalApplication.longitude)
      : null;
  const hasLocation =
    businessLat !== null && businessLng !== null && !isNaN(businessLat) && !isNaN(businessLng);

  const openInGoogleMaps = () => {
    if (!hasLocation) return;
    const label = encodeURIComponent(car.name || 'Lokasi Usaha');
    const url = `https://www.google.com/maps/search/?api=1&query=${businessLat},${businessLng}&query_place_id=${label}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openDirections = () => {
    if (!hasLocation) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${businessLat},${businessLng}&mode=d`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyAddress = async () => {
    if (!businessAddress) return;
    try {
      await navigator.clipboard.writeText(businessAddress);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin alamat:", err);
    }
  };

  const youtubeId = car.video_url ? extractYoutubeId(car.video_url) : null;
  const isYoutube = Boolean(youtubeId);

  const handleOpenYouTubeWithTimestamp = () => {
    if (youtubeId) {
      let seconds = currentTime;
      if (playerInstance && typeof playerInstance.getCurrentTime === "function") {
        try {
          seconds = playerInstance.getCurrentTime();
        } catch (e) {}
      }

      const secondsInt = Math.floor(seconds);
      const targetUrl = secondsInt > 1 
        ? `https://www.youtube.com/watch?v=${youtubeId}&t=${secondsInt}s`
        : `https://www.youtube.com/watch?v=${youtubeId}`;
      
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AppLayout user={user} logout={() => {}}>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Tombol Kembali & Header Gambar */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 transition-all mb-4"
          >
            <FiArrowLeft size={16} /> Kembali
          </button>

          <div className="h-72 sm:h-96 w-full rounded-2xl overflow-hidden relative shadow-md bg-gray-100 group">
            {car.image ? (
              <div 
                className="w-full h-full cursor-zoom-in relative"
                onClick={() => setZoomImage({ url: getCarImageUrl(car.image), title: car.name })}
              >
                <img
                  src={getCarImageUrl(car.image)}
                  alt={car.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/60 text-white px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-sm text-sm font-medium shadow-lg">
                    <FiZoomIn size={18} /> Perbesar Foto
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <FiTruck size={64} />
              </div>
            )}
          </div>
        </div>

        {/* Grid Informasi Utama */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                  {car.brand}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mt-2">{car.name}</h1>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isAvailable ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
                {car.status}
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">Harga Sewa / Hari</p>
                <p className="text-xl font-bold text-blue-600 mt-0.5">{formatPrice(car.price_per_day)}</p>
              </div>
              <div className="border-l pl-4 border-gray-100">
                <p className="text-xs text-gray-500">Jasa Driver / Hari</p>
                <p className="text-xl font-bold text-orange-500 mt-0.5">{formatPrice(car.driver_price_per_day || 0)}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FiSettings className="text-blue-600" /> Spesifikasi Kendaraan
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[11px] text-gray-400">Plat Nomor</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{car.plate_number}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[11px] text-gray-400">Tipe Mesin</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{car.engine_type}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[11px] text-gray-400">Spesifikasi BBM</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{car.fuel_spec || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[11px] text-gray-400">Kapasitas Kursi</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{car.seats} Kursi</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[11px] text-gray-400">Tahun Pembuatan</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{car.year}</p>
                </div>
              </div>
            </div>

            {(hasLocation || businessName || businessAddress) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 pb-4">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <FiMap className="text-orange-500" /> Lokasi Usaha
                  </h3>
                  {businessName && (
                    <p className="text-xs text-gray-500 mt-1">{businessName}</p>
                  )}
                </div>

                {hasLocation && (
                  <div className="relative h-[320px] w-full border-y border-gray-100 group">
                    <MapContainer
                      key={`${businessLat}-${businessLng}`}
                      center={[businessLat as number, businessLng as number]}
                      zoom={16}
                      zoomControl={false}
                      scrollWheelZoom={true}
                      style={{ height: "100%", width: "100%" }}
                      className="z-0"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ZoomControl position="bottomright" />
                      <Marker position={[businessLat as number, businessLng as number]}>
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold text-gray-800">
                              {businessName || "Lokasi Usaha"}
                            </p>
                            {businessAddress && (
                              <p className="text-gray-600 mt-1">{businessAddress}</p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>

                    <div className="absolute top-3 left-3 z-[400] flex gap-2">
                      <button
                        onClick={openInGoogleMaps}
                        className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-md text-xs font-semibold text-gray-700 hover:bg-white hover:text-blue-600 transition-all border border-gray-200"
                      >
                        <FiExternalLink size={13} /> Google Maps
                      </button>
                      <button
                        onClick={openDirections}
                        className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-2 rounded-lg shadow-md text-xs font-semibold text-white hover:bg-blue-700 transition-all"
                      >
                        <FiNavigation size={13} /> Rute
                      </button>
                    </div>
                  </div>
                )}

                {(businessAddress || hasLocation) && (
                  <div className="p-6 pt-4">
                    {businessAddress && (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <FiMapPin className="mt-0.5 text-gray-400 flex-shrink-0" size={15} />
                          <div>
                            <p className="text-[11px] text-gray-400">Alamat Usaha</p>
                            <p className="text-sm font-semibold text-gray-800 mt-0.5">
                              {businessAddress}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleCopyAddress}
                          title="Salin alamat"
                          className="flex-shrink-0 p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
                        >
                          {addressCopied ? (
                            <FiCheck size={14} className="text-green-600" />
                          ) : (
                            <FiCopy size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIDEO REVIEW KENDARAAN (LANGSUNG TAMPIL DI DALAM KARTU) */}
            {car.video_url && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FiPlayCircle className="text-blue-600" /> Video Review Kendaraan
                </h3>
                {isYoutube ? (
                  <div className="space-y-3">
                    <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black shadow-inner">
                      <YouTube
                        videoId={youtubeId}
                        opts={{
                          height: '100%',
                          width: '100%',
                          playerVars: {
                            autoplay: 0,
                          },
                        }}
                        onReady={(event) => setPlayerInstance(event.target)}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnd={() => setIsVideoPlaying(false)}
                        className="absolute top-0 left-0 w-full h-full"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleOpenYouTubeWithTimestamp}
                        className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                      >
                        <FiExternalLink size={13} /> 
                        Tonton di YouTube {currentTime > 1 ? `(Lanjutkan di ${Math.floor(currentTime / 60)}:${(Math.floor(currentTime % 60)).toString().padStart(2, '0')})` : ''}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-inner">
                    <video
                      src={resolveVideoUrl(car.video_url)}
                      controls
                      className="w-full max-h-[400px] object-contain mx-auto"
                    >
                      Browser Anda tidak mendukung pemutar video ini.
                    </video>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FiFileText className="text-blue-600" /> Deskripsi
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {car.description || 'Tidak ada deskripsi tambahan untuk kendaraan ini.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FiUser className="text-blue-600" /> Pemilik / Perental
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400">Nama Pengelola</p>
                  <p className="text-sm font-semibold text-gray-800">{owner?.name || 'Administrator'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-semibold text-gray-800 break-all">{owner?.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Nomor HP</p>
                  <p className="text-sm font-semibold text-gray-800">{personalData?.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Alamat</p>
                  <p className="text-sm font-semibold text-gray-800">{personalData?.address || '-'}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  disabled={!isAvailable}
                  onClick={() => navigate(`/cars/${car.id}/book`, { state: { carData: car } })}
                  className={`w-full py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${
                    isAvailable
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <FiTruck size={18} />
                  {isAvailable ? 'Sewa Mobil Ini' : 'Mobil Sedang Tidak Tersedia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ZOOM GAMBAR */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="absolute top-4 left-6 right-6 flex justify-between items-center text-white z-10">
            <span className="text-sm font-semibold tracking-wide">{zoomImage.title}</span>
            <button
              onClick={() => setZoomImage(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
          <div 
            className="relative max-w-5xl max-h-[85vh] overflow-auto flex items-center justify-center p-2" 
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImage.url}
              alt={zoomImage.title}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl transition-transform duration-200"
            />
          </div>
          <p className="text-white/60 text-xs mt-4">Klik di luar gambar atau tombol X untuk keluar</p>
        </div>
      )}
    </AppLayout>
  );
};

export default CarDetail;