// คัดลอก worker ของ pdf.js ไปไว้ใน public เพื่อใช้แสดงตัวอย่างไฟล์ PDF/AI ใน browser
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
