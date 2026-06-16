import crypto from "node:crypto";

/* ════════════════════════════════════════════════════════════════
   WEBHOOK DE WOMPI — versión para VERCEL
   Valida que un evento (confirmación de pago) realmente viene de Wompi
   y no fue alterado.
     Checksum = SHA256( valores_de_properties + timestamp + secreto_de_eventos )

   Ruta automática:  /api/wompi-webhook   ←  api/wompi-webhook.js

   En el panel de Wompi → Configuración → URL de eventos, pon:
     https://TU-SITIO.vercel.app/api/wompi-webhook

   Variable de entorno requerida:
     WOMPI_EVENTS_SECRET = tu  prod_events_...  (o test_events_...)
   ════════════════════════════════════════════════════════════════ */
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET;

    const properties = body?.signature?.properties || [];
    const receivedChecksum = body?.signature?.checksum;
    const timestamp = body?.timestamp;
    const data = body?.data || {};

    // Toma el valor de cada propiedad indicada (ej. "transaction.status")
    // navegando dentro de "data", y los concatena EN ORDEN.
    const values = properties.map((p) =>
      p.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), data)
    );

    const chain = `${values.join("")}${timestamp}${eventsSecret}`;
    const calculated = crypto.createHash("sha256").update(chain).digest("hex");

    if (calculated !== receivedChecksum) {
      // Si no coincide, alguien intenta suplantar a Wompi. Rechaza.
      return res.status(401).json({ error: "Firma inválida" });
    }

    // ✅ Evento legítimo.
    const transaction = data.transaction || {};
    // transaction.status puede ser: APPROVED, DECLINED, VOIDED, ERROR
    console.log("Evento Wompi válido:", transaction.reference, transaction.status);

    // TODO: cuando tengas base de datos, marca el pedido como pagado/fallido aquí.

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
