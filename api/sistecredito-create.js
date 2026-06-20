/* ════════════════════════════════════════════════════════════════
   SISTECRÉDITO · CREAR TRANSACCIÓN  (Vercel)
   Ruta automática:  POST /api/sistecredito-create

   Crea la intención de pago en la pasarela de Sistecrédito y DEVUELVE DE
   INMEDIATO el id de la transacción (+ la URL de pago si ya viene lista).
   La espera de la URL la hace el navegador llamando a /api/sistecredito-status,
   así esta función nunca se cuelga ni agota el tiempo del servidor.

   ⚠️ Las LLAVES viven SOLO aquí (servidor). Nunca en el navegador ni en GitHub.
   Variables en  Vercel → Project Settings → Environment Variables:

     SISTECREDITO_SUBSCRIPTION_KEY = (tu Ocp-Apim-Subscription-Key)
     SISTECREDITO_STORE_ID         = (ApplicationKey  ·  storeId)
     SISTECREDITO_VENDOR_ID        = (ApplicationToken ·  vendorId  =  tu "Vender id")
     SISTECREDITO_ENV              = Staging        (cámbialo a Production al salir a real)
     SISTECREDITO_SIMULATE         = (opcional) Approved | Rejected | Pending …
   ════════════════════════════════════════════════════════════════ */

const BASE = "https://api.credinet.co/pay";
const SISTE_PAYMENT_METHOD_ID = 2;                 // Sistecrédito (Staging y Production)
const FAIL = ["Rejected", "Cancelled", "Expired", "Abandoned", "Failed"];

export const config = { maxDuration: 30 };         // margen por si la pasarela tarda

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

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

    // Una sola llamada a la pasarela. Si la red falla, devolvemos un error claro.
    let r, j;
    try {
      r = await fetch(`${BASE}/create`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(body),
      });
      j = await r.json().catch(() => ({}));
    } catch (netErr) {
      return res.status(502).json({ ok: false, error: `No se pudo conectar con Sistecrédito: ${netErr.message}` });
    }

    // Queda registrado en Vercel → Runtime Logs para diagnóstico
    console.log("Sistecrédito /create →", r.status, JSON.stringify(j).slice(0, 800));

    // Error de la pasarela (HTTP != 200, o HTTP 200 con errorCode != 0)
    if (!r.ok || (j && j.errorCode && j.errorCode !== 0)) {
      return res.status(400).json({
        ok: false,
        error: j?.message || `Sistecrédito devolvió un error (HTTP ${r.status}).`,
        errorCode: j?.errorCode || null,
        httpStatus: r.status,
      });
    }

    const data = j?.data || {};
    const transactionId = data._id || "";
    const status = data.transactionStatus || data?.paymentMethodResponse?.statusResponse || "";
    const redirectUrl = data?.paymentMethodResponse?.paymentRedirectUrl || "";

    if (FAIL.includes(status)) {
      return res.status(400).json({ ok: false, error: `La transacción no se pudo iniciar (${status}).`, status });
    }
    if (!transactionId) {
      return res.status(502).json({ ok: false, error: "Sistecrédito no devolvió un identificador de transacción." });
    }

    // Devolvemos ya. El navegador consulta /api/sistecredito-status hasta tener la URL.
    return res.status(200).json({ ok: true, transactionId, status, redirectUrl });
  } catch (err) {
    console.error("sistecredito-create error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
