/* ════════════════════════════════════════════════════════════════
   SISTECRÉDITO · ESTADO DE TRANSACCIÓN  (Vercel)
   Ruta automática:  GET /api/sistecredito-status?transactionId=<_id>

   Consulta el estado real de una transacción en la pasarela. Lo usa el
   frontend para: (1) esperar la URL de pago, y (2) mostrar el resultado
   cuando el cliente vuelve de Sistecrédito.

   Usa las mismas variables de entorno que /api/sistecredito-create.
   ════════════════════════════════════════════════════════════════ */

const BASE = "https://api.credinet.co/pay";
const FAIL = ["Rejected", "Cancelled", "Expired", "Abandoned", "Failed"];

function baseHeaders() {
  return {
    "Content-Type": "application/json",
    SCLocation: "0,0",
    SCOrigen: (process.env.SISTECREDITO_ENV || "Staging").trim(),
    country: "co",
    "Ocp-Apim-Subscription-Key": process.env.SISTECREDITO_SUBSCRIPTION_KEY || "",
    ApplicationKey: process.env.SISTECREDITO_STORE_ID || "",
    ApplicationToken: process.env.SISTECREDITO_VENDOR_ID || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  const transactionId = req.query.transactionId;
  if (!transactionId) return res.status(400).json({ ok: false, error: "transactionId es obligatorio" });

  try {
    const url = `${BASE}/GetTransactionResponse?transactionId=${encodeURIComponent(transactionId)}`;
    const r = await fetch(url, { method: "GET", headers: baseHeaders() });
    const j = await r.json().catch(() => ({}));
    const d = j?.data || {};

    const status = d.transactionStatus || d?.paymentMethodResponse?.statusResponse || "";
    const redirectUrl = d?.paymentMethodResponse?.paymentRedirectUrl || "";

    return res.status(200).json({
      ok: true,
      status,
      redirectUrl,
      reference: d.invoice || "",
      approved: status === "Approved",
      failed: FAIL.includes(status),
      message: j?.message || "",
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
