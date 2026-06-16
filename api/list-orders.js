/* ════════════════════════════════════════════════════════════════
   PANEL DE VENTAS — versión para VERCEL
   En Netlify este endpoint leía los pedidos desde el almacenamiento
   integrado (Netlify Blobs). En Vercel ese almacenamiento NO existe,
   así que el panel de ventas dentro de la página necesita una base de
   datos persistente (por ejemplo Vercel KV / Upstash).

   Mientras tanto NO pierdes nada: cada pedido te llega al CORREO
   (ver api/save-order.js + WEB3FORMS_KEY).

   Si más adelante quieres ver el panel aquí dentro, conecta Vercel KV
   en el panel de Vercel y pídele a tu asistente que reescriba esta
   función para leer de KV (es un cambio corto).

   Ruta automática:  /api/list-orders   ←  api/list-orders.js
   ════════════════════════════════════════════════════════════════ */
export default function handler(req, res) {
  return res.status(503).json({
    error:
      "El panel de ventas necesita una base de datos en Vercel. Por ahora cada pedido te llega al correo (Web3Forms). Para verlo aquí dentro, conecta Vercel KV y pide que se active esta función.",
  });
}
