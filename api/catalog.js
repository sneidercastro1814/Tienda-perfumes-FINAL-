/* ════════════════════════════════════════════════════════════════
   CATÁLOGO EN LA NUBE  —  api/catalog.js
   ────────────────────────────────────────────────────────────────
   ESTE ARCHIVO ES LA SOLUCIÓN AL PROBLEMA DE
   "CAMBIO EL PRECIO EN EL PC Y EN EL CELULAR NO SE VE".

   Antes, el catálogo (productos, precios, cupones) vivía SOLO en el
   localStorage del navegador del admin. Por eso el celular del cliente
   —que tiene su propio localStorage vacío— seguía viendo los precios
   viejos del archivo src/data/products.js.

   Ahora el catálogo vive en la NUBE (Vercel Blob) y TODOS los
   dispositivos lo leen del mismo lugar.

     GET  /api/catalog   → PÚBLICO. Lo llama la tienda al abrir, en
                           cualquier celular o PC. Devuelve el catálogo
                           real: productos, precios, cupones, etc.

     POST /api/catalog   → SOLO EL ADMIN. Requiere la cabecera
                           x-admin-token con tu ADMIN_TOKEN.
                           Publica el catálogo para todo el mundo.

   ────────────────────────────────────────────────────────────────
   CONFIGURACIÓN EN VERCEL (una sola vez, 3 minutos):

   1) Blob Store:
      Vercel → tu proyecto → pestaña "Storage" → Create Database →
      elige "Blob" → Create. Vercel automáticamente lo conecta vía OIDC
      (más seguro) y agrega BLOB_STORE_ID, BLOB_READ_WRITE_TOKEN,
      BLOB_WEBHOOK_PUBLIC_KEY.

   2) Clave de publicación:
      Vercel → Settings → Environment Variables → Add
        Key:   ADMIN_TOKEN
        Value: (inventa una clave, ej. ReyAroma-2026-x9k7)
      Esa MISMA clave la escribes una vez dentro del panel admin,
      en la tarjeta "Catálogo en la nube".

   3) Redeploy (Deployments → ··· → Redeploy) para que tome las
      variables nuevas.
   ════════════════════════════════════════════════════════════════ */

import { put, list, del } from "@vercel/blob";

// Cada publicación crea un archivo NUEVO con la fecha en el nombre.
// ¿Por qué? Porque el CDN de Vercel Blob cachea mínimo 60 segundos.
// Si siempre sobrescribiéramos el mismo archivo, el celular podría
// seguir viendo la versión vieja hasta un minuto. Con un nombre nuevo
// la URL cambia y el contenido es SIEMPRE fresco. Guardamos las 3
// últimas versiones (respaldo) y borramos el resto.
const PREFIX = "rda/catalog-";
const KEEP = 3;

/* Ninguna capa (navegador, CDN de Vercel) debe cachear esta respuesta:
   si no, el celular seguiría viendo precios viejos. */
function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

/* Todas las versiones del catálogo, de la más NUEVA a la más vieja. */
async function versions() {
  const { blobs } = await list({ prefix: PREFIX });
  return (blobs || []).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export default async function handler(req, res) {
  noCache(res);

  // Soporta tanto OIDC (BLOB_STORE_ID) como token tradicional (BLOB_READ_WRITE_TOKEN)
  const hasBlob = !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

  /* ── LEER EL CATÁLOGO (público: lo llaman todos los clientes) ── */
  if (req.method === "GET") {
    // Sin Blob configurado no rompemos la tienda: la web usa su catálogo local.
    if (!hasBlob) {
      return res.status(200).json({
        ok: false,
        catalog: null,
        reason: "NO_BLOB",
        error: "Falta conectar el Blob Store en Vercel (Storage → Create Database → Blob).",
      });
    }
    try {
      const all = await versions();
      if (!all.length) {
        // El Blob existe pero el admin todavía no ha publicado nada.
        return res.status(200).json({ ok: true, catalog: null, reason: "EMPTY" });
      }
      const r = await fetch(all[0].url, { cache: "no-store" });
      if (!r.ok) throw new Error("No se pudo leer el catálogo publicado.");
      const catalog = await r.json();
      return res.status(200).json({ ok: true, catalog });
    } catch (err) {
      return res.status(200).json({ ok: false, catalog: null, reason: "ERROR", error: err.message });
    }
  }

  /* ── PUBLICAR EL CATÁLOGO (solo el admin) ── */
  if (req.method === "POST") {
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
    if (!hasBlob) {
      return res.status(500).json({
        ok: false,
        error: "Falta conectar el Blob Store en Vercel (Storage → Create Database → Blob).",
      });
    }

    try {
      const body = req.body || {};
      const products = Array.isArray(body.products) ? body.products : [];

      // Red de seguridad: nunca publicamos un catálogo vacío. Si algo falla
      // en el navegador, no queremos dejar la tienda sin productos.
      if (!products.length) {
        return res.status(400).json({
          ok: false,
          error: "El catálogo llegó vacío. No se publicó nada (protección para no borrar la tienda).",
        });
      }

      const catalog = {
        products,
        coupons: Array.isArray(body.coupons) ? body.coupons : [],
        collections: Array.isArray(body.collections) ? body.collections : [],
        aromas: Array.isArray(body.aromas) ? body.aromas : [],
        updatedAt: new Date().toISOString(),
      };

      const name = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`;
      const blob = await put(name, JSON.stringify(catalog), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      // Limpieza: dejamos solo las últimas KEEP versiones.
      try {
        const stale = (await versions()).slice(KEEP).map((b) => b.url);
        if (stale.length) await del(stale);
      } catch { /* si la limpieza falla, no importa: lo importante ya quedó publicado */ }

      return res.status(200).json({
        ok: true,
        updatedAt: catalog.updatedAt,
        count: products.length,
        url: blob.url,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || "No se pudo publicar el catálogo." });
    }
  }

  return res.status(405).json({ ok: false, error: "Method Not Allowed" });
}
