/* ════════════════════════════════════════════════════════════════
   SISTECRÉDITO · CREAR TRANSACCIÓN  (Vercel)
   Ruta automática:  POST /api/sistecredito-create

   Crea la intención de pago en la pasarela de Sistecrédito y DEVUELVE LA
   URL DE PAGO para que el navegador redirija al cliente a la pasarela
   (donde valida su cupo). Esta versión es a prueba de fallos:

     • Busca la URL de pago en CUALQUIER campo donde Sistecrédito la ponga
       (no depende de un nombre fijo), descartando nuestras propias URLs.
     • Si la URL no viene de inmediato en /create, espera unos segundos
       consultando la pasarela hasta que esté lista (sin colgar la función).
     • Si algo falla, devuelve un mensaje claro y deja todo en los logs.

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

/* fetch con tiempo límite, para que la función nunca se quede colgada */
async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ── BÚSQUEDA ROBUSTA DE LA URL DE PAGO ──────────────────────────
   Sistecrédito puede devolver el enlace de pago en distintos campos.
   En vez de mirar una sola ruta fija, recorremos TODA la respuesta y
   elegimos la mejor candidata, ignorando nuestras propias URLs. */
function looksLikeUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

function isOwnUrl(url) {
  const u = url.toLowerCase();
  // descartamos las URLs que NOSOTROS enviamos (retorno y webhook)
  if (u.includes("sistecredito=1")) return true;
  if (u.includes("/api/sistecredito-webhook")) return true;
  return false;
}

function hostOf(url) {
  try { return new URL(url).host.toLowerCase(); } catch { return ""; }
}

/* Puntúa una URL candidata: mientras más “de pasarela” parezca, más alto. */
function scoreCandidate(keyPath, url) {
  const k = String(keyPath).toLowerCase();
  const host = hostOf(url);
  const path = url.toLowerCase();
  let score = 0;
  if (k.includes("redirect")) score += 6;
  if (k.includes("checkout")) score += 4;
  if (k.includes("payment") || /\bpay\b/.test(k)) score += 4;
  if (k.includes("link")) score += 3;
  if (k.includes("url")) score += 2;
  if (host.includes("credinet") || host.includes("sistecredito")) score += 3;
  if (path.includes("checkout") || path.includes("transaction") || path.includes("/pay")) score += 1;
  // Aceptamos solo si hay alguna señal real de que es la URL de pasarela.
  const hasSignal = score > 0 || host.includes("credinet") || host.includes("sistecredito");
  return hasSignal ? score : -1;
}

function findRedirectUrl(root) {
  if (!root || typeof root !== "object") return "";
  let best = "";
  let bestScore = -1;
  const visit = (node, keyPath) => {
    if (node == null) return;
    if (typeof node === "string") {
      const v = node.trim();
      if (looksLikeUrl(v) && !isOwnUrl(v)) {
        const s = scoreCandidate(keyPath, v);
        if (s > bestScore) { bestScore = s; best = v; }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${keyPath}[${i}]`));
      return;
    }
    if (typeof node === "object") {
      for (const k of Object.keys(node)) visit(node[k], keyPath ? `${keyPath}.${k}` : k);
    }
  };
  visit(root, "");
  return bestScore >= 0 ? best : "";
}

/* Saca id, estado y URL de pago de la respuesta de la pasarela (sea cual sea su forma). */
function extractFrom(j) {
  const data = (j && j.data) || j || {};
  const transactionId = data._id || data.transactionId || data.id || "";
  const status =
    data.transactionStatus ||
    (data.paymentMethodResponse && data.paymentMethodResponse.statusResponse) ||
    data.status ||
    "";
  // primero rutas conocidas, luego búsqueda profunda en data y en la raíz
  const explicit =
    (data.paymentMethodResponse && data.paymentMethodResponse.paymentRedirectUrl) ||
    (data.paymentMethodResponse && data.paymentMethodResponse.redirectUrl) ||
    data.paymentRedirectUrl ||
    data.redirectUrl ||
    data.url ||
    "";
  let redirectUrl = looksLikeUrl(explicit) && !isOwnUrl(explicit) ? explicit.trim() : "";
  if (!redirectUrl) redirectUrl = findRedirectUrl(data) || findRedirectUrl(j);
  return { transactionId, status, redirectUrl };
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

  const startedAt = Date.now();

  try {
    const { reference, amount, cedula, docType = "CC" } = req.body || {};
    if (!amount || !cedula) {
      return res.status(400).json({ ok: false, error: "amount y cedula son obligatorios" });
    }

    const origin = siteOrigin(req);
    const simulate = (process.env.SISTECREDITO_SIMULATE || "").trim();
    const invoice = reference || `RDA-${Date.now()}`;

    const body = {
      invoice,
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

    // 1) Crear la transacción
    let r, j;
    try {
      r = await fetchWithTimeout(`${BASE}/create`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(body),
      }, 9000);
      j = await r.json().catch(() => ({}));
    } catch (netErr) {
      return res.status(502).json({ ok: false, error: `No se pudo conectar con Sistecrédito: ${netErr.message}` });
    }

    // Queda en Vercel → Runtime Logs para diagnóstico (respuesta completa, recortada)
    console.log("Sistecrédito /create →", r.status, JSON.stringify(j).slice(0, 1500));

    // Error de la pasarela (HTTP != 200, o HTTP 200 con errorCode != 0)
    if (!r.ok || (j && j.errorCode && j.errorCode !== 0)) {
      return res.status(400).json({
        ok: false,
        error: (j && j.message) || `Sistecrédito devolvió un error (HTTP ${r.status}).`,
        errorCode: (j && j.errorCode) || null,
        httpStatus: r.status,
      });
    }

    let { transactionId, status, redirectUrl } = extractFrom(j);

    if (FAIL.includes(status)) {
      return res.status(400).json({ ok: false, error: `La transacción no se pudo iniciar (${status}).`, status });
    }
    if (!transactionId && !redirectUrl) {
      return res.status(502).json({
        ok: false,
        error: "Sistecrédito no devolvió un identificador de transacción.",
        detail: (j && j.message) || "",
      });
    }

    // 2) Si la URL aún no llegó, esperamos unos segundos consultando la pasarela.
    //    (Con tope de tiempo para no agotar el límite del servidor.)
    let tries = 0;
    while (!redirectUrl && transactionId && tries < 4 && (Date.now() - startedAt) < 8500) {
      tries++;
      await new Promise((s) => setTimeout(s, 1200));
      try {
        const sr = await fetchWithTimeout(
          `${BASE}/GetTransactionResponse?transactionId=${encodeURIComponent(transactionId)}`,
          { method: "GET", headers: baseHeaders() },
          4000
        );
        const sj = await sr.json().catch(() => ({}));
        const ex = extractFrom(sj);
        if (ex.status) status = ex.status;
        if (ex.redirectUrl) redirectUrl = ex.redirectUrl;
        if (FAIL.includes(status)) break;
      } catch { /* sigue intentando hasta agotar el tope */ }
    }

    console.log(
      "Sistecrédito redirectUrl →",
      redirectUrl ? "OK" : "VACÍA",
      "| status:", status || "(sin estado)",
      "| intentos:", tries,
      "| txId:", transactionId || "(sin id)"
    );

    if (FAIL.includes(status)) {
      return res.status(400).json({ ok: false, error: `La transacción no se pudo iniciar (${status}).`, status });
    }

    // Devolvemos al navegador. Con redirectUrl, redirige directo a la pasarela.
    // Si por algún motivo aún no llegó, el navegador la sigue consultando con
    // /api/sistecredito-status usando el transactionId.
    return res.status(200).json({ ok: true, transactionId, status, redirectUrl });
  } catch (err) {
    console.error("sistecredito-create error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
