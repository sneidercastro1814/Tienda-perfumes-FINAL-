/* ════════════════════════════════════════════════════════════════
   PEDIDOS — ALMACENAMIENTO EN VERCEL BLOB
   ────────────────────────────────────────────────────────────────
   Este archivo NO es una ruta de la API (está fuera de /api). Es la
   "bodega" que usan las funciones de /api para guardar y leer ventas.

   Usa el MISMO Blob Store que ya usa el catálogo (api/catalog.js), así
   que si el catálogo en la nube ya te funciona, las ventas también.

   CÓMO SE GUARDA CADA VENTA (dos copias, a propósito):

   1) rda/pedidos/<referencia>.json   ← una copia por pedido.
      Nunca se sobrescribe. Es el respaldo: aunque el resumen se dañe,
      ningún pedido se pierde.

   2) rda/pedidos-indice-<fecha>.json ← el resumen con TODOS los pedidos.
      Es lo que lee el panel (un solo archivo = rápido y barato).
      Cada vez que se guarda se crea un archivo NUEVO (igual que el
      catálogo) porque el CDN de Vercel cachea 60 s los archivos con el
      mismo nombre; con nombre nuevo el panel ve la venta al instante.
      Se conservan los 3 últimos y se borran los viejos.

   Si alguna vez el resumen queda incompleto, el panel tiene el botón
   "Reconstruir" que lo vuelve a armar leyendo las copias individuales.
   ════════════════════════════════════════════════════════════════ */

import { put, list, del } from "@vercel/blob";

const DIR = "rda/pedidos/";                 // copia individual de cada pedido
const INDEX_PREFIX = "rda/pedidos-indice-"; // resumen que lee el panel
const KEEP_INDEX = 3;                       // versiones del resumen que guardamos
const MAX_ORDERS = 5000;                    // tope de pedidos en el resumen

/* ¿Está conectado el Blob Store de Vercel? (OIDC o token clásico) */
export function hayBlob() {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

/* Ni el navegador ni el CDN deben cachear las respuestas del panel:
   si no, el admin vería ventas viejas. */
export function sinCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

/* Comprueba la clave de administrador (misma ADMIN_TOKEN del catálogo).
   Devuelve null si todo bien, o un objeto { status, error } si falla. */
export function revisarToken(req) {
  const esperado = (process.env.ADMIN_TOKEN || "").trim();
  if (!esperado) {
    return {
      status: 500,
      error: "Falta la variable ADMIN_TOKEN en Vercel (Settings → Environment Variables) y hacer Redeploy.",
    };
  }
  const q = req.query || {};
  const recibido = String(req.headers["x-admin-token"] || q.token || "").trim();
  if (recibido !== esperado) {
    return { status: 401, error: "Clave incorrecta. Es la misma que pusiste en ADMIN_TOKEN dentro de Vercel." };
  }
  return null;
}

/* Nombre de archivo seguro a partir de la referencia del pedido. */
function refSegura(ref) {
  return String(ref || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80) || `RDA-${Date.now()}`;
}

/* ── RESUMEN (índice) ───────────────────────────────────────────── */

async function versionesIndice() {
  const { blobs } = await list({ prefix: INDEX_PREFIX });
  return (blobs || []).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

/* Lee el resumen más reciente. Devuelve [] si todavía no hay ninguno. */
export async function leerPedidos() {
  const versiones = await versionesIndice();
  if (!versiones.length) return [];
  const r = await fetch(versiones[0].url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo leer el resumen de ventas.");
  const data = await r.json();
  const arr = Array.isArray(data) ? data : data && Array.isArray(data.orders) ? data.orders : [];
  return arr;
}

/* Guarda el resumen completo (crea una versión nueva y borra las viejas). */
async function escribirPedidos(pedidos) {
  const nombre = `${INDEX_PREFIX}${Date.now()}.json`;
  await put(nombre, JSON.stringify({ orders: pedidos, updatedAt: new Date().toISOString() }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true, // ← la dirección queda impredecible (los datos del cliente son privados)
  });
  try {
    const viejas = (await versionesIndice()).slice(KEEP_INDEX).map((b) => b.url);
    if (viejas.length) await del(viejas);
  } catch { /* si la limpieza falla no importa: el resumen nuevo ya quedó */ }
}

/* ── GUARDAR UN PEDIDO ──────────────────────────────────────────── */

export async function guardarPedido(pedido) {
  // 1) Copia individual: nombre único, así dos compras a la vez nunca chocan.
  try {
    await put(`${DIR}${refSegura(pedido.reference)}.json`, JSON.stringify(pedido), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: true,
    });
  } catch (e) {
    console.error("No se pudo guardar la copia individual del pedido:", e);
  }

  // 2) Resumen. Si dos clientes compran en el mismo segundo, el segundo
  //    reintenta hasta comprobar que su pedido quedó guardado.
  for (let intento = 0; intento < 3; intento++) {
    const actuales = await leerPedidos().catch(() => []);
    if (actuales.some((o) => String(o.reference) === String(pedido.reference))) return true;
    await escribirPedidos([pedido, ...actuales].slice(0, MAX_ORDERS));
    const comprobar = await leerPedidos().catch(() => []);
    if (comprobar.some((o) => String(o.reference) === String(pedido.reference))) return true;
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
  }
  return false;
}

/* ── ACTUALIZAR EL ESTADO DE UN PEDIDO (pagado / rechazado) ─────── */

export async function actualizarEstado(referencia, cambios) {
  const ref = String(referencia || "").trim();
  if (!ref) return false;

  for (let intento = 0; intento < 3; intento++) {
    const pedidos = await leerPedidos().catch(() => []);
    const i = pedidos.findIndex((o) => String(o.reference) === ref);
    if (i < 0) return false;

    // Un pedido ya pagado no vuelve a "pendiente" por un aviso tardío.
    if (pedidos[i].estado === "pagado" && cambios.estado !== "pagado") return true;
    if (pedidos[i].estado === cambios.estado) return true;

    const copia = [...pedidos];
    copia[i] = { ...copia[i], ...cambios, actualizado: new Date().toISOString() };
    await escribirPedidos(copia);

    const comprobar = await leerPedidos().catch(() => []);
    const ok = comprobar.find((o) => String(o.reference) === ref);
    if (ok && ok.estado === cambios.estado) return true;
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
  }
  return false;
}

/* ── RECONSTRUIR EL RESUMEN DESDE LAS COPIAS INDIVIDUALES ───────── */

export async function reconstruirPedidos() {
  const actuales = await leerPedidos().catch(() => []);
  const porRef = new Map(actuales.map((o) => [String(o.reference), o]));

  const { blobs } = await list({ prefix: DIR });
  const urls = (blobs || []).map((b) => b.url);

  // De 20 en 20 para no saturar la función.
  for (let i = 0; i < urls.length; i += 20) {
    const lote = await Promise.all(
      urls.slice(i, i + 20).map((u) =>
        fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      )
    );
    for (const pedido of lote) {
      if (!pedido || !pedido.reference) continue;
      const previo = porRef.get(String(pedido.reference));
      // Lo guardado en el resumen manda (ahí vive el estado pagado/rechazado).
      porRef.set(String(pedido.reference), previo ? { ...pedido, ...previo } : pedido);
    }
  }

  const todos = [...porRef.values()]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, MAX_ORDERS);
  await escribirPedidos(todos);
  return todos;
}
