import crypto from "node:crypto";

/* ════════════════════════════════════════════════════════════════
   FIRMA DE INTEGRIDAD DE WOMPI — versión para VERCEL
   Genera la firma EN EL SERVIDOR. El secreto WOMPI_INTEGRITY_SECRET
   nunca llega al navegador.

   La ruta es automática por el nombre del archivo:
     /api/wompi-signature   ←  api/wompi-signature.js

   Variable de entorno requerida (Vercel → Project Settings → Env Variables):
     WOMPI_INTEGRITY_SECRET = tu  prod_integrity_...  (o test_integrity_...)
   ════════════════════════════════════════════════════════════════ */
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      reference,
      amountInCents,
      currency = "COP",
      expirationTime, // opcional (ISO 8601), solo si usas expiración
    } = req.body || {};

    if (!reference || !amountInCents) {
      return res
        .status(400)
        .json({ error: "reference y amountInCents son obligatorios" });
    }

    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
      return res
        .status(500)
        .json({ error: "Falta WOMPI_INTEGRITY_SECRET en el servidor (Vercel → Env Variables)" });
    }

    // EL ORDEN IMPORTA:
    // referencia + monto_en_centavos + moneda + (expiración opcional) + secreto
    const chain = expirationTime
      ? `${reference}${amountInCents}${currency}${expirationTime}${integritySecret}`
      : `${reference}${amountInCents}${currency}${integritySecret}`;

    const signature = crypto.createHash("sha256").update(chain).digest("hex");

    return res.status(200).json({ signature, reference, amountInCents, currency });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
