import { getStore } from "@netlify/blobs";

/* ════════════════════════════════════════════════════════════════
   DEVUELVE TODOS LOS PEDIDOS GUARDADOS (para el panel de Ventas).
   Protegido con un token para que nadie más vea los datos de tus clientes.

   CÓMO ACTIVAR (1 sola vez):
   En Netlify: Site settings → Environment variables → Add variable
     Key:   ADMIN_TOKEN
     Value: (inventa una clave secreta, ej. ReyAroma-2026-x9k7)
   Esa MISMA clave es la que escribes en el panel de Ventas → "Conectar".
   ════════════════════════════════════════════════════════════════ */

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-admin-token") || "";
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return Response.json(
      { error: "Falta configurar ADMIN_TOKEN en Netlify (Site settings → Environment variables)." },
      { status: 500 }
    );
  }
  if (token !== expected) {
    return Response.json({ error: "Token incorrecto." }, { status: 401 });
  }

  try {
    const store = getStore({ name: "ventas", consistency: "strong" });
    const { blobs } = await store.list();
    const orders = [];
    for (const b of blobs) {
      try {
        const o = await store.get(b.key, { type: "json" });
        if (o) orders.push(o);
      } catch { /* ignore una clave dañada */ }
    }
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    return Response.json({ ok: true, count: orders.length, orders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = { path: "/api/list-orders" };
