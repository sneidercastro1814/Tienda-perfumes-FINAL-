// OPCIONAL: esta función NO la usa tu frontend actual.
// Tu tienda muestra Addi con el widget oficial (<addi-widget>), que solo
// necesita VITE_ADDI_SLUG. Deja esta función aquí por si más adelante quieres
// la integración por API (crear orden del lado servidor).
//
// ADDI_AUTH_URL, ADDI_API_URL y ADDI_AUDIENCE vienen en el correo de
// onboarding que Addi envía a los comercios aliados (integraciones@addi.com).
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const order = await req.json();

    // 1) Token de acceso (OAuth2 client_credentials)
    const tokenRes = await fetch(process.env.ADDI_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.ADDI_CLIENT_ID,
        client_secret: process.env.ADDI_CLIENT_SECRET,
        audience: process.env.ADDI_AUDIENCE,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return Response.json({ error: "Error obteniendo token Addi", detail }, { status: 502 });
    }

    const { access_token } = await tokenRes.json();

    // 2) Crear la orden / checkout
    const orderRes = await fetch(`${process.env.ADDI_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify(order),
    });

    const result = await orderRes.json();

    if (!orderRes.ok) {
      return Response.json({ error: "Error creando orden Addi", detail: result }, { status: 502 });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = { path: "/api/addi-create-order" };
