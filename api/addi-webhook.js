/* ════════════════════════════════════════════════════════════════
   ADDI · WEBHOOK DE ESTADO   ·   Vercel
   Ruta automática:  POST /api/addi-webhook   ←  api/addi-webhook.js

   Addi llama esta URL (callbackUrl) para avisar el estado del crédito de una
   orden (aprobado / rechazado / etc.). Aquí solo lo registramos en los logs
   y respondemos 200 para que Addi no reintente. El pedido ya se guardó y se
   te notificó por correo al momento de la compra, así que este webhook es
   informativo; puedes ampliarlo luego si quieres actualizar estados.

   Responde siempre 200 para peticiones válidas.
   ════════════════════════════════════════════════════════════════ */
import { hayBlob, actualizarEstado } from "../lib/pedidos.js";

/* Palabras con las que Addi indica que el crédito quedó aprobado o negado. */
const APROBADO = ["APPROVED", "APPROVED_APPLICATION", "COMPLETED", "DISBURSED", "ACCEPTED"];
const RECHAZADO = ["REJECTED", "DECLINED", "CANCELLED", "CANCELED", "EXPIRED", "ABANDONED"];

export default async function handler(req, res) {
  // Addi puede hacer un GET de verificación; respondemos OK.
  if (req.method === "GET") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    const body = req.body || {};
    // Deja el evento en Vercel → Runtime Logs para diagnóstico.
    console.log("Addi webhook →", JSON.stringify(body).slice(0, 1500));

    /* Addi manda la referencia del pedido y el estado del crédito con
       nombres que varían según la versión de su API; miramos los sitios
       habituales sin romper nada si vienen distintos. */
    const d = body.data || body;
    const referencia = d.orderId || d.orderID || d.reference || d.externalId || body.orderId || "";
    const estadoAddi = String(d.status || d.applicationStatus || body.status || "").toUpperCase();

    if (hayBlob() && referencia && estadoAddi) {
      const estado =
        APROBADO.includes(estadoAddi) ? "pagado"
        : RECHAZADO.includes(estadoAddi) ? "rechazado"
        : "revision";
      try {
        await actualizarEstado(referencia, { estado, pasarelaEstado: estadoAddi });
      } catch (e) {
        console.error("addi-webhook (panel de ventas):", e);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("addi-webhook error:", err);
    // Aun con error, devolvemos 200 para evitar reintentos innecesarios de Addi.
    return res.status(200).json({ ok: true });
  }
}
