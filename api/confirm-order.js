/* ════════════════════════════════════════════════════════════════
   CONFIRMAR EL PAGO DE UN PEDIDO  —  POST /api/confirm-order
   ────────────────────────────────────────────────────────────────
   Cuando el cliente vuelve de la pasarela, la tienda llama aquí para
   que el pedido pase de "pendiente" a "pagado" en el panel.

   IMPORTANTE — por qué esto es seguro:
   NO le creemos a lo que manda el navegador. Con la referencia que
   llega, esta función vuelve a preguntarle A LA PASARELA cuál fue el
   estado real de la transacción. Solo si la pasarela dice "aprobada"
   se marca como pagada. Así nadie puede marcar ventas falsas.

   Body:  { reference, method, txId }

   Este endpoint es el "plan A" (funciona siempre que el cliente
   regrese a la tienda). El "plan B" son los webhooks de cada pasarela
   (api/wompi-webhook.js, api/sistecredito-webhook.js), que funcionan
   aunque el cliente cierre el navegador.
   ════════════════════════════════════════════════════════════════ */

import { hayBlob, sinCache, actualizarEstado } from "../lib/pedidos.js";

const SISTE_BASE = "https://api.credinet.co/pay";

/* ── WOMPI ── API pública de solo lectura: no hace falta ninguna clave.
   Probamos producción y, si no aparece, el sandbox de pruebas. */
async function estadoWompi(txId) {
  for (const base of ["https://production.wompi.co/v1", "https://sandbox.wompi.co/v1"]) {
    try {
      const r = await fetch(`${base}/transactions/${encodeURIComponent(txId)}`, { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      const t = (j && j.data) || {};
      if (!t.status) continue;
      return { status: t.status, reference: t.reference || "", amount: (t.amount_in_cents || 0) / 100 };
    } catch { /* probamos la siguiente */ }
  }
  return null;
}

/* ── SISTECRÉDITO ── consulta con las credenciales del comercio. */
async function estadoSistecredito(txId) {
  try {
    const r = await fetch(`${SISTE_BASE}/GetTransactionResponse?transactionId=${encodeURIComponent(txId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        SCLocation: "0,0",
        SCOrigen: (process.env.SISTECREDITO_ENV || "Staging").trim(),
        country: "co",
        "Ocp-Apim-Subscription-Key": process.env.SISTECREDITO_SUBSCRIPTION_KEY || "",
        ApplicationKey: process.env.SISTECREDITO_STORE_ID || "",
        ApplicationToken: process.env.SISTECREDITO_VENDOR_ID || "",
      },
    });
    const j = await r.json().catch(() => ({}));
    const d = (j && j.data) || {};
    if (!d.transactionStatus) return null;
    return { status: d.transactionStatus, reference: d.invoice || "", amount: Number(d.value) || 0 };
  } catch {
    return null;
  }
}

const PENDIENTES_SISTE = ["Pending", "PendingForPaymentMethod", "Started"];

export default async function handler(req, res) {
  sinCache(res);
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  if (!hayBlob()) return res.status(200).json({ ok: false, error: "Sin almacenamiento configurado." });

  try {
    const { reference = "", method = "", txId = "" } = req.body || {};
    if (!reference) return res.status(400).json({ ok: false, error: "Falta la referencia del pedido." });

    let estado = null;
    let extra = {};

    if (method === "wompi" && txId) {
      const t = await estadoWompi(txId);
      if (!t) return res.status(200).json({ ok: false, error: "Wompi no respondió; el webhook lo confirmará." });
      // La referencia que devuelve Wompi debe ser la misma del pedido.
      if (t.reference && String(t.reference) !== String(reference)) {
        return res.status(409).json({ ok: false, error: "La transacción no corresponde a este pedido." });
      }
      if (t.status === "APPROVED") estado = "pagado";
      else if (t.status === "DECLINED" || t.status === "VOIDED" || t.status === "ERROR") estado = "rechazado";
      else estado = "pendiente";
      extra = { txId, pagadoValor: t.amount, pasarelaEstado: t.status };
    } else if (method === "sistecredito" && txId) {
      const t = await estadoSistecredito(txId);
      if (!t) return res.status(200).json({ ok: false, error: "Sistecrédito no respondió; el webhook lo confirmará." });
      if (t.status === "Approved") estado = "pagado";
      else if (PENDIENTES_SISTE.includes(t.status)) estado = "pendiente";
      else estado = "rechazado";
      extra = { txId, pagadoValor: t.amount, pasarelaEstado: t.status };
    } else if (method === "addi") {
      // Addi aprueba el crédito por su cuenta, después de que el cliente
      // termina. No podemos confirmarlo aquí: queda "en revisión".
      estado = "revision";
      extra = { pasarelaEstado: "EN_REVISION_ADDI" };
    } else {
      return res.status(400).json({ ok: false, error: "Datos insuficientes para confirmar el pago." });
    }

    const actualizado = await actualizarEstado(reference, { estado, ...extra });
    return res.status(200).json({ ok: true, estado, actualizado });
  } catch (err) {
    console.error("confirm-order:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
