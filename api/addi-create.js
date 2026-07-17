/* ════════════════════════════════════════════════════════════════
   ADDI · CREAR ORDEN (Checkout API)   ·   Vercel
   Ruta automática:  POST /api/addi-create

   Crea la orden en Addi con tus credenciales de comercio y DEVUELVE LA
   URL DEL CHECKOUT DE ADDI (ordercheckout.addi.com/allies/…/checkout)
   para que el navegador redirija al cliente DIRECTO al portal de Addi
   —igual que Wompi y Sistecrédito—, sin widget ni pasos intermedios.

   Flujo (API oficial de Addi):
     1) Token:  POST https://auth.addi.com/oauth/token
        body { audience, grant_type:"client_credentials", client_id, client_secret }
     2) Orden:  POST https://api.addi.com/v1/online-applications  (Bearer token)
        Addi responde 301 con la URL del checkout en el header "Location".

   ⚠️ Las CREDENCIALES viven SOLO aquí (servidor). Nunca en el navegador ni en GitHub.
   Variables en  Vercel → Project Settings → Environment Variables:

     ADDI_CLIENT_ID     = (Identificador del cliente que te dio Addi)
     ADDI_CLIENT_SECRET = (Identificador secreto que te dio Addi)
     ADDI_ENV           = production      (usa "sandbox" para pruebas)

   Estas son DISTINTAS del ally-slug del widget (VITE_ADDI_SLUG). Si aún no
   las tienes, pídeselas a tu contacto de Addi (son las mismas credenciales
   que usan las integraciones de Shopify / WooCommerce / Magento).
   ════════════════════════════════════════════════════════════════ */

export const config = { maxDuration: 30 };

/* Endpoints oficiales de Addi Colombia (producción y pruebas). */
function addiEndpoints(sandbox) {
  return sandbox
    ? {
        auth: "https://auth.addi-staging.com/oauth/token",
        audience: "https://api.staging.addi.com",
        create: "https://api.addi-staging.com/v1/online-applications",
      }
    : {
        auth: "https://auth.addi.com/oauth/token",
        audience: "https://api.addi.com",
        create: "https://api.addi.com/v1/online-applications",
      };
}

function siteOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const onlyDigits = (v) => String(v || "").replace(/\D+/g, "");
const round = (v) => Math.round(Number(v) || 0);

/* Busca una URL de checkout de Addi dentro de un cuerpo (por si algún día la
   respuesta no fuera 301 sino un JSON con la URL). */
function extractUrlFromBody(text) {
  if (!text) return "";
  try {
    const j = JSON.parse(text);
    const cand =
      j.redirectUrl || j.url || j.checkoutUrl || j.applicationUrl ||
      (j.data && (j.data.redirectUrl || j.data.url)) || "";
    if (cand) return String(cand).trim();
  } catch { /* no era JSON */ }
  const m = String(text).match(/https?:\/\/[^\s"']*addi[^\s"']*/i);
  return m ? m[0] : "";
}

/* 1) Obtiene el token de acceso de Addi (OAuth client_credentials). */
async function getToken(ep, clientId, clientSecret) {
  const r = await fetchWithTimeout(ep.auth, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      audience: ep.audience,
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  }, 10000);

  const text = await r.text().catch(() => "");
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }
  console.log("Addi /oauth/token →", r.status, text.slice(0, 300));

  if (r.status === 401) throw new Error("Credenciales de Addi inválidas (client_id / client_secret).");
  if (!r.ok || !data.access_token) throw new Error("No se pudo autenticar con Addi.");
  return data.access_token;
}

/* 2) Crea la orden. Addi responde 301 con la URL del checkout en "Location".
   Usamos redirect:"manual" para leer esa cabecera SIN repetir la petición
   (un solo POST = una sola orden). */
async function createOrder(ep, token, payload) {
  const r = await fetchWithTimeout(ep.create, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: `bearer ${token}`,
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  }, 12000);

  let url = r.headers.get("location") || "";
  let bodyText = "";
  if (!url) {
    bodyText = await r.text().catch(() => "");
    url = extractUrlFromBody(bodyText);
  }
  console.log("Addi /online-applications →", r.status, "location:", url ? "OK" : "VACÍA", bodyText.slice(0, 400));

  if (r.status === 401) throw new Error("Sesión con Addi no autorizada. Revisa tus credenciales.");
  if (r.status === 400) {
    let msg = "Addi rechazó la orden (datos inválidos).";
    try { const j = JSON.parse(bodyText || "{}"); if (j.message) msg = j.message; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (r.status === 409) throw new Error("El cliente ya tiene un crédito Addi en curso. Intenta más tarde.");
  if (!url) throw new Error("Addi no devolvió el enlace de checkout. Intenta de nuevo.");
  return url;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  const clientId = process.env.ADDI_CLIENT_ID;
  const clientSecret = process.env.ADDI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      ok: false,
      error:
        "Faltan las credenciales de Addi en el servidor (ADDI_CLIENT_ID y ADDI_CLIENT_SECRET en Vercel → Environment Variables).",
    });
  }

  const sandbox = String(process.env.ADDI_ENV || "production").toLowerCase() !== "production";
  const ep = addiEndpoints(sandbox);
  const origin = siteOrigin(req);

  try {
    const { reference, amount, shipping = 0, items = [], customer = {} } = req.body || {};
    if (!amount || !customer.cedula || !customer.name) {
      return res.status(400).json({ ok: false, error: "Faltan datos del pedido (monto, nombre o cédula)." });
    }

    const totalAmount = round(amount);
    const shippingAmount = round(shipping);
    const goodsTotal = Math.max(0, totalAmount - shippingAmount); // lo que deben sumar los ítems

    // Nombre / apellido a partir del nombre completo.
    const parts = String(customer.name).trim().split(/\s+/);
    const firstName = parts.shift() || "Cliente";
    const lastName = parts.join(" ") || firstName;

    // Ítems: solo los mandamos "tal cual" si su suma coincide con el total de
    // productos (sin envío). Si hay promo/cupón y no coincide, los consolidamos
    // en un solo ítem para que Addi no rechace la orden por descuadre.
    const cleanItems = (Array.isArray(items) ? items : []).filter(Boolean);
    const itemsSum = cleanItems.reduce((s, it) => s + round(it.price) * (Number(it.qty) || 1), 0);
    const httpPic = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");

    let addiItems;
    if (cleanItems.length && Math.abs(itemsSum - goodsTotal) <= 1) {
      addiItems = cleanItems.map((it, i) => ({
        sku: String(it.sku || it.name || `item-${i + 1}`).slice(0, 60),
        name: String(it.name || "Producto").slice(0, 120),
        quantity: Number(it.qty) || 1,
        unitPrice: round(it.price),
        tax: 0,
        pictureUrl: httpPic(it.image),
        category: String(it.brand || "Perfumería").slice(0, 60),
      }));
    } else {
      const units = cleanItems.reduce((n, it) => n + (Number(it.qty) || 1), 0) || 1;
      addiItems = [{
        sku: "PEDIDO",
        name: `Pedido Rey del Aroma (${units} ${units === 1 ? "producto" : "productos"})`,
        quantity: 1,
        unitPrice: goodsTotal,
        tax: 0,
        pictureUrl: httpPic(cleanItems[0] && cleanItems[0].image),
        category: "Perfumería",
      }];
    }

    const address = {
      lineOne: String(customer.address || "Sin dirección").slice(0, 200),
      city: String(customer.city || "").slice(0, 80),
      country: "CO",
    };

    const payload = {
      description: "Compra en Rey del Aroma",
      orderId: String(reference || `RDA-${Date.now()}`),
      totalAmount,
      shippingAmount,
      totalTaxesAmount: 0,
      currency: "COP",
      items: addiItems,
      client: {
        idType: "CC",
        idNumber: onlyDigits(customer.cedula),
        firstName,
        lastName,
        email: String(customer.email || "").trim(),
        cellphone: onlyDigits(customer.phone),
        cellphoneCountryCode: "57",
        address,
      },
      shippingAddress: address,
      billingAddress: address,
      allyUrlRedirection: {
        logoUrl: `${origin}/favicon.png`,
        callbackUrl: `${origin}/api/addi-webhook`,
        redirectionUrl: `${origin}/?addi=1`,
      },
    };

    const token = await getToken(ep, clientId, clientSecret);
    const redirectUrl = await createOrder(ep, token, payload);

    return res.status(200).json({ ok: true, redirectUrl });
  } catch (err) {
    console.error("addi-create error:", err);
    return res.status(400).json({ ok: false, error: err.message || "No se pudo iniciar el pago con Addi." });
  }
}
