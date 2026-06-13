import crypto from "node:crypto";

// Valida que un evento (webhook) realmente viene de Wompi y no fue alterado.
// Checksum = SHA256( valores_de_properties + timestamp + secreto_de_eventos )
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
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
      return Response.json({ error: "Firma inválida" }, { status: 401 });
    }

    // ✅ Evento legítimo.
    const transaction = data.transaction || {};
    // transaction.status puede ser: APPROVED, DECLINED, VOIDED, ERROR
    console.log("Evento Wompi válido:", transaction.reference, transaction.status);

    // TODO: marcar el pedido como pagado/fallido en tu lógica (DB, correo, etc.)

    return Response.json({ received: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = { path: "/api/wompi-webhook" };
