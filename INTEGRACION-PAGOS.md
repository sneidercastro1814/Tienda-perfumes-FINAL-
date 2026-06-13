# 💳 Integración de pagos — Rey del Aroma

Wompi (pago en línea real) + Addi (cuotas) + Sistecrédito (opcional).
La arquitectura mantiene **los secretos solo en el servidor** (funciones de Netlify).

---

## 🚨 PASO 0 — Seguridad (hazlo sí o sí)

Pegaste tus llaves de **producción** en un chat. Antes de salir a producción,
**regenera estas 4 en sus paneles** (toma 2 minutos):

- Wompi → Llave **privada** (`prv_prod_...`)
- Wompi → Secreto de **integridad** (`prod_integrity_...`)
- Wompi → Secreto de **eventos** (`prod_events_...`)
- Addi → **Client secret**

La **llave pública** de Wompi y el **Client ID** de Addi NO son secretos: pueden ir en el frontend.

**Regla de oro:** los secretos NUNCA van en el código ni en GitHub. Solo en variables de entorno de Netlify.

---

## 1) Variables de entorno en Netlify

Netlify → tu sitio → **Site settings → Environment variables**. Agrega:

### Públicas (las usa el navegador)
| Variable | Valor |
|---|---|
| `VITE_WOMPI_PUBLIC_KEY` | tu `pub_prod_...` |
| `VITE_WOMPI_ENV` | `prod` (o `test` para pruebas) |
| `VITE_ADDI_ENABLED` | `true` |
| `VITE_ADDI_SLUG` | `reydelaroma-ecommerce` |
| `VITE_SISTECREDITO_ENABLED` | `false` (ponlo en `true` solo si tienes enlace) |
| `VITE_SISTECREDITO_URL` | (vacío por ahora) |

### Secretas (solo el servidor — funciones)
| Variable | Valor |
|---|---|
| `WOMPI_INTEGRITY_SECRET` | tu `prod_integrity_...` (REGENERADO) |
| `WOMPI_EVENTS_SECRET` | tu `prod_events_...` (REGENERADO) |
| `WOMPI_PRIVATE_KEY` | tu `prv_prod_...` (REGENERADO) — opcional |
| `ADDI_CLIENT_ID` | tu Client ID de Addi |
| `ADDI_CLIENT_SECRET` | tu Client secret (REGENERADO) — opcional por ahora |

> Tras agregarlas, lanza un **nuevo deploy** (las variables `VITE_` se inyectan al compilar).

---

## 2) Webhook de Wompi (confirmación segura del pago)

En el panel de Wompi → **Configuración → URL de eventos**, pon:

```
https://TU-SITIO.netlify.app/api/wompi-webhook
```

La función `wompi-webhook` valida la firma del evento con `WOMPI_EVENTS_SECRET`.
Hoy solo registra el evento (lo ves en Netlify → Functions → wompi-webhook → logs).
Ahí es donde, cuando tengas base de datos, marcarás el pedido como pagado.

> El navegador puede mentir; **la verdad del pago es el webhook + la consulta a la API de Wompi**.

---

## 3) Cómo funciona cada método

- **Wompi** → el cliente llena sus datos, toca *Pagar con Wompi*. El sitio pide la
  **firma al servidor** (`/api/wompi-signature`) y redirige al checkout de Wompi
  (tarjeta, PSE, Nequi, Bancolombia). Al volver, ve una pantalla de resultado
  (aprobado / pendiente / rechazado) que consulta el estado real en la API de Wompi.
- **Addi** → muestra el **widget oficial** en la ficha de producto y en el checkout
  con las cuotas para ese monto. El cliente solicita el cupo desde ahí.
- **Sistecrédito** → oculto hasta que pongas `VITE_SISTECREDITO_ENABLED=true` y la URL.

---

## 4) Probar en tu PC (opcional)

Las funciones serverless **no corren con `npm run dev`**. Usa la CLI de Netlify:

```bash
npm install -g netlify-cli
netlify dev
```

Eso levanta Vite + las funciones juntas en `http://localhost:8888`.
El archivo `.env` (local, ignorado por Git) ya trae los valores públicos.

> Para probar pagos sin mover plata real: usa llaves `pub_test_...` /
> `test_integrity_...` y pon `VITE_WOMPI_ENV=test`.

---

## 5) Checklist de despliegue

- [ ] Regeneré los 4 secretos.
- [ ] Cargué todas las variables en Netlify (públicas + secretas).
- [ ] Configuré la URL de eventos en Wompi → `/api/wompi-webhook`.
- [ ] Hice un deploy nuevo.
- [ ] Probé una compra real pequeña con Wompi y vi la pantalla de resultado.
- [ ] Verifiqué que el widget de Addi aparece en la ficha de producto.

---

### Archivos clave de esta integración
```
netlify.toml                          ← build + funciones + SPA
netlify/functions/wompi-signature.mjs ← firma de integridad (servidor)
netlify/functions/wompi-webhook.mjs   ← valida eventos de Wompi
.env.example                          ← plantilla de variables públicas
src/ReyDelAroma.jsx                   ← checkout seguro + widget Addi + pantalla de resultado
```
