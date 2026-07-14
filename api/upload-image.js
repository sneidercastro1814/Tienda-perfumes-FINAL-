/* ════════════════════════════════════════════════════════════════
   SUBIR UNA FOTO A LA NUBE  —  api/upload-image.js
   ────────────────────────────────────────────────────────────────
   Cuando el admin sube una foto desde el panel, el navegador la
   convierte a base64 (un texto larguísimo). Si ese texto se guardara
   dentro del catálogo, pasarían dos cosas malas:

     1) El catálogo pesaría megas → el celular del cliente tardaría
        muchísimo en abrir la tienda (y Vercel rechaza cuerpos > 4.5 MB).
     2) El localStorage del admin se llenaría (error "Almacenamiento lleno").

   Por eso, al publicar, cada foto en base64 se sube AQUÍ, se guarda en
   Vercel Blob y el catálogo solo se queda con la URL (un texto corto).

   POST /api/upload-image
     Cabecera: x-admin-token: <ADMIN_TOKEN>
     Cuerpo:   { "dataUrl": "data:image/jpeg;base64,..." }
     Devuelve: { "ok": true, "url": "https://....public.blob.vercel-storage.com/..." }
   ════════════════════════════════════════════════════════════════ */

import { put } from "@vercel/blob";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB por foto ya comprimida (de sobra)

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const expected = process.env.ADMIN_TOKEN || "";
  const token = req.headers["x-admin-token"] || "";

  if (!expected) {
    return res.status(500).json({
      ok: false,
      error: "Falta la variable ADMIN_TOKEN en Vercel (Settings → Environment Variables).",
    });
  }
  if (token !== expected) {
    return res.status(401).json({ ok: false, error: "Clave de publicación incorrecta." });
  }
  // Soporta tanto OIDC (BLOB_STORE_ID) como token tradicional (BLOB_READ_WRITE_TOKEN)
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Falta conectar el Blob Store en Vercel (Storage → Create Database → Blob).",
    });
  }

  try {
    const dataUrl = String((req.body || {}).dataUrl || "");
    const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ ok: false, error: "La imagen no es válida." });

    const contentType = m[1];
    const buffer = Buffer.from(m[2], "base64");
    if (!buffer.length) return res.status(400).json({ ok: false, error: "La imagen llegó vacía." });
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: "La foto pesa demasiado. Súbela más liviana." });
    }

    const ext = (contentType.split("/")[1] || "jpg").split("+")[0].replace("jpeg", "jpg");
    const name = `rda/img/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const blob = await put(name, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000, // 1 año: la URL es única, la foto nunca cambia
    });

    return res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "No se pudo subir la foto." });
  }
}
