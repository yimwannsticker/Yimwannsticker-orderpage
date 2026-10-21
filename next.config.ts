import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ไลบรารีอ่านไฟล์ฝั่ง server ไม่ต้อง bundle
  serverExternalPackages: ["pdf-lib", "ag-psd", "nodemailer"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
