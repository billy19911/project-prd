import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.102"],
  // Sembunyikan indikator dev Next (tombol mengambang Turbopack/Route/Preferences).
  devIndicators: false,
};

export default nextConfig;
