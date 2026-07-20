/* ════════════════════════════════════════════════════════════════
   GUARDA CADA PEDIDO  —  POST /api/save-order
   ────────────────────────────────────────────────────────────────
   Hace DOS cosas con cada compra:

   1) La guarda en el almacenamiento de Vercel (Blob) para que aparezca
      en el panel "Ventas en tiempo real" del administrador.
   2) Te manda el correo con todos los datos (Web3Forms), como siempre.

   Si una de las dos falla, la otra sigue funcionando: nunca se pierde
   una venta por un problema de red.

   El pedido se guarda como "pendiente" porque en este momento el
   cliente todavía no ha pagado (lo mandamos a Wompi / Addi /
   Sistecrédito). Cuando el pago se confirma, el estado pasa a
   "pagado" desde:
      · api/confirm-order.js  (cuando el cliente vuelve a la tienda)
      · api/wompi-webhook.js / api/sistecredito-webhook.js  (avisos de
        la pasarela, aunque el cliente cierre el navegador)

   CORREO (opcional, una sola vez):
     1) https://web3forms.com  con  reydelaromacolombia@gmail.com
        → te llega un "Access Key".
     2) Vercel → Settings → Environment Variables → Add
          Key:   WEB3FORMS_KEY
          Value: (el Access Key)
   ════════════════════════════════════════════════════════════════ */

import { hayBlob, guardarPedido } from "../lib/pedidos.js";

const ADMIN_EMAIL = "reydelaromacolombia@gmail.com";
const W3KEY_FALLBACK = ""; // ← opcional: pega aquí tu Access Key de Web3Forms

const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

/* Nombre bonito del medio de pago para el correo y el panel. */
const MEDIOS = { wompi: "Wompi", addi: "Addi", sistecredito: "Sistecrédito" };

async function enviarCorreo(order) {
  const w3key = process.env.WEB3FORMS_KEY || W3KEY_FALLBACK;
  if (!w3key) return;

  const c = order.customer || {};
  const itemsTxt = (order.items || [])
    .map((it) => `• ${it.qty} x ${it.name}${it.size ? " (" + it.size + ")" : ""} — ${cop(it.price * it.qty)}`)
    .join("\n");

  const message =
`NUEVO PEDIDO — Rey del Aroma

Pedido:  ${order.reference}
Fecha:   ${new Date(order.date).toLocaleString("es-CO")}
Pago:    ${MEDIOS[order.method] || order.method || "-"}
Estado:  PENDIENTE DE PAGO (el cliente va camino a la pasarela)

— CLIENTE —
Nombre:        ${c.name || "-"}
ID / Cédula:   ${c.cedula || "-"}
Celular/Whats: ${c.phone || "-"}
Correo:        ${c.email || "-"}
Ciudad:        ${c.city || "-"}
Dirección:     ${c.address || "-"}

— PRODUCTOS —
${itemsTxt || "-"}

Subtotal:  ${cop(order.subtotal)}
Descuento: ${cop(order.discount)}${order.coupon ? " (cupón " + order.coupon + ")" : ""}
Envío (${order.zone || "-"}): ${cop(order.shipping)}
TOTAL:     ${cop(order.total)}`;

  await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: w3key,
      subject: `🛒 Nuevo pedido ${order.reference} — ${c.name || "Cliente"} (${cop(order.total)})`,
      from_name: "Rey del Aroma — Tienda",
      to: ADMIN_EMAIL, // informativo (Web3Forms envía al correo del Access Key)
      replyto: c.email || "",
      nombre_cliente: c.name || "",
      id_cedula: c.cedula || "",
      telefono: c.phone || "",
      ciudad: c.city || "",
      direccion: c.address || "",
      total: cop(order.total),
      message,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    const order = req.body || {};
    order.reference = order.reference || "RDA-" + Date.now();
    order.date = order.date || new Date().toISOString();
    order.estado = "pendiente";       // ← todavía no ha pagado
    order.metodoNombre = MEDIOS[order.method] || order.method || "";

    // Las dos tareas van en paralelo: si una falla, la otra igual se cumple.
    const [guardado, correo] = await Promise.allSettled([
      hayBlob() ? guardarPedido(order) : Promise.resolve(false),
      enviarCorreo(order),
    ]);

    if (guardado.status === "rejected") console.error("save-order (blob):", guardado.reason);
    if (correo.status === "rejected") console.error("save-order (correo):", correo.reason);

    return res.status(200).json({
      ok: true,
      reference: order.reference,
      guardado: guardado.status === "fulfilled" && guardado.value === true,
    });
  } catch (err) {
    console.error("save-order:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
