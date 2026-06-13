import crypto from "node:crypto";

// Genera la firma de integridad de Wompi EN EL SERVIDOR.
// El secreto WOMPI_INTEGRITY_SECRET nunca llega al navegador.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
      reference,
      amountInCents,
      currency = "COP",
      expirationTime, // opcional (ISO 8601), solo si usas expiración
    } = await req.json();

    if (!reference || !amountInCents) {
      return Response.json(
        { error: "reference y amountInCents son obligatorios" },
        { status: 400 }
      );
    }

    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
      return Response.json(
        { error: "Falta WOMPI_INTEGRITY_SECRET en el servidor" },
        { status: 500 }
      );
    }

    // EL ORDEN IMPORTA:
    // referencia + monto_en_centavos + moneda + (expiración opcional) + secreto
    const chain = expirationTime
      ? `${reference}${amountInCents}${currency}${expirationTime}${integritySecret}`
      : `${reference}${amountInCents}${currency}${integritySecret}`;

    const signature = crypto.createHash("sha256").update(chain).digest("hex");

    return Response.json({ signature, reference, amountInCents, currency });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

// Esto hace que la función responda en /api/wompi-signature
export const config = { path: "/api/wompi-signature" };
