/* ════════════════════════════════════════════════════════════════
   PANEL DE VENTAS  —  GET /api/list-orders
   ────────────────────────────────────────────────────────────────
   Devuelve todas las ventas para pintarlas en el panel del admin.

   Requiere la clave de administrador:
     /api/list-orders?token=TU_ADMIN_TOKEN
   (o la cabecera  x-admin-token)

   Extra:
     /api/list-orders?token=…&reconstruir=1
     → vuelve a armar el resumen leyendo la copia individual de cada
       pedido. Es el botón "Reconstruir" del panel.

   CONFIGURACIÓN EN VERCEL (una sola vez):
     1) Storage → Create Database → Blob → Create   (el mismo que usa
        el catálogo; si el catálogo ya funciona, esto ya está listo)
     2) Settings → Environment Variables → ADMIN_TOKEN = tu clave
     3) Deployments → ··· → Redeploy
   ════════════════════════════════════════════════════════════════ */

import { hayBlob, sinCache, revisarToken, leerPedidos, reconstruirPedidos } from "../lib/pedidos.js";

export default async function handler(req, res) {
  sinCache(res);

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const fallo = revisarToken(req);
  if (fallo) return res.status(fallo.status).json({ ok: false, error: fallo.error });

  if (!hayBlob()) {
    return res.status(503).json({
      ok: false,
      error:
        "Falta conectar el almacenamiento en Vercel: Storage → Create Database → Blob → Create, y luego Redeploy. Es el mismo que usa el catálogo.",
    });
  }

  try {
    const reconstruir = String((req.query || {}).reconstruir || "") === "1";
    const orders = reconstruir ? await reconstruirPedidos() : await leerPedidos();

    // Del más nuevo al más viejo (el panel también ordena, pero así llega listo).
    orders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return res.status(200).json({
      ok: true,
      orders,
      count: orders.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("list-orders:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "No se pudieron leer las ventas.",
    });
  }
}
