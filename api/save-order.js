/* ════════════════════════════════════════════════════════════════
   GUARDA / NOTIFICA CADA PEDIDO — versión para VERCEL
   En Vercel este endpoint ENVÍA EL CORREO al admin con los datos del
   pedido (Web3Forms, gratis). Así te enteras de cada venta al instante.

   (El panel de Ventas dentro de la página usaba almacenamiento de
   Netlify, que no existe en Vercel. Para verlo dentro de la web en
   Vercel hay que conectar una base de datos — ver api/list-orders.js.)

   Ruta automática:  /api/save-order   ←  api/save-order.js

   CÓMO ACTIVAR EL CORREO (1 sola vez):
   1) Entra a  https://web3forms.com  y escribe el correo
      reydelaromacolombia@gmail.com  → te llega un "Access Key".
   2) En Vercel: Project Settings → Environment Variables → Add
      Key:   WEB3FORMS_KEY
      Value: (el Access Key que te llegó al correo)
      …o, si prefieres, pégalo abajo en W3KEY_FALLBACK.
   El correo SIEMPRE llega al correo con el que creaste el Access Key.
   ════════════════════════════════════════════════════════════════ */

const ADMIN_EMAIL = "reydelaromacolombia@gmail.com";
const W3KEY_FALLBACK = ""; // ← opcional: pega aquí tu Access Key de Web3Forms

const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const order = req.body || {};
    const reference = order.reference || "RDA-" + Date.now();
    order.reference = reference;
    order.date = order.date || new Date().toISOString();

    // Enviar el correo con los datos del pedido (Web3Forms)
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
      } catch (e) {
        console.error("Error enviando el correo (Web3Forms):", e);
      }
    }

    return res.status(200).json({ ok: true, reference });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
