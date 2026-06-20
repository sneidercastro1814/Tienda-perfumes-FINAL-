/* ════════════════════════════════════════════════════════════════
   SISTECRÉDITO · WEBHOOK DE CONFIRMACIÓN  (Vercel)
   Ruta automática:  POST /api/sistecredito-webhook   (también acepta GET)

   Sistecrédito llama aquí cada vez que cambia el estado de una transacción
   (es el valor que enviamos en "urlConfirmation"). Para evitar fraude NO
   confiamos solo en la notificación: volvemos a consultar el estado real en
   la pasarela. Si la compra quedó APROBADA, te avisamos por correo.

   Siempre respondemos 200 para que Sistecrédito no reintente en bucle.
   Usa las mismas variables de entorno que /api/sistecredito-create
   (y WEB3FORMS_KEY si quieres el aviso por correo).
   ════════════════════════════════════════════════════════════════ */

const BASE = "https://api.credinet.co/pay";
const ADMIN_EMAIL = "reydelaromacolombia@gmail.com";
const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

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
  try {
    // El identificador llega por body (POST) o por querystring (GET)
    const payload = req.method === "POST" ? req.body || {} : req.query || {};
    const notif = payload.data || payload;
    const id = notif._id || payload._id || payload.paymentRef || (req.query && req.query.paymentRef) || "";

    if (id) {
      // Verifica el estado REAL en la pasarela (anti-fraude)
      const url = `${BASE}/GetTransactionResponse?transactionId=${encodeURIComponent(id)}`;
      const r = await fetch(url, { method: "GET", headers: baseHeaders() });
      const j = await r.json().catch(() => ({}));
      const d = j?.data || {};
      const status = d.transactionStatus || "";
      console.log("Sistecrédito webhook:", id, status);

      // Si quedó aprobada, avisa por correo (Web3Forms)
      const w3key = process.env.WEB3FORMS_KEY || "";
      if (status === "Approved" && w3key) {
        const ref = d.invoice || id;
        const message =
          "PAGO SISTECRÉDITO APROBADO\n\n" +
          `Pedido / factura: ${ref}\n` +
          `Transacción:      ${id}\n` +
          `Valor:            ${cop(d.value)}\n` +
          `Estado:           ${status}\n` +
          `Fecha:            ${new Date().toLocaleString("es-CO")}`;
        try {
          await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              access_key: w3key,
              subject: `✅ Sistecrédito APROBADO — ${ref} (${cop(d.value)})`,
              from_name: "Rey del Aroma — Sistecrédito",
              to: ADMIN_EMAIL,
              message,
            }),
          });
        } catch (e) {
          console.error("Web3Forms:", e);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ received: true });
  }
}
