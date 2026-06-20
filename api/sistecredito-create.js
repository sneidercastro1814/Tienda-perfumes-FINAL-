/* ════════════════════════════════════════════════════════════════
   SISTECRÉDITO · CREAR TRANSACCIÓN  (Vercel)
   Ruta automática:  POST /api/sistecredito-create

   Crea la intención de pago en la pasarela de Sistecrédito y devuelve la
   URL a la que hay que redirigir al cliente para que pague a cuotas.

   ⚠️ Las LLAVES viven SOLO aquí (servidor). Nunca en el navegador ni en GitHub.
   Configúralas en  Vercel → Project Settings → Environment Variables:

     SISTECREDITO_SUBSCRIPTION_KEY = (tu Ocp-Apim-Subscription-Key)
     SISTECREDITO_STORE_ID         = (ApplicationKey  ·  storeId)
     SISTECREDITO_VENDOR_ID        = (ApplicationToken ·  vendorId  =  tu "Vender id")
     SISTECREDITO_ENV              = Staging        (cámbialo a Production al salir a real)
     SISTECREDITO_SIMULATE         = (opcional) Approved | Rejected | Pending …
                                     ↳ úsalo para PROBAR el flujo sin una cédula real.
                                       Déjalo vacío para el flujo real.
   ════════════════════════════════════════════════════════════════ */

const BASE = "https://api.credinet.co/pay";
const SISTE_PAYMENT_METHOD_ID = 2;                 // Sistecrédito (Staging y Production)
const FAIL = ["Rejected", "Cancelled", "Expired", "Abandoned", "Failed"];

function baseHeaders() {
  return {
    "Content-Type": "application/json",
    SCLocation: "0,0",
    SCOrigen: (process.env.SISTECREDITO_ENV || "Staging").trim(),   // Staging | Production
    country: "co",
    "Ocp-Apim-Subscription-Key": process.env.SISTECREDITO_SUBSCRIPTION_KEY || "",
    ApplicationKey: process.env.SISTECREDITO_STORE_ID || "",
    ApplicationToken: process.env.SISTECREDITO_VENDOR_ID || "",
  };
}

function siteOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function getTx(transactionId) {
  const url = `${BASE}/GetTransactionResponse?transactionId=${encodeURIComponent(transactionId)}`;
  const r = await fetch(url, { method: "GET", headers: baseHeaders() });
  return r.json().catch(() => ({}));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  // Verifica que las 3 llaves estén configuradas
  if (
    !process.env.SISTECREDITO_SUBSCRIPTION_KEY ||
    !process.env.SISTECREDITO_STORE_ID ||
    !process.env.SISTECREDITO_VENDOR_ID
  ) {
    return res.status(500).json({
      ok: false,
      error: "Faltan llaves de Sistecrédito en el servidor (Vercel → Environment Variables).",
    });
  }

  try {
    const { reference, amount, cedula, docType = "CC" } = req.body || {};
    if (!amount || !cedula) {
      return res.status(400).json({ ok: false, error: "amount y cedula son obligatorios" });
    }

    const origin = siteOrigin(req);
    const simulate = (process.env.SISTECREDITO_SIMULATE || "").trim();

    const body = {
      invoice: reference || `RDA-${Date.now()}`,
      description: "Compra en Rey del Aroma",
      paymentMethod: { paymentMethodId: SISTE_PAYMENT_METHOD_ID },
      currency: "COP",
      value: Math.round(Number(amount) || 0), // COP sin decimales
      sandbox: simulate ? { isActive: true, status: simulate } : { isActive: false, status: "Approved" },
      urlResponse: `${origin}/?sistecredito=1`,
      urlConfirmation: `${origin}/api/sistecredito-webhook`,
      methodConfirmation: "POST",
      client: { docType, document: String(cedula).trim() },
    };

    const r = await fetch(`${BASE}/create`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));

    // Error de la pasarela: HTTP 400, o HTTP 200 con errorCode != 0
    if (!r.ok || (j && j.errorCode && j.errorCode !== 0)) {
      return res.status(400).json({
        ok: false,
        error: j?.message || `Sistecrédito devolvió un error (HTTP ${r.status}).`,
        errorCode: j?.errorCode || null,
      });
    }

    const data = j?.data || {};
    const transactionId = data._id;
    let status = data.transactionStatus || data?.paymentMethodResponse?.statusResponse || "";
    let redirectUrl = data?.paymentMethodResponse?.paymentRedirectUrl || "";

    // La URL puede no venir de inmediato: unos intentos cortos de polling.
    // (Si no aparece aquí, el frontend sigue consultando /api/sistecredito-status.)
    for (let i = 0; i < 3 && !redirectUrl && transactionId; i++) {
      await new Promise((ok) => setTimeout(ok, 1200));
      const jt = await getTx(transactionId);
      const d = jt?.data || {};
      status = d.transactionStatus || d?.paymentMethodResponse?.statusResponse || status;
      redirectUrl = d?.paymentMethodResponse?.paymentRedirectUrl || "";
      if (FAIL.includes(status)) break;
    }

    if (FAIL.includes(status)) {
      return res.status(400).json({ ok: false, error: `La transacción no se pudo iniciar (${status}).`, status });
    }

    return res.status(200).json({ ok: true, transactionId, status, redirectUrl });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
