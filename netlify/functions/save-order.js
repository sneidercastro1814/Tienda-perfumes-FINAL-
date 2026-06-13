import { getStore } from "@netlify/blobs";

/* ════════════════════════════════════════════════════════════════
   GUARDA CADA PEDIDO + ENVÍA EL CORREO AL ADMIN
   - El pedido se guarda en Netlify Blobs (lo lee el panel de Ventas).
   - El correo se envía con Web3Forms (gratis).

   CÓMO ACTIVAR EL CORREO (1 sola vez):
   1) Entra a  https://web3forms.com  y escribe el correo
      reydelaromacolombia@gmail.com  → te llega un "Access Key".
   2) En Netlify: Site settings → Environment variables → Add variable
      Key:   WEB3FORMS_KEY
      Value: (el Access Key que te llegó al correo)
      …o, si prefieres, pégalo abajo en W3KEY_FALLBACK.
   El correo SIEMPRE llega al correo con el que creaste el Access Key.
   ════════════════════════════════════════════════════════════════ */

const ADMIN_EMAIL = "reydelaromacolombia@gmail.com";
const W3KEY_FALLBACK = ""; // ← opcional: pega aquí tu Access Key de Web3Forms

const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const order = await req.json();
    const reference = order.reference || "RDA-" + Date.now();
    order.reference = reference;
    order.date = order.date || new Date().toISOString();

    // 1) Guardar la venta (Netlify Blobs). Clave ordenable por fecha.
    try {
      const store = getStore("ventas");
      const key = `${order.date}__${reference}`.replace(/[^a-zA-Z0-9_.:-]/g, "_");
      await store.setJSON(key, order);
    } catch (e) {
      console.error("Error guardando en Blobs:", e);
    }

    // 2) Enviar el correo con los datos del pedido (Web3Forms)
    const w3key = process.env.WEB3FORMS_KEY || W3KEY_FALLBACK;
    if (w3key) {
      const c = order.customer || {};
      const itemsTxt = (order.items || [])
        .map((it) => `• ${it.qty} x ${it.name}${it.size ? " (" + it.size + ")" : ""} — ${cop(it.price * it.qty)}`)
        .join("\n");

      const message =
`NUEVO PEDIDO — Rey del Aroma

Pedido:  ${reference}
Fecha:   ${new Date(order.date).toLocaleString("es-CO")}
Pago:    ${order.method || "-"}

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

      try {
        await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            access_key: w3key,
            subject: `🛒 Nuevo pedido ${reference} — ${c.name || "Cliente"} (${cop(order.total)})`,
            from_name: "Rey del Aroma — Tienda",
            to: ADMIN_EMAIL,            // informativo (Web3Forms envía al correo del Access Key)
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
      } catch (e) {
        console.error("Error enviando el correo (Web3Forms):", e);
      }
    }

    return Response.json({ ok: true, reference });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

export const config = { path: "/api/save-order" };
