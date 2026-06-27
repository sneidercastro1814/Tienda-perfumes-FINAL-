import { useState, useEffect, useRef, useMemo } from "react";
import { PRODUCTS, imageForFile, FAMILIES, TAG_BY_SLUG, COLLECTIONS } from "./data/products";
import banner1 from "./assets/banners/banner-1.jpg";
import banner2 from "./assets/banners/banner-2.jpg";
import banner3 from "./assets/banners/banner-3.jpg";
import feat1 from "./assets/featured/feat-1.jpg";
import feat2 from "./assets/featured/feat-2.jpg";
import feat3 from "./assets/featured/feat-3.jpg";
import feat4 from "./assets/featured/feat-4.jpg";
import feat5 from "./assets/featured/feat-5.jpg";
import logoPrincipal from "./assets/logo-principal.png";
import logoWompi from "./assets/payments/wompi.png";
import logoAddi from "./assets/payments/addi.png";
import logoSistecredito from "./assets/payments/sistecredito.png";
import selloOriginal from "./assets/sello-original.png";

/* ════════════════════════════════════════════════════════════════
   CONFIGURACIÓN — edita estos valores
   ════════════════════════════════════════════════════════════════ */
const WHATSAPP = "573189917571";          // ← Tu número de WhatsApp (con 57)
const ADMIN_PASSWORD = "admin123";         // ← Cambia tu contraseña de admin
const LS_KEY = "rda-catalog-v3";
const LS_COUPONS = "rda-coupons-v1";       // ← Cupones guardados (los crea el admin)
const LS_COLLECTIONS = "rda-collections-v1"; // ← Colecciones que crea el admin
const LS_AROMAS = "rda-aromas-v1";           // ← Tipos de aroma que crea el admin
const LS_ORDERS = "rda-orders-v1";           // ← Respaldo local de pedidos (por si falla la red)
const LS_ADMIN_TOKEN = "rda-admin-token";    // ← Token del panel de Ventas (se guarda en este navegador)

const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

/* ════════════════════════════════════════════════════════════════
   ENVÍOS — edita estos valores a tu gusto
   ════════════════════════════════════════════════════════════════ */
const SHIPPING = {
  // Monto desde el cual el envío es GRATIS en Bogotá (en pesos)
  bogotaFreeFrom: 250000,
  // Costo de envío para municipios no listados (tarifa nacional estándar)
  otherCost: 18000,
  // Texto de la opción "otra ciudad" en el selector
  otherLabel: "Otra ciudad / municipio",
  // Tarifas de envío por ciudad de Colombia, agrupadas por costo (en pesos).
  // El precio se asigna AUTOMÁTICAMENTE cuando el cliente elige su ciudad.
  tiers: [
    { cost: 8000,  cities: ["Bogotá"] },
    { cost: 12000, cities: ["Soacha", "Chía"] },
    { cost: 18000, cities: ["Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Cúcuta", "Pereira", "Manizales", "Armenia", "Ibagué", "Villavicencio", "Neiva", "Pasto", "Montería", "Santa Marta", "Soledad", "Bello", "Envigado", "Itagüí", "Floridablanca", "Zipaquirá", "Madrid", "Mosquera", "Funza", "Facatativá", "Popayán", "Tunja", "Valledupar", "Sincelejo", "Riohacha", "Quibdó", "Florencia", "Yopal", "Duitama", "Sogamoso", "Girardot", "Tuluá", "Palmira", "Buenaventura", "Apartadó", "Maicao", "Magangué", "Cartago", "Buga", "Sahagún", "Leticia", "Mitú", "Inírida", "Puerto Carreño", "Mocoa", "Arauca", "Puerto Asís"] },
    { cost: 50000, cities: ["San Andrés"] },
  ],
};

// Lista plana de ciudades { name, cost }, ordenada alfabéticamente (Bogotá primero).
const SHIPPING_CITIES = (() => {
  const flat = [];
  SHIPPING.tiers.forEach((t) => t.cities.forEach((name) => flat.push({ name, cost: t.cost })));
  flat.sort((a, b) => {
    if (a.name === "Bogotá") return -1;
    if (b.name === "Bogotá") return 1;
    return a.name.localeCompare(b.name, "es");
  });
  return flat;
})();

/* Costo de envío según la CIUDAD elegida y el subtotal del pedido.
   - Sin ciudad aún: 0 (todavía no suma; el cliente debe elegirla para pagar).
   - Bogotá: GRATIS a partir de SHIPPING.bogotaFreeFrom.
   - Ciudad no listada / "otra": tarifa nacional estándar. */
function shippingCost(cityName, subtotal) {
  if (!cityName) return 0;
  if (cityName === SHIPPING.otherLabel) return SHIPPING.otherCost;
  if (cityName === "Bogotá" && subtotal >= SHIPPING.bogotaFreeFrom) return 0;
  const found = SHIPPING_CITIES.find((c) => c.name === cityName);
  return found ? found.cost : SHIPPING.otherCost;
}

/* Descuento que aplica un cupón sobre un subtotal. */
function couponDiscount(c, subtotal) {
  if (!c) return 0;
  if (c.type === "percent") return Math.min(subtotal, Math.round((subtotal * (Number(c.value) || 0)) / 100));
  return Math.min(subtotal, Math.round(Number(c.value) || 0));
}

/* Emoji + descripción corta por familia olfativa (tipo de aroma). */
const FAMILY_META = {
  "Amaderado": { emoji: "🌳", hint: "Maderas, sándalo, cedro" },
  "Oriental":  { emoji: "🔥", hint: "Ámbar, especias, vainilla" },
  "Floral":    { emoji: "🌸", hint: "Rosa, jazmín, flores" },
  "Frutal":    { emoji: "🍑", hint: "Frutas jugosas y dulces" },
  "Dulce":     { emoji: "🍬", hint: "Gourmand, vainilla, caramelo" },
  "Cítrico":   { emoji: "🍋", hint: "Cítricos frescos" },
  "Acuático":  { emoji: "🌊", hint: "Marino, fresco, limpio" },
  "Aromático": { emoji: "🌿", hint: "Lavanda, hierbas, fougère" },
  "Vainilla":  { emoji: "🍦", hint: "Vainilla cremosa y cálida" },
  "Fresco":    { emoji: "❄️", hint: "Ligero, limpio, refrescante" },
  "Ámbar":     { emoji: "🟠", hint: "Ámbar cálido y resinoso" },
  "Oud":       { emoji: "🪵", hint: "Oud intenso y profundo" },
  "Gourmand":  { emoji: "🍮", hint: "Dulce, caramelo, postre" },
};

/* ════════════════════════════════════════════════════════════════
   MÉTODOS DE PAGO
   Los valores PÚBLICOS vienen de variables de entorno (VITE_...).
   Los SECRETOS (firma de integridad, eventos, client secret) viven
   SOLO en el servidor (funciones de Netlify), nunca en este archivo.
   ════════════════════════════════════════════════════════════════ */
const ENV = import.meta.env;

const WOMPI = {
  publicKey: ENV.VITE_WOMPI_PUBLIC_KEY || "",
  env: (ENV.VITE_WOMPI_ENV || "prod").toLowerCase(), // "prod" | "test"
};
// Base de la API pública de Wompi (solo lectura de estado de transacción)
const WOMPI_API =
  WOMPI.env === "test" ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";

const ADDI = {
  enabled: String(ENV.VITE_ADDI_ENABLED ?? "true") === "true",
  slug: ENV.VITE_ADDI_SLUG || "",
};

const SISTECREDITO = {
  // Integración por API (pasarela). Las llaves viven en el SERVIDOR (Vercel,
  // variables SISTECREDITO_*); aquí solo encendemos/apagamos el método con
  // VITE_SISTECREDITO_ENABLED = "true".
  enabled: String(ENV.VITE_SISTECREDITO_ENABLED ?? "false") === "true",
};

// Mapa que usa la UI para mostrar/ocultar métodos
const PAYMENTS = {
  wompi: { enabled: !!WOMPI.publicKey },
  addi: { enabled: ADDI.enabled && !!ADDI.slug },
  sistecredito: { enabled: SISTECREDITO.enabled },
};

/* Referencia única para cada pedido */
const newReference = () =>
  "RDA-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

/* Construye la URL del Checkout Web de Wompi.
   La FIRMA se pide al servidor (/api/wompi-signature): el secreto de
   integridad jamás llega al navegador. */
async function buildWompiUrl({ amount, reference, email, phone, fullName }) {
  const cents = Math.round(Number(amount) || 0) * 100; // COP no tiene decimales

  const res = await fetch("/api/wompi-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, amountInCents: cents, currency: "COP" }),
  });
  if (!res.ok) throw new Error("No se pudo generar la firma del pago");
  const { signature } = await res.json();
  if (!signature) throw new Error("Firma vacía");

  const redirectUrl = `${window.location.origin}/?wompi=1`;
  const p = new URLSearchParams();
  p.set("public-key", WOMPI.publicKey);
  p.set("currency", "COP");
  p.set("amount-in-cents", String(cents));
  p.set("reference", reference);
  p.set("signature:integrity", signature);
  p.set("redirect-url", redirectUrl);
  if (email) p.set("customer-data:email", email);
  if (phone) p.set("customer-data:phone-number", phone);
  if (fullName) p.set("customer-data:full-name", fullName);
  return `https://checkout.wompi.co/p/?${p.toString()}`;
}

/* Componente del widget de Addi (cuotas). Carga el bundle oficial una vez
   y renderiza el web component <addi-widget>. Se re-monta al cambiar el
   precio gracias a la "key". */
function AddiWidget({ price, className }) {
  useEffect(() => {
    if (!ADDI.enabled || !ADDI.slug) return;
    const SRC = "https://s3.amazonaws.com/widgets.addi.com/bundle.min.js";
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);
  if (!ADDI.enabled || !ADDI.slug || !price) return null;
  const cleanPrice = Math.round(Number(price) || 0);
  return (
    <div className={`addi-box ${className || ""}`}>
      <addi-widget key={cleanPrice} price={String(cleanPrice)} ally-slug={ADDI.slug}></addi-widget>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ESTILOS GLOBALES
────────────────────────────────────────────────────────────── */
const CSS = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --gold: #c9a84c;
  --gold-l: #e8d48a;
  --gold-d: #8a6010;
  --bg:  #fafaf8;
  --bg2: #f2f2ee;
  --bg3: #e8e8e4;
  --bg4: #dfdfd9;
  --surface: rgba(0,0,0,0.03);
  --border: rgba(201,168,76,0.28);
  --border-h: rgba(201,168,76,0.6);
  --text: #1a1a18;
  --text-dim: #444;
  --text-muted: #888;
  --wa: #1fa855;
  --serif: 'Fraunces', 'Cormorant Garamond', Georgia, serif;
  --sans: 'Manrope', system-ui, sans-serif;
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-weight: 400;
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}
.l-rey, .sec-title, .pd-name, .coll-title, .co-title, .admin-title, .login-title,
.pcard-name, .pcard-price, .pd-price, .cart-title, .cart-ta, .co-total, .footer-logo {
  font-optical-sizing: auto;
}
button { font-family: var(--sans); }
input, select, textarea { font-family: var(--sans); }
img { max-width: 100%; }

/* GRANO */
body::after {
  content: ''; position: fixed; inset: 0; pointer-events: none;
  z-index: 9999; opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}

/* ── BARRA ANUNCIO ── */
.announce { background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 0; overflow: hidden; position: relative; }
.announce::before, .announce::after { content: ''; position: absolute; top: 0; bottom: 0; width: 100px; z-index: 2; pointer-events: none; }
.announce::before { left: 0; background: linear-gradient(to right, var(--bg), transparent); }
.announce::after  { right: 0; background: linear-gradient(to left, var(--bg), transparent); }
.ann-track { display: flex; width: max-content; animation: ticker 30s linear infinite; }
.ann-i { font-size: 12px; font-weight: 500; letter-spacing: 3px; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 12px; padding: 0 48px; white-space: nowrap; }
.ann-i em { color: var(--gold); font-style: normal; }
.ann-sep { width: 3px; height: 3px; background: var(--gold); border-radius: 50%; opacity: 0.4; flex-shrink: 0; }
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* ── NAVBAR ── */
.nav { background: rgba(12,12,11,0.97); backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%); border-bottom: 1px solid var(--border); padding: 0 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; height: 72px; }
.nav-logo-img { height: 46px; width: auto; display: block; flex-shrink: 0; }
.nav-logo { display: flex; align-items: center; gap: 14px; cursor: pointer; transition: opacity 0.3s; }
.nav-logo-c { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.nav-left { display: flex; align-items: center; gap: 8px; }
.nav-logo:hover { opacity: 0.75; }
.nav-logo-text { display: flex; flex-direction: column; }
.l-rey { font-family: var(--serif); font-size: 28px; font-weight: 600; color: var(--gold); letter-spacing: 7px; display: block; line-height: 1; }
.l-da { font-size: 10px; font-weight: 500; letter-spacing: 7px; color: var(--gold); opacity: 0.45; display: block; margin-top: 4px; }
.nav-sep { display: none; }
.nav-links { position: absolute; left: 50%; transform: translateX(-50%); display: flex; gap: 2px; align-items: center; z-index: 1; white-space: nowrap; }
.nl { font-size: 12px; font-weight: 500; letter-spacing: 2.5px; color: rgba(255,255,255,0.72); cursor: pointer; text-transform: uppercase; background: none; border: none; transition: color 0.25s; padding: 8px 13px; position: relative; }
.nl::after { content: ''; position: absolute; bottom: 2px; left: 50%; right: 50%; height: 1px; background: var(--gold); transition: left 0.35s, right 0.35s; }
.nl:hover::after, .nl.act::after { left: 13px; right: 13px; }
.nl:hover, .nl.act { color: var(--gold); }
a.nl { text-decoration: none; display: inline-flex; align-items: center; }
.mobile-menu a.nl { display: block; }
.nl-promo { color: var(--gold-l); font-weight: 700; }
.nl-promo-txt { white-space: nowrap; }
.nl-flame { display: inline-block; font-size: 14px; margin: 0 4px; line-height: 1; transform-origin: 50% 90%; animation: flame 0.9s ease-in-out infinite; }
.nl-flame2 { animation-delay: 0.45s; }
.nav-r { display: flex; align-items: center; gap: 6px; }
.icon-btn { background: none; border: 1px solid transparent; color: rgba(255,255,255,0.8); cursor: pointer; font-size: 18px; padding: 7px 10px; transition: all 0.25s; position: relative; line-height: 1; border-radius: 2px; }
.icon-btn:hover { color: var(--gold); border-color: var(--border); background: rgba(255,255,255,0.07); }
.cbadge { position: absolute; top: -4px; right: -5px; background: var(--gold); color: #000; font-size: 10px; font-weight: 700; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }

/* ── HAMBURGUESA / MENÚ MÓVIL ── */
.hamburger { display: flex; flex-direction: column; justify-content: center; gap: 5px; width: 40px; height: 40px; background: none; border: 1px solid var(--border); cursor: pointer; padding: 9px; border-radius: 2px; transition: border-color 0.25s; flex-shrink: 0; }
.hamburger:hover { border-color: var(--gold); }
.ham-line { display: block; height: 1px; background: rgba(255,255,255,0.8); transition: all 0.3s; transform-origin: center; }
.hamburger.open .ham-line:nth-child(1) { transform: translateY(6px) rotate(45deg); background: var(--gold); }
.hamburger.open .ham-line:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open .ham-line:nth-child(3) { transform: translateY(-6px) rotate(-45deg); background: var(--gold); }
.mobile-menu { display: none; position: absolute; top: 72px; left: 0; right: 0; background: rgba(12,12,11,0.99); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); flex-direction: column; padding: 8px 0 18px; z-index: 99; box-shadow: 0 16px 48px rgba(0,0,0,0.35); }
.mobile-menu.open { display: flex; }
.mobile-menu .nl { width: 100%; text-align: left; padding: 16px 28px; font-size: 13px; border-bottom: 1px solid rgba(201,168,76,0.07); border-radius: 0; }
.mobile-menu .nl:last-child { border-bottom: none; }
.mobile-menu .nl::after { display: none; }
.mobile-menu .nl:hover, .mobile-menu .nl.act { background: rgba(201,168,76,0.05); color: var(--gold); }
.mobile-menu .nl-admin { display: block; border-top: 1px solid var(--border); border-bottom: none; margin-top: 6px; padding-top: 18px; color: var(--gold); }

/* ── CARRUSEL HERO (centrado, con franjas blancas a los lados) ── */
.hero-carousel { padding: 22px clamp(14px, 4vw, 52px) 18px; background: var(--bg); position: relative; }
.hc-viewport { position: relative; z-index: 1; width: 100%; max-width: 1280px; margin: 0 auto; overflow: hidden; background: #0a0a09; border: 1px solid rgba(201,168,76,0.42); border-radius: 16px; box-shadow: 0 26px 60px -30px rgba(0,0,0,0.55); aspect-ratio: 1350 / 714; max-height: 720px; }
.hc-track { display: flex; height: 100%; transition: transform 0.85s cubic-bezier(.45,0,.15,1); }
.hc-slide { position: relative; min-width: 100%; height: 100%; border: none; padding: 0; margin: 0; cursor: pointer; background: #0a0a09; display: block; overflow: hidden; }
/* banner COMPLETO: llena todo el marco sin fondo difuminado */
.hc-slide-img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
.hc-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; border-radius: 50%; background: rgba(12,11,9,0.5); color: var(--gold-l); border: 1px solid rgba(201,168,76,0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: pointer; font-size: 26px; line-height: 1; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(.25,.46,.45,.94); z-index: 5; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.hc-arrow:hover { background: var(--gold); color: #1a1208; border-color: var(--gold); transform: translateY(-50%) scale(1.08); box-shadow: 0 10px 30px rgba(201,168,76,0.45); }
.hc-prev { left: 26px; } .hc-next { right: 26px; }
.hc-dots { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; z-index: 5; padding: 7px 15px; background: rgba(10,10,9,0.34); border-radius: 30px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.09); }
.hc-dot { width: 8px; height: 8px; border-radius: 50%; border: none; background: rgba(255,255,255,0.4); cursor: pointer; padding: 0; transition: all 0.35s; }
.hc-dot:hover { background: rgba(255,255,255,0.7); }
.hc-dot.act { background: var(--gold); width: 26px; border-radius: 5px; box-shadow: 0 0 12px rgba(201,168,76,0.7); }
.hc-promo { position: absolute; top: 16px; left: 16px; z-index: 6; display: inline-flex; align-items: center; gap: 7px; background: rgba(10,9,7,0.6); border: 1px solid rgba(201,168,76,0.6); color: var(--gold-l); font-family: var(--sans); font-weight: 800; font-size: 16px; letter-spacing: 0.5px; padding: 9px 15px; border-radius: 999px; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); transition: transform 0.25s, box-shadow 0.25s; }
.hc-promo:hover { transform: scale(1.06); box-shadow: 0 10px 30px rgba(201,168,76,0.42); }
.hc-promo-txt { background: linear-gradient(135deg, var(--gold-l), var(--gold)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.hc-flame { display: inline-block; font-size: 17px; transform-origin: 50% 90%; animation: flame 0.9s ease-in-out infinite; }
.hc-flame2 { animation-delay: 0.45s; }
@keyframes flame { 0%,100% { transform: scale(1) rotate(-3deg); filter: brightness(1); } 25% { transform: scale(1.18) rotate(3deg); filter: brightness(1.25); } 50% { transform: scale(0.95) rotate(-2deg); filter: brightness(0.95); } 75% { transform: scale(1.12) rotate(2deg); filter: brightness(1.15); } }
@media (max-width: 768px) { .hc-promo { font-size: 13px; padding: 7px 12px; top: 12px; left: 12px; } .hc-flame { font-size: 14px; } }

/* ── DESTACADOS (íconos dorados) ── */
.featured { background: var(--bg); padding: 30px 52px 12px; display: flex; flex-wrap: wrap; gap: 22px 32px; justify-content: center; }
.feat-badge { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 128px; text-align: center; background: none; border: none; }
.feat-badge.clk { cursor: pointer; }
.feat-ring { width: 84px; height: 84px; border-radius: 50%; overflow: hidden; border: 2px solid var(--gold); box-shadow: 0 0 0 4px rgba(201,168,76,0.12), 0 10px 26px rgba(0,0,0,0.18); transition: transform 0.35s, box-shadow 0.35s; background: #0a0a0a; }
.feat-badge:hover .feat-ring { transform: translateY(-5px); box-shadow: 0 0 0 4px rgba(201,168,76,0.22), 0 16px 32px rgba(0,0,0,0.28); }
.feat-ring img { width: 100%; height: 100%; object-fit: cover; }
.feat-cap { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--text-dim); line-height: 1.5; }

/* ── BOTONES ── */
.btn-g { display: inline-flex; align-items: center; gap: 10px; background: var(--gold); color: #000; padding: 15px 38px; font-size: 12px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; border: none; cursor: pointer; transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); position: relative; overflow: hidden; }
.btn-g::before { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%); transform: translateX(-120%); transition: transform 0.6s; }
.btn-g:hover::before { transform: translateX(120%); }
.btn-g:hover { background: var(--gold-l); box-shadow: 0 0 50px rgba(201,168,76,0.3), 0 12px 36px rgba(0,0,0,0.18); transform: translateY(-2px); }
.btn-o { display: inline-flex; align-items: center; gap: 10px; background: transparent; color: var(--gold); padding: 14px 38px; font-size: 12px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; border: 1px solid rgba(201,168,76,0.35); cursor: pointer; transition: all 0.3s; }
.btn-o:hover { background: rgba(201,168,76,0.06); border-color: var(--gold); box-shadow: 0 0 24px rgba(201,168,76,0.1); }
.wa-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 54px; background: var(--wa); color: #fff; border: none; font-size: 13px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
.wa-btn:hover { background: #17924a; box-shadow: 0 10px 30px rgba(31,168,85,0.35); }

/* ── FILTROS ── */
.filters { padding: 0 52px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--bg2); border-bottom: 1px solid rgba(0,0,0,0.07); }
.ftabs { display: flex; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.ftabs::-webkit-scrollbar { display: none; }
.ftab { padding: 18px 24px; font-size: 12px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase; cursor: pointer; color: var(--text-muted); border: none; border-bottom: 2px solid transparent; background: none; transition: all 0.25s; white-space: nowrap; }
.ftab:hover { color: #999; }
.ftab.act { color: var(--gold); border-bottom-color: var(--gold); }
.sort-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.sort-lbl { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
.sort-sel { appearance: none; -webkit-appearance: none; background: var(--bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c9a84c' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center; border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: var(--sans); font-size: 12.5px; font-weight: 600; letter-spacing: 0.3px; padding: 9px 32px 9px 13px; cursor: pointer; transition: border-color 0.2s; }
.sort-sel:hover { border-color: var(--gold); }
.sort-sel:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }

/* ── PRODUCTOS ── */
.products-wrap { padding: 56px 52px 88px; background: var(--bg); }
.sec-hdr { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 44px; flex-wrap: wrap; gap: 8px; }
.sec-title { font-family: var(--serif); font-size: 42px; font-weight: 600; letter-spacing: 0.5px; }
.sec-title span { color: var(--gold); font-style: italic; }
.sec-cnt { font-size: 12px; color: var(--text-muted); letter-spacing: 2.5px; text-transform: uppercase; }
.sec-tools { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.pgrid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: rgba(201,168,76,0.08); max-width: 1180px; margin: 0 auto; }
.pcard { background: var(--bg); cursor: pointer; overflow: hidden; transition: all 0.45s cubic-bezier(0.25,0.46,0.45,0.94); position: relative; display: flex; flex-direction: column; }
.pcard::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(201,168,76,0.05) 0%, transparent 55%); opacity: 0; transition: opacity 0.4s; z-index: 1; pointer-events: none; }
.pcard:hover::before { opacity: 1; }
.pcard:hover { background: #f6f6f2; box-shadow: 0 28px 70px rgba(0,0,0,0.1); z-index: 2; transform: translateY(-8px); }
.pcard-img { height: 340px; display: flex; align-items: center; justify-content: center; position: relative; background: #ffffff; overflow: hidden; }
.pcard-real-img { width: 100%; height: 100%; object-fit: contain; padding: 24px; transition: transform 0.5s; }
.pcard:hover .pcard-real-img { transform: scale(1.05); }
.pcard-badge { position: absolute; top: 14px; left: 0; background: var(--gold); color: #000; font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 9px 4px 8px; text-transform: uppercase; z-index: 2; box-shadow: 0 3px 9px rgba(0,0,0,0.12); }
/* Sello "100% Original": esquina inferior derecha de la imagen del producto */
.pcard-seal { position: absolute; bottom: 14px; right: 14px; width: 58px; height: 58px; object-fit: contain; z-index: 3; pointer-events: none; filter: drop-shadow(0 4px 11px rgba(0,0,0,0.22)); }
.pcard-body { padding: 22px 24px 12px; flex: 1; }
.pcard-cat { font-size: 10px; font-weight: 600; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; margin-bottom: 8px; }
.pcard-name { font-family: var(--serif); font-size: 25px; font-weight: 600; margin-bottom: 4px; letter-spacing: 0.4px; line-height: 1.12; transition: color 0.3s; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 50px; }
.pcard:hover .pcard-name { color: var(--gold-d); }
.pcard-sub { font-size: 11px; color: var(--text-muted); letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 14px; min-height: 11px; }
.pcard-aroma { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; color: var(--gold-d); background: rgba(201,168,76,0.10); border: 1px solid var(--border); padding: 4px 11px; border-radius: 999px; }
.pcard-price { font-family: var(--serif); font-size: 25px; font-weight: 500; color: var(--gold-d); }
.pcard-curr { font-size: 13px; opacity: 0.5; font-family: var(--sans); font-weight: 300; letter-spacing: 1px; }
.pcard-trust { display: flex; align-items: center; gap: 7px; margin-top: 11px; flex-wrap: wrap; }
.pcard-stars { color: var(--gold); font-size: 12.5px; letter-spacing: 1.5px; line-height: 1; flex-shrink: 0; }
.pcard-trust-txt { font-size: 10.5px; font-weight: 700; letter-spacing: 0.3px; color: var(--text-dim); }
.pcard-foot { display: flex; align-items: center; padding: 14px 24px; border-top: 1px solid rgba(0,0,0,0.07); }
.quick-buy { width: 100%; background: #0a0a09; color: #fff; border: 1px solid #0a0a09; font-size: 11px; font-weight: 600; letter-spacing: 2px; padding: 11px 18px; cursor: pointer; transition: all 0.25s; text-transform: uppercase; font-family: var(--sans); }
.quick-buy:hover, .quick-buy:active, .quick-buy:focus { background: var(--gold); color: #000; border-color: var(--gold); }

/* ── Carruseles de productos en el inicio ── */
.prow { max-width: 1280px; margin: 0 auto; padding: 44px 52px 8px; }
.prow-hdr { text-align: center; margin-bottom: 24px; }
.prow-title { font-family: var(--serif); font-size: 30px; font-weight: 600; letter-spacing: 0.3px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.prow-flame { display: inline-block; font-size: 0.8em; transform-origin: 50% 90%; animation: flame 0.9s ease-in-out infinite; }
.prow-flame2 { animation-delay: 0.45s; }
.prow-all { margin-top: 8px; display: inline-block; background: none; border: none; color: var(--gold-d); font-family: var(--sans); font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; transition: color 0.2s; }
.prow-all:hover { color: var(--gold); }
.prow-wrap { position: relative; }
.prow-track { display: flex; gap: 18px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; padding: 14px 4px 24px; -ms-overflow-style: none; scrollbar-width: none; }
.prow-track::-webkit-scrollbar { display: none; }
.prow-card { flex: 0 0 auto; width: 272px; scroll-snap-align: start; border: 1px solid var(--border); }
.prow-arrow { position: absolute; top: 38%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: #fff; border: 1px solid var(--border); color: var(--text); font-size: 26px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 6; box-shadow: 0 8px 26px rgba(0,0,0,0.20); transition: background 0.25s, color 0.25s, border-color 0.25s, transform 0.2s; }
.prow-arrow:hover { background: var(--gold); color: #1a1208; border-color: var(--gold); transform: translateY(-50%) scale(1.08); }
.prow-arrow:active { transform: translateY(-50%) scale(0.96); }
.prow-prev { left: -8px; } .prow-next { right: -8px; }
@media (max-width: 768px) { .prow { padding: 30px 16px 4px; } .prow-title { font-size: 23px; } .prow-card { width: 200px; } .prow-arrow { width: 40px; height: 40px; font-size: 22px; box-shadow: 0 4px 16px rgba(0,0,0,0.22); } .prow-prev { left: 2px; } .prow-next { right: 2px; } }
@media (max-width: 480px) { .prow-card { width: 168px; } .prow-arrow { width: 36px; height: 36px; font-size: 20px; } .prow-prev { left: 0; } .prow-next { right: 0; } }
.empty-state { grid-column: 1/-1; text-align: center; padding: 100px; color: var(--text-muted); }
.empty-state-icon { font-size: 56px; margin-bottom: 18px; opacity: 0.25; }

/* ── DETALLE PRODUCTO ── */
.pd-wrap { padding: 48px 52px 88px; background: var(--bg); }
.bc { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--text-muted); margin-bottom: 40px; letter-spacing: 1.5px; text-transform: uppercase; flex-wrap: wrap; }
.bc .cur { color: var(--gold); }
.bc-sep { color: rgba(0,0,0,0.18); font-size: 14px; }
.bc-lnk { cursor: pointer; transition: color 0.2s; }
.bc-lnk:hover { color: var(--gold); }
.pd-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; }
.pd-grid > * { min-width: 0; }
.pd-main { width: 100%; aspect-ratio: 1/1; background: #ffffff; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.pd-real-img { max-width: 88%; max-height: 88%; object-fit: contain; position: relative; z-index: 1; }
/* Etiqueta colgante "100% Original" en la imagen de detalle */
.pd-hangpin { position: absolute; top: 6px; right: 78px; width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #f0dca0, #b8973f); box-shadow: 0 1px 3px rgba(0,0,0,0.35); z-index: 5; pointer-events: none; }
.pd-hangtag { position: absolute; top: 104px; right: 48px; width: 72px; height: 94px; display: flex; align-items: flex-end; justify-content: center; text-align: center; padding: 0 7px 14px; box-sizing: border-box; background: linear-gradient(150deg, #181c1e, #0a0c0d); border: 1px solid rgba(201,168,76,0.6); border-radius: 9px; box-shadow: 0 14px 26px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06); transform: rotate(8deg); transform-origin: 50% -82px; z-index: 4; pointer-events: none; font-family: var(--sans); animation: pd-tag-sway 3.6s ease-in-out infinite alternate; }
.pd-hangtag::before { content: ''; position: absolute; left: 50%; bottom: 100%; width: 2.2px; height: 92px; margin-left: -1.1px; background: linear-gradient(to top, #a8862f, #e8d48a); border-radius: 2px; }
.pd-hangtag::after { content: ''; position: absolute; top: 10px; left: 50%; width: 11px; height: 11px; margin-left: -5.5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px rgba(201,168,76,0.7), inset 0 1px 2px rgba(0,0,0,0.4); }
.pd-hangtag-in { font-size: 10px; font-weight: 800; letter-spacing: 0.7px; line-height: 1.18; color: var(--gold-l); text-transform: uppercase; }
.pd-hangtag-in b { display: block; font-size: 15px; letter-spacing: 0; margin-bottom: 1px; }
.pd-hangtag-stars { display: block; font-size: 8px; letter-spacing: 2px; color: var(--gold); margin-bottom: 4px; }
/* Galería de miniaturas en la página de detalle (varias fotos por producto) */
.pd-gallery { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.pd-thumb { width: 74px; height: 74px; flex: 0 0 auto; background: #fff; border: 1px solid var(--border); border-radius: 9px; padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
.pd-thumb img { width: 100%; height: 100%; object-fit: contain; }
.pd-thumb:hover { border-color: var(--gold); transform: translateY(-2px); }
.pd-thumb.act { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(201,168,76,0.35); }
@keyframes pd-tag-sway { 0% { transform: rotate(6.5deg); } 100% { transform: rotate(9.5deg); } }
.pd-info { padding-top: 8px; }
.pd-badge { display: inline-block; background: var(--gold); color: #000; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 6px 16px; text-transform: uppercase; margin-bottom: 22px; }
.pd-name { font-family: var(--serif); font-size: 52px; font-weight: 600; line-height: 0.95; margin-bottom: 10px; letter-spacing: 0.5px; overflow-wrap: break-word; }
.pd-name b { color: var(--gold-d); font-weight: 600; }
.pd-sub { font-size: 12px; letter-spacing: 5px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 24px; }
.pd-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.pd-chip { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 7px 14px; border: 1px solid var(--border); color: var(--text-dim); }
.pd-chip.gold { background: var(--gold); color: #000; border-color: var(--gold); font-weight: 700; }
.pd-price { font-family: var(--serif); font-size: 40px; font-weight: 500; color: var(--gold-d); margin-bottom: 12px; letter-spacing: 0.5px; }
.pd-reassure { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; justify-content: flex-start; gap: 10px; margin: 2px 0 30px; padding-top: 18px; border-top: 1px solid rgba(0,0,0,0.07); overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
.pd-reassure::-webkit-scrollbar { display: none; }
.pd-trust { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; }
.pd-stars { font-size: 14px; letter-spacing: 1px; line-height: 1; }
.pd-trust-txt { font-size: 11.5px; font-weight: 600; color: var(--text-dim); letter-spacing: 0.1px; white-space: nowrap; }
.pd-seals { display: inline-flex; flex-wrap: nowrap; gap: 6px; flex-shrink: 0; }
.pd-seal { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.1px; color: var(--gold-d); background: rgba(201,168,76,0.10); border: 1px solid var(--border); padding: 4px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
.pd-stock { display: inline-flex; align-items: center; gap: 7px; margin: -10px 0 26px; font-size: 13px; font-weight: 700; letter-spacing: 0.2px; color: #c0392b; background: rgba(192,57,43,0.08); border: 1px solid rgba(192,57,43,0.22); padding: 9px 16px; border-radius: 10px; }
.pd-curr { font-size: 18px; opacity: 0.5; font-family: var(--sans); font-weight: 300; }
.pd-promo { display: flex; align-items: center; gap: 12px; background: rgba(201,168,76,0.08); border: 1px solid var(--border); padding: 14px 18px; margin-bottom: 26px; }
.pd-promo b { color: var(--gold-d); font-family: var(--serif); font-size: 22px; }
.pd-promo span { font-size: 13px; color: var(--text-dim); letter-spacing: 0.4px; }
.pd-desc { font-size: 14.5px; color: var(--text-dim); line-height: 2; padding: 2px 0 24px; border-bottom: 1px solid rgba(0,0,0,0.08); margin-bottom: 30px; font-weight: 400; }
.pd-aroma { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: -8px 0 30px; }
.pd-aroma-k { font-size: 11px; font-weight: 600; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; }
.pd-aroma-v { display: inline-flex; align-items: center; gap: 6px; font-family: var(--serif); font-size: 17px; font-weight: 600; color: var(--text); background: rgba(201,168,76,0.10); border: 1px solid var(--border); padding: 7px 16px; border-radius: 999px; }
.pd-sec-t { font-size: 11px; font-weight: 600; letter-spacing: 4px; color: var(--gold); text-transform: uppercase; margin-bottom: 16px; }
.sizes-row { display: flex; gap: 8px; margin-bottom: 30px; flex-wrap: wrap; }
.size-btn { padding: 12px 24px; font-size: 13px; font-weight: 400; border: 1px solid rgba(0,0,0,0.1); background: none; color: #777; cursor: pointer; transition: all 0.25s; font-family: var(--sans); letter-spacing: 1px; }
.size-btn.act { border-color: var(--gold); color: var(--gold-d); background: rgba(201,168,76,0.06); }
.size-btn:hover { border-color: #aaa; }
.add-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.qty-ctrl { display: flex; align-items: center; border: 1px solid rgba(0,0,0,0.12); }
.qty-btn { width: 46px; height: 54px; background: none; border: none; color: #666; font-size: 25px; cursor: pointer; transition: color 0.2s; line-height: 1; }
.qty-btn:hover { color: var(--gold); }
.qty-n { width: 46px; text-align: center; font-size: 17px; color: var(--text); font-family: var(--serif); }
.add-btn { flex: 1; min-width: 200px; height: 54px; background: #1a1a18; color: var(--gold-l); border: none; font-size: 12px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; cursor: pointer; transition: all 0.35s; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: var(--sans); }
.add-btn:hover { background: #000; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
.pd-buy { margin-bottom: 26px; }
.feats { display: grid; grid-template-columns: repeat(2,1fr); gap: 1px; background: rgba(0,0,0,0.07); margin-top: 8px; }
.feat { padding: 20px 14px; text-align: center; background: var(--bg); transition: background 0.3s; }
.feat:hover { background: var(--bg2); }
.feat-ic { font-size: 20px; margin-bottom: 9px; }
.feat-lbl { font-size: 10px; color: var(--text-muted); letter-spacing: 2px; text-transform: uppercase; }
.feat-val { font-size: 13px; color: #555; margin-top: 5px; font-weight: 400; line-height: 1.5; }

/* ── COLECCIONES ── */
.coll-sec { padding: 88px 52px; background: var(--bg2); }
.coll-hdr { text-align: center; margin-bottom: 56px; }
.coll-eyebrow { font-size: 12px; font-weight: 500; letter-spacing: 6px; color: var(--gold); text-transform: uppercase; margin-bottom: 14px; }
.coll-title { font-family: var(--serif); font-size: 48px; font-weight: 600; margin-bottom: 10px; }
.coll-title span { color: var(--gold); font-style: italic; }
.coll-sub { font-size: 13px; letter-spacing: 4px; color: var(--text-muted); text-transform: uppercase; }
.coll-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; max-width: 1280px; margin: 0 auto; }
.coll-card { height: 300px; position: relative; overflow: hidden; cursor: pointer; border-radius: 10px; border: 1px solid var(--border); }
.coll-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.75s cubic-bezier(0.25,0.46,0.45,0.94); }
.coll-card:hover .coll-img { transform: scale(1.08); }
.coll-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.05) 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 30px; transition: background 0.45s; }
.coll-card:hover .coll-overlay { background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.15) 100%); }
.coll-cat { font-size: 10px; font-weight: 600; letter-spacing: 4px; color: var(--gold-l); text-transform: uppercase; margin-bottom: 8px; }
.coll-name { font-family: var(--serif); font-size: 34px; font-weight: 600; margin-bottom: 7px; color: #fff; }
.coll-tag { font-size: 13px; color: #cfcfcf; margin-bottom: 18px; font-weight: 300; line-height: 1.5; }
.coll-cta { font-size: 11px; font-weight: 600; letter-spacing: 3px; color: var(--gold-l); text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
.coll-cta::after { content: '→'; }

/* ── FOOTER ── */
.footer { background: var(--bg2); border-top: 1px solid var(--border); }
.footer-trust { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: var(--border); }
.ft-item { text-align: center; padding: 40px 20px; background: var(--bg2); display: flex; flex-direction: column; align-items: center; gap: 8px; transition: background 0.3s; }
.ft-item:hover { background: #e8e8e4; }
.ft-icon { font-size: 28px; margin-bottom: 4px; }
.ft-title { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #333; }
.ft-sub { font-size: 13px; color: var(--text-muted); font-weight: 300; line-height: 1.5; }
.footer-bot { text-align: center; padding: 48px 52px; }
.footer-logo { font-family: var(--serif); font-size: 31px; color: var(--gold); letter-spacing: 10px; margin-bottom: 8px; font-weight: 400; }
.footer-tag { font-size: 12px; color: var(--text-muted); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 22px; }
.footer-wa { display: inline-flex; align-items: center; gap: 9px; color: var(--wa); border: 1px solid rgba(31,168,85,0.35); padding: 11px 24px; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; text-decoration: none; transition: all 0.3s; margin-bottom: 26px; }
.footer-wa:hover { background: rgba(31,168,85,0.08); border-color: var(--wa); }
.footer-divider { width: 40px; height: 1px; background: var(--gold); margin: 0 auto 18px; opacity: 0.3; }
.footer-copy { font-size: 12px; color: var(--text-muted); letter-spacing: 1.5px; line-height: 1.8; }
/* ── MEDIOS DE PAGO ── */
.pay-section { padding: 34px 52px 4px; text-align: center; }
.pay-label { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px; }
/* Acceso discreto al panel de administración (solo la tuerca, el cliente no la nota) */
.admin-gear { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin: 22px auto 0; padding: 0; background: none; border: none; border-radius: 50%; color: var(--text-muted); opacity: 0.28; font-size: 17px; line-height: 1; cursor: pointer; transition: opacity 0.25s, color 0.25s, transform 0.5s ease; }
.admin-gear:hover { opacity: 0.9; color: var(--gold-d); transform: rotate(90deg); }
.admin-gear:active { transform: rotate(90deg) scale(0.92); }
.pay-badges { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
.pay-chip { display: inline-flex; align-items: center; justify-content: center; transition: transform 0.25s; }
.pay-chip:hover { transform: translateY(-2px); }
.pay-img { height: 46px; width: auto; display: block; border-radius: 9px; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
.pay-badges.sm { gap: 8px; margin-top: 12px; }
.pay-badges.sm .pay-img { height: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

/* ── ADMIN ── */
.admin-wrap { max-width: 1100px; margin: 0 auto; padding: 52px; }
.admin-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border); gap: 16px; flex-wrap: wrap; }
.admin-title { font-family: var(--serif); font-size: 38px; font-weight: 600; }
.admin-title span { color: var(--gold); font-style: italic; }
.admin-info { margin-bottom: 24px; padding: 14px 18px; background: rgba(201,168,76,0.04); border: 1px solid var(--border); font-size: 14px; color: var(--text-muted); }
.admin-info b { color: var(--gold-d); }
.atbl { width: 100%; border-collapse: collapse; }
.atbl th { text-align: left; padding: 14px 16px; font-size: 10px; font-weight: 600; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; border-bottom: 1px solid var(--border); }
.atbl td { padding: 14px 16px; font-size: 15px; border-bottom: 1px solid rgba(0,0,0,0.05); vertical-align: middle; }
.atbl tr:hover td { background: rgba(0,0,0,0.03); }
.athumb { width: 46px; height: 56px; object-fit: contain; background: #fff; border: 1px solid var(--border); }
.atn { font-family: var(--serif); font-size: 18px; }
.ats { font-size: 11px; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; }
.atp { color: var(--gold-d); font-weight: 500; font-family: var(--serif); font-size: 17px; }
.atc { font-size: 13px; color: var(--text-muted); }
.abtn { padding: 7px 14px; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; cursor: pointer; text-transform: uppercase; border: 1px solid; transition: all 0.25s; font-family: var(--sans); }
.abtn-e { color: var(--gold-d); border-color: rgba(201,168,76,0.3); background: none; margin-right: 8px; }
.abtn-e:hover { background: rgba(201,168,76,0.08); }
.abtn-d { color: #d64545; border-color: rgba(214,69,69,0.3); background: none; }
.abtn-d:hover { background: rgba(214,69,69,0.08); }
.form-g { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.fg { display: flex; flex-direction: column; gap: 8px; }
.fg.full { grid-column: 1/-1; }
.fl { font-size: 11px; font-weight: 600; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; }
.fi, .fsel, .fta { background: var(--bg3); border: 1px solid rgba(0,0,0,0.1); color: var(--text); padding: 13px 16px; font-size: 15px; outline: none; transition: border-color 0.25s; width: 100%; font-family: var(--sans); font-weight: 300; }
.fi:focus, .fsel:focus, .fta:focus { border-color: rgba(201,168,76,0.5); }
.fta { resize: vertical; min-height: 84px; }
.form-hint { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.fchk { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-dim); cursor: pointer; padding-top: 6px; }
.fchk input { width: 18px; height: 18px; accent-color: var(--gold); }
.img-upload { border: 1px dashed rgba(201,168,76,0.3); padding: 36px; text-align: center; cursor: pointer; transition: all 0.3s; background: var(--bg); position: relative; }
.img-upload:hover { border-color: var(--gold); background: rgba(201,168,76,0.03); }
.img-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.img-upload-icon { font-size: 34px; margin-bottom: 10px; opacity: 0.35; }
.img-upload-text { font-size: 13px; color: var(--text-muted); letter-spacing: 1px; }
.img-preview { position: relative; display: inline-block; }
.img-preview img { max-width: 100%; max-height: 200px; border: 1px solid var(--border); object-fit: contain; background: #fff; }
.img-preview-rm { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: #d64545; color: #fff; border: none; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; }
/* Galería en el panel de admin: varias fotos por producto */
.multi-img { display: flex; flex-wrap: wrap; gap: 12px; }
.multi-img-item { position: relative; width: 96px; height: 96px; border: 1px solid var(--border); border-radius: 9px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: visible; }
.multi-img-item img { width: 100%; height: 100%; object-fit: contain; padding: 6px; border-radius: 9px; }
.multi-img-rm { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%; background: #d64545; color: #fff; border: none; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; z-index: 2; }
.multi-img-cover { position: absolute; left: 4px; bottom: 4px; right: 4px; padding: 3px 0; border: none; border-radius: 6px; background: rgba(10,10,9,0.78); color: var(--gold-l); font-family: var(--sans); font-size: 9.5px; font-weight: 700; letter-spacing: 0.4px; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
.multi-img-item:hover .multi-img-cover { opacity: 1; }
.multi-img-add { position: relative; width: 96px; height: 96px; border: 1px dashed rgba(201,168,76,0.45); border-radius: 9px; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: border-color 0.25s, background 0.25s; }
.multi-img-add:hover { border-color: var(--gold); background: rgba(201,168,76,0.04); }
.multi-img-add input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.multi-img-add-ic { font-size: 24px; color: var(--gold-d); line-height: 1; }
.multi-img-add-tx { font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.4px; }
.multi-img-hint { font-size: 12px; color: var(--text-muted); margin-top: 9px; letter-spacing: 0.2px; line-height: 1.4; }

/* ── CARRITO ── */
.cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 200; backdrop-filter: blur(6px); overscroll-behavior: none; touch-action: none; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.cart-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 400px; background: var(--bg2); border-left: 1px solid var(--border); z-index: 201; display: flex; flex-direction: column; animation: slideIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.cart-hdr { padding: 24px 28px; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; background: var(--bg3); }
.cart-title { font-family: var(--serif); font-size: 28px; font-weight: 400; letter-spacing: 1px; }
.cart-x { background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; line-height: 1; transition: color 0.2s; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
.cart-x:hover { color: var(--text); }
.cart-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 8px 16px; }
.ci { display: flex; gap: 16px; padding: 18px 8px; border-bottom: 1px solid rgba(0,0,0,0.07); }
.ci-img { width: 62px; height: 78px; background: #fff; border: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ci-real-img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
.ci-info { flex: 1; }
.ci-name { font-family: var(--serif); font-size: 18px; margin-bottom: 5px; line-height: 1.1; }
.ci-sz { font-size: 12px; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; }
.ci-price { font-family: var(--serif); font-size: 16px; font-weight: 600; color: var(--gold-d); }
.ci-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
.ci-qty { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; }
.ci-qbtn { width: 28px; height: 28px; background: none; border: none; color: var(--text); font-size: 16px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.18s; }
.ci-qbtn:hover:not(:disabled) { background: var(--gold); color: #1a1208; }
.ci-qbtn:disabled { color: var(--text-muted); opacity: 0.4; cursor: not-allowed; }
.ci-qn { min-width: 30px; text-align: center; font-size: 13px; font-weight: 600; color: var(--text); font-family: var(--sans); }
.ci-rm { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 15px; line-height: 1; transition: color 0.2s; align-self: flex-start; padding: 4px; }
.ci-rm:hover { color: #d64545; }
.cart-foot { padding: 22px 28px; border-top: 1px solid rgba(0,0,0,0.08); background: var(--bg3); }
.cart-tr { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.cart-tl { font-size: 12px; color: var(--text-muted); letter-spacing: 3px; text-transform: uppercase; }
.cart-ta { font-family: var(--serif); font-size: 31px; font-weight: 500; color: var(--gold-d); }
.cart-note { font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 12px; letter-spacing: 0.5px; line-height: 1.6; }
.cart-bd { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.cart-bd-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--text); }
.cart-bd-row span:first-child { color: var(--text-muted); }
.cart-bd-row.disc span { color: #1c7c3e; font-weight: 600; }
.cart-seals { display: flex; gap: 8px; margin: 14px 0 12px; padding-top: 14px; border-top: 1px solid rgba(0,0,0,0.07); }
.cart-seal { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; padding: 11px 6px; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; text-align: center; }
.cart-seal-ic { font-size: 18px; line-height: 1; }
.cart-seal-tx { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.25; color: var(--text-dim); }
.cart-pays { display: flex; justify-content: center; margin-bottom: 14px; }
.cart-pays .pay-badges.sm { margin-top: 0; }
.cart-more { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 100%; margin-top: 14px; padding: 13px 16px; background: linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04)); border: 1.5px solid var(--gold); border-radius: 12px; cursor: pointer; font-family: var(--sans); transition: transform 0.2s, box-shadow 0.2s, background 0.2s; animation: cartMorePulse 2.2s ease-in-out infinite; }
.cart-more-main { font-size: 14px; font-weight: 700; color: var(--gold-d); letter-spacing: 0.3px; }
.cart-more-sub { font-size: 11px; font-weight: 500; color: var(--text-muted); letter-spacing: 0.3px; }
.cart-more:hover { transform: translateY(-2px); background: linear-gradient(135deg, rgba(201,168,76,0.20), rgba(201,168,76,0.08)); box-shadow: 0 10px 26px rgba(201,168,76,0.32); animation: none; }
@keyframes cartMorePulse {
  0% { box-shadow: 0 0 0 0 rgba(201,168,76,0.45); transform: scale(1); }
  70% { box-shadow: 0 0 0 10px rgba(201,168,76,0); transform: scale(1.018); }
  100% { box-shadow: 0 0 0 0 rgba(201,168,76,0); transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) { .cart-more { animation: none; } .pd-hangtag { animation: none; } }
.empty-cart { text-align: center; padding: 80px 24px; color: var(--text-muted); }
.empty-icon { font-size: 48px; margin-bottom: 18px; opacity: 0.25; }

/* ── TOAST ── */
.toast { position: fixed; bottom: 36px; left: 50%; transform: translateX(-50%); background: var(--gold); color: #000; padding: 15px 36px; font-size: 12px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; z-index: 400; white-space: nowrap; animation: toastIn 0.35s cubic-bezier(0.25,0.46,0.45,0.94); box-shadow: 0 8px 48px rgba(201,168,76,0.3); }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

/* ── BOTÓN FLOTANTE WHATSAPP ── */
.wa-float { position: fixed; right: 24px; bottom: 24px; width: 62px; height: 62px; border-radius: 50%; background: var(--wa); color: #fff; display: flex; align-items: center; justify-content: center; z-index: 150; text-decoration: none; box-shadow: 0 8px 26px rgba(0,0,0,0.22); transition: transform 0.25s, background 0.25s; animation: waFade 0.4s ease both, waRing 2.6s ease-out infinite; }
.wa-float svg { width: 33px; height: 33px; }
.wa-float:hover { transform: scale(1.09); background: #17924a; }
@keyframes waFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes waRing {
  0%   { box-shadow: 0 8px 26px rgba(0,0,0,0.22), 0 0 0 0 rgba(31,168,85,0.5); }
  70%  { box-shadow: 0 8px 26px rgba(0,0,0,0.22), 0 0 0 16px rgba(31,168,85,0); }
  100% { box-shadow: 0 8px 26px rgba(0,0,0,0.22), 0 0 0 0 rgba(31,168,85,0); }
}
@media (max-width: 768px) {
  .wa-float { right: 16px; bottom: 16px; width: 56px; height: 56px; }
  .wa-float svg { width: 30px; height: 30px; }
}

/* ── LOGIN ── */
/* ── LOGIN ADMIN ── */
.login-screen { min-height: calc(100vh - 72px); display: flex; align-items: center; justify-content: center; padding: 48px 24px 64px; position: relative; background: radial-gradient(1100px 560px at 50% -8%, rgba(201,168,76,0.16), transparent 58%), linear-gradient(165deg, #1b1812 0%, #0d0c0a 58%, #070605 100%); }
.login-screen::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(201,168,76,0.06) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.5; pointer-events: none; }
.login-card { position: relative; z-index: 1; width: 100%; max-width: 420px; background: linear-gradient(165deg, rgba(31,28,20,0.94), rgba(14,13,10,0.97)); border: 1px solid rgba(201,168,76,0.4); border-radius: 22px; padding: 46px 40px 40px; text-align: center; box-shadow: 0 40px 100px -24px rgba(0,0,0,0.72), 0 0 90px -42px rgba(201,168,76,0.6); }
.login-card::before { content: ''; position: absolute; top: -38%; left: 50%; transform: translateX(-50%); width: 130%; height: 80%; background: radial-gradient(ellipse at center, rgba(201,168,76,0.16), transparent 64%); pointer-events: none; }
.login-logo { position: relative; height: 88px; width: auto; object-fit: contain; margin: 0 auto 16px; display: block; filter: drop-shadow(0 8px 22px rgba(201,168,76,0.4)); }
.login-title { position: relative; font-family: var(--serif); font-size: 38px; font-weight: 600; color: #f5f0e4; margin-bottom: 10px; line-height: 1.1; }
.login-title span { color: var(--gold); font-style: italic; }
.login-sub { position: relative; color: rgba(245,240,228,0.55); font-size: 11px; margin-bottom: 30px; letter-spacing: 3.5px; text-transform: uppercase; }
.login-form { position: relative; display: flex; flex-direction: column; gap: 14px; }
.login-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(201,168,76,0.35); color: #fff; padding: 15px 18px; font-size: 15px; font-family: var(--sans); border-radius: 11px; outline: none; transition: all 0.25s; text-align: center; letter-spacing: 1px; }
.login-input::placeholder { color: rgba(255,255,255,0.4); letter-spacing: normal; }
.login-input:focus { border-color: var(--gold); background: rgba(201,168,76,0.08); box-shadow: 0 0 0 3px rgba(201,168,76,0.13); }
.login-btn { width: 100%; background: linear-gradient(135deg, var(--gold-l), var(--gold)); color: #1a1208; border: none; padding: 16px; font-size: 13px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; font-family: var(--sans); border-radius: 11px; cursor: pointer; transition: all 0.3s; margin-top: 4px; }
.login-btn:hover { box-shadow: 0 12px 34px rgba(201,168,76,0.42); transform: translateY(-2px); filter: brightness(1.06); }

/* ── APP FADE ── */
.app-root { opacity: 0; transition: opacity 0.35s ease; }
.app-root.ready { opacity: 1; }

/* ════════ RESPONSIVE ════════ */
@media (max-width: 1200px) {
  .nav { padding: 0 32px; }
  .hero-carousel { padding: 16px 18px 8px; }
  .featured { padding: 24px 32px 6px; }
  .products-wrap { padding: 48px 32px 72px; }
  .filters { padding: 0 32px; }
  .pd-wrap { padding: 40px 32px 72px; }
  .pd-grid { gap: 48px; }
  .coll-sec { padding: 72px 32px; }
  .footer-bot { padding: 40px 32px; }
  .admin-wrap { padding: 40px 32px; }
}
@media (max-width: 1024px) {
  .pgrid { grid-template-columns: repeat(4,1fr); }
  .pd-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; }
  .pd-name { font-size: 46px; }
  .footer-trust { grid-template-columns: repeat(2,1fr); }
  .sec-title { font-size: 36px; }
  .coll-title { font-size: 40px; }
  .nav-links { gap: 0; }
  .nav-links .nl { padding: 8px 8px; letter-spacing: 1.4px; }
}
@media (max-width: 768px) {
  .nav { padding: 0 18px; position: sticky; top: 0; height: 64px; }
  .login-screen { min-height: calc(100vh - 64px); padding: 32px 18px 48px; }
  .login-card { padding: 40px 26px 32px; border-radius: 18px; }
  .login-title { font-size: 32px; }
  .nav-sep { display: none; }
  .nav-links { display: none; }
  .hamburger { display: flex; }
  .mobile-menu { top: 64px; }
  .ann-i { padding: 0 24px; }
  .announce::before, .announce::after { width: 50px; }

  .hero-carousel { padding: 14px 14px 8px; }
  .hc-arrow { width: 40px; height: 40px; font-size: 22px; }
  .hc-prev { left: 12px; } .hc-next { right: 12px; }
  .hc-dots { bottom: 12px; padding: 6px 12px; }

  .featured { padding: 24px 16px 6px; gap: 22px 18px; }
  .feat-badge { width: 42%; min-width: 120px; }
  .feat-ring { width: 72px; height: 72px; }
  .feat-cap { font-size: 11px; letter-spacing: 1.5px; }

  .filters { padding: 0 14px; gap: 8px; }
  .ftab { padding: 14px 16px; font-size: 11px; }
  .sort-lbl { display: none; }
  .sort-sel { font-size: 12px; padding: 8px 28px 8px 11px; }

  .products-wrap { padding: 32px 16px 56px; }
  .pgrid { grid-template-columns: repeat(2,1fr); }
  .sec-title { font-size: 31px; }
  .pcard-img { height: 220px; }
  .pcard-body { padding: 16px 16px 8px; }
  .pcard-name { font-size: 20px; min-height: 42px; }
  .pcard-price { font-size: 22px; }
  .pcard-foot { padding: 12px 16px; }

  .pd-wrap { padding: 22px 16px 56px; }
  .bc { margin-bottom: 24px; }
  .pd-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .pd-name { font-size: 40px; }
  .pd-price { font-size: 34px; }
  .feats { grid-template-columns: repeat(2,1fr); }
  .add-row { gap: 10px; }
  .add-btn { min-width: 0; }

  .coll-sec { padding: 48px 16px; }
  .coll-grid { grid-template-columns: 1fr; gap: 14px; }
  .coll-card { height: 220px; }
  .coll-title { font-size: 34px; }

  .footer-trust { grid-template-columns: repeat(2,1fr); }
  .ft-item { padding: 28px 16px; }
  .footer-bot { padding: 36px 18px; }
  .pay-section { padding: 28px 18px 2px; }
  .pay-img { height: 40px; }

  .admin-wrap { padding: 20px 14px; }
  .admin-title { font-size: 31px; }
  .atbl { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap; }
  .form-g { grid-template-columns: 1fr; }

  .cart-drawer { width: 100%; }
  .cart-hdr { padding: 18px 18px; }
  .cart-body { padding: 6px 12px; }
  .cart-foot { padding: 16px 18px calc(18px + env(safe-area-inset-bottom, 0px)); }
  .cart-title { font-size: 24px; }
  .cart-ta { font-size: 27px; }
}
@media (max-width: 480px) {
  .pgrid { grid-template-columns: repeat(2,1fr); }
  .pd-name { font-size: 34px; }
  .coll-title { font-size: 28px; }
  .sec-title { font-size: 25px; }
  .hc-arrow { width: 32px; height: 32px; font-size: 18px; }
  .feat-badge { width: 45%; }
  .pcard-img { height: 172px; }
  .pd-hangpin { right: 56px; }
  .pd-hangtag { top: 78px; right: 34px; width: 60px; height: 78px; transform-origin: 50% -66px; padding: 0 6px 12px; }
  .pd-hangtag::before { height: 74px; }
  .pd-hangtag-in { font-size: 9px; }
  .pd-hangtag-in b { font-size: 13px; }
  .pd-gallery { gap: 8px; margin-top: 12px; }
  .pd-thumb { width: 60px; height: 60px; padding: 5px; }
  .pcard-real-img { padding: 16px; }
  .pcard-body { padding: 13px 13px 6px; }
  .pcard-name { font-size: 17px; min-height: 40px; }
  .pcard-sub { margin-bottom: 10px; letter-spacing: 1.5px; }
  .pcard-price { font-size: 19px; }
  .pcard-trust { gap: 5px; margin-top: 9px; }
  .pcard-stars { font-size: 10.5px; letter-spacing: 1px; }
  .pcard-trust-txt { font-size: 9.5px; letter-spacing: 0.2px; }
  .pcard-foot { padding: 11px 13px; }
  .quick-buy { padding: 9px 12px; font-size: 10px; letter-spacing: 1px; }
  .pcard-seal { width: 46px; height: 46px; bottom: 10px; right: 10px; }
  .icon-btn { font-size: 16px; padding: 6px 7px; }
}
@media (max-width: 360px) {
  .l-rey { font-size: 22px; letter-spacing: 4px; }
  .l-da { letter-spacing: 4px; }
  .nav { padding: 0 12px; }
}

/* ── PROGRESO DEL CARRUSEL ── */
.hc-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,0.16); z-index: 3; }
.hc-progress-bar { height: 100%; width: 0; background: var(--gold); }
.hc-progress-bar.run { animation: hcfill 4500ms linear forwards; }
.hc-progress-bar.paused { width: 0; }
@keyframes hcfill { from { width: 0; } to { width: 100%; } }

/* ── BOTONES DE COMPRA ── */
.buy-now-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 56px; background: var(--gold); color: #000; border: none; font-size: 13px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
.buy-now-btn:hover { background: var(--gold-l); box-shadow: 0 12px 34px rgba(201,168,76,0.35); transform: translateY(-2px); }
.co-checkout-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 54px; background: #1a1a18; color: var(--gold-l); border: none; font-size: 13px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
.co-checkout-btn:hover { background: #000; box-shadow: 0 12px 30px rgba(0,0,0,0.28); }

/* ── CHECKOUT ── */
.co-wrap { padding: 48px 52px 96px; background: var(--bg); max-width: 1180px; margin: 0 auto; }
.co-grid { display: grid; grid-template-columns: 1.45fr 1fr; gap: 56px; align-items: start; }
.co-main { min-width: 0; }
.co-title { font-family: var(--serif); font-size: 44px; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 8px; }
.co-title span { color: var(--gold); font-style: italic; }
.co-lead { font-size: 14px; color: var(--text-dim); letter-spacing: 0.3px; margin-bottom: 32px; line-height: 1.6; }
.co-sec-t { font-size: 12px; font-weight: 600; letter-spacing: 4px; color: var(--gold); text-transform: uppercase; margin-bottom: 16px; }
.co-form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.co-form .fg.full { grid-column: 1/-1; }

.pay-methods { display: flex; flex-direction: column; gap: 12px; }
.pay-card { position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px; text-align: left; background: var(--bg2); border: 1px solid rgba(0,0,0,0.1); padding: 18px 20px; cursor: pointer; transition: all 0.25s; font-family: var(--sans); }
.pay-card:hover { border-color: var(--border-h); background: #f6f6f2; }
.pay-card.act { border-color: var(--gold); background: rgba(201,168,76,0.06); box-shadow: inset 0 0 0 1px var(--gold); }
.pay-card-logo { height: 32px; width: auto; display: block; border-radius: 6px; }
.pay-desc { font-size: 13px; color: var(--text-dim); letter-spacing: 0.3px; }
.pay-badge { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-muted); border: 1px solid var(--border); padding: 5px 10px; border-radius: 3px; white-space: nowrap; }
.pay-check { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%; background: var(--gold); color: #000; font-size: 13px; font-weight: 700; display: none; align-items: center; justify-content: center; }
.pay-card.act .pay-check { display: flex; }
.pay-card.act .pay-badge { visibility: hidden; }

.co-summary { background: var(--bg2); border: 1px solid var(--border); padding: 28px 26px; position: sticky; top: 92px; }
.co-sum-t { font-family: var(--serif); font-size: 28px; font-weight: 400; margin-bottom: 18px; letter-spacing: 0.5px; }
.co-items { display: flex; flex-direction: column; margin-bottom: 6px; max-height: 340px; overflow-y: auto; }
.co-item { display: flex; gap: 14px; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
.co-item-img { width: 50px; height: 62px; flex-shrink: 0; background: #fff; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.co-item-img img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
.co-item-info { flex: 1; min-width: 0; }
.co-item-name { font-family: var(--serif); font-size: 18px; line-height: 1.15; }
.co-item-sub { font-size: 12px; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-top: 5px; }
.co-item-price { font-family: var(--serif); font-size: 16px; font-weight: 500; color: var(--gold-d); white-space: nowrap; }
.co-total-row { display: flex; justify-content: space-between; align-items: baseline; padding: 18px 0; border-top: 1px solid rgba(0,0,0,0.1); margin: 8px 0 16px; }
.co-total-row > span:first-child { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-muted); }
.co-total { font-family: var(--serif); font-size: 34px; font-weight: 500; color: var(--gold-d); }
.co-pay-btn { width: 100%; min-height: 58px; padding: 17px 18px; background: var(--gold); color: #000; border: none; font-size: 13px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; cursor: pointer; transition: all 0.3s; line-height: 1.4; }
.co-pay-btn:hover { background: var(--gold-l); box-shadow: 0 12px 34px rgba(201,168,76,0.35); transform: translateY(-2px); }
.co-pay-btn:disabled { opacity: 0.55; cursor: default; transform: none; box-shadow: none; }
.co-secure { font-size: 12px; color: var(--text-muted); text-align: center; letter-spacing: 1px; margin-top: 16px; }
.co-help { display: block; text-align: center; margin-top: 14px; font-size: 12px; letter-spacing: 1.5px; color: var(--text-muted); text-decoration: none; text-transform: uppercase; transition: color 0.2s; }
.co-help:hover { color: var(--gold); }
.co-empty { text-align: center; padding: 110px 24px; color: var(--text-muted); }

/* ── ADDI (widget de cuotas) ── */
.addi-box { width: 100%; }
.pd-addi { margin: 0 0 26px; }
.co-addi { margin-top: 4px; }
.co-addi-lead { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin-bottom: 14px; }
.co-addi-w { margin-bottom: 12px; }
.co-addi-note { font-size: 11.5px; color: var(--text-muted); letter-spacing: 0.3px; text-align: center; }

/* ── RESULTADO DE PAGO ── */
.pay-result-wrap { padding: 70px 24px 110px; background: var(--bg); display: flex; justify-content: center; }
.pay-result { max-width: 520px; width: 100%; text-align: center; background: var(--bg2); border: 1px solid var(--border); padding: 48px 36px; }
.pay-result.ok { border-top: 3px solid #2e9e5b; }
.pay-result.pend { border-top: 3px solid var(--gold); }
.pay-result.bad { border-top: 3px solid #c0392b; }
.pr-ic { font-size: 56px; line-height: 1; margin-bottom: 18px; }
.pr-title { font-family: var(--serif); font-size: 32px; font-weight: 600; margin-bottom: 12px; letter-spacing: 0.4px; }
.pr-desc { font-size: 14.5px; color: var(--text-dim); line-height: 1.7; margin-bottom: 26px; }
.pr-data { text-align: left; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 6px 0; margin-bottom: 28px; }
.pr-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 2px; font-size: 13px; }
.pr-row span { color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; font-size: 11px; }
.pr-row b { color: var(--text); font-weight: 600; }
.pr-tx { font-size: 11px; word-break: break-all; text-align: right; max-width: 60%; }
.pr-actions { display: flex; flex-direction: column; gap: 12px; }

@media (max-width: 1200px) {
  .co-wrap { padding: 40px 32px 80px; }
}
@media (max-width: 1024px) {
  .co-grid { grid-template-columns: 1fr; gap: 36px; }
  .co-summary { position: static; }
  .co-title { font-size: 40px; }
}
@media (max-width: 768px) {
  .co-wrap { padding: 24px 16px 64px; }
  .co-title { font-size: 34px; }
  .co-form { grid-template-columns: 1fr; }
  .pay-card { padding: 15px 14px; gap: 12px; grid-template-columns: auto 1fr; }
  .pay-badge { display: none; }
  .co-summary { padding: 22px 18px; }
}

/* ── BÚSQUEDA SUPERPUESTA (overlay "Buscar nuestro sitio") ── */
.search-overlay { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; align-items: stretch; }
.search-backdrop { position: absolute; inset: 0; background: rgba(8,8,7,0.5); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); animation: srFade 0.2s ease; }
@keyframes srFade { from { opacity: 0; } to { opacity: 1; } }
.search-panel { position: relative; z-index: 1; width: 100%; background: #0a0a09; box-shadow: 0 22px 60px rgba(0,0,0,0.5); padding: 20px 28px 26px; animation: srSlide 0.3s cubic-bezier(.22,.61,.36,1); border-bottom: 1px solid rgba(201,168,76,0.42); }
@keyframes srSlide { from { transform: translateY(-101%); } to { transform: translateY(0); } }
.search-panel-inner { max-width: 1040px; margin: 0 auto; }
.search-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.search-panel-title { font-family: var(--sans); font-size: 19px; font-weight: 800; color: var(--gold); letter-spacing: 0.1px; }
.search-panel-x { background: none; border: none; color: var(--gold); font-size: 24px; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: background 0.2s; flex-shrink: 0; }
.search-panel-x:hover { background: rgba(201,168,76,0.14); }
.search-field { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid var(--gold); padding: 8px 2px 12px; }
.search-input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--gold-l); font-family: var(--sans); font-size: 17px; font-weight: 500; padding: 4px 0; letter-spacing: 0.2px; }
.search-input::placeholder { color: var(--gold); opacity: 0.75; font-weight: 400; }
.search-clear { background: none; border: none; color: #b9b9b2; font-size: 16px; cursor: pointer; flex-shrink: 0; padding: 2px 6px; line-height: 1; transition: color 0.2s; }
.search-clear:hover { color: var(--gold-l); }
.search-ic { flex-shrink: 0; line-height: 1; display: inline-flex; align-items: center; color: var(--gold); }
.search-ic svg { width: 22px; height: 22px; display: block; }
@media (max-width: 768px) { .search-panel { padding: 16px 16px 20px; } .search-panel-title { font-size: 17px; } .search-input { font-size: 16px; } }

/* ── SUSCRIPCIÓN (franja al final de la página, sin popup) ── */
.subscribe { position: relative; overflow: hidden; background: linear-gradient(165deg, #17150f 0%, #0c0b09 100%); border-top: 1px solid rgba(201,168,76,0.42); padding: 66px 52px; }
.subscribe::before { content: ''; position: absolute; top: -55%; left: 50%; transform: translateX(-50%); width: 90%; height: 120%; background: radial-gradient(ellipse at center, rgba(201,168,76,0.16), transparent 62%); pointer-events: none; }
.sub-inner { position: relative; max-width: 600px; margin: 0 auto; text-align: center; }
.sub-crown { display: flex; justify-content: center; margin-bottom: 18px; }
.sub-logo { height: 76px; width: auto; display: block; filter: drop-shadow(0 6px 20px rgba(201,168,76,0.4)); }
.sub-eyebrow { font-family: var(--sans); font-size: 11px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; }
.sub-title { font-family: var(--serif); font-size: 38px; font-weight: 600; color: #f5f0e4; line-height: 1.12; margin-bottom: 14px; }
.sub-title span { color: var(--gold); font-style: italic; }
.sub-text { font-size: 14px; line-height: 1.7; color: rgba(245,240,228,0.74); margin: 0 auto 24px; max-width: 460px; }
.sub-form { display: flex; gap: 12px; max-width: 480px; margin: 0 auto; }
.sub-input { flex: 1; min-width: 0; background: rgba(255,255,255,0.05); border: 1px solid rgba(201,168,76,0.35); color: #fff; padding: 15px 18px; font-size: 15px; font-family: var(--sans); border-radius: 11px; outline: none; transition: all 0.25s; }
.sub-input::placeholder { color: rgba(255,255,255,0.4); }
.sub-input:focus { border-color: var(--gold); background: rgba(201,168,76,0.08); box-shadow: 0 0 0 3px rgba(201,168,76,0.13); }
.sub-btn { background: linear-gradient(135deg, var(--gold-l), var(--gold)); color: #1a1208; border: none; padding: 0 26px; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; font-family: var(--sans); border-radius: 11px; cursor: pointer; transition: all 0.3s; white-space: nowrap; }
.sub-btn:hover { box-shadow: 0 12px 34px rgba(201,168,76,0.42); transform: translateY(-2px); filter: brightness(1.06); }
.sub-mini { position: relative; font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.4px; margin-top: 14px; }
.sub-success { position: relative; padding: 8px 0; }
.sub-check { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--gold-l), var(--gold)); color: #1a1208; font-size: 32px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; box-shadow: 0 0 40px rgba(201,168,76,0.5); }
@media (max-width: 768px) { .subscribe { padding: 48px 16px; } .sub-title { font-size: 30px; } .sub-form { flex-direction: column; } .sub-btn { padding: 15px; } .sub-logo { height: 62px; } }

/* ── FILTRO POR FAMILIA OLFATIVA (TIPO DE AROMA) ── */
.fam-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 0; padding: 24px 52px 8px; border-bottom: none; }
.fam-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--text-muted); margin-right: 4px; font-weight: 600; }
.fam-tab { display: inline-flex; align-items: center; gap: 6px; background: var(--bg2); border: 1px solid var(--border); color: var(--text); font-family: var(--sans); font-size: 12px; font-weight: 600; letter-spacing: 0.4px; padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.fam-tab:hover { border-color: var(--gold); color: var(--gold-d); transform: translateY(-1px); }
.fam-tab.act { background: linear-gradient(135deg, var(--gold-l), var(--gold)); border-color: var(--gold); color: #1a1208; box-shadow: 0 4px 14px rgba(201,168,76,0.3); }
.fam-emoji { font-size: 14px; line-height: 1; }

/* ── BANDA TIPO DE AROMA (debajo del carrusel) ── */
.aroma-bar { background: var(--bg2); border-top: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.06); padding: 30px 52px 34px; text-align: center; }
.aroma-bar-title { font-family: var(--serif); font-size: 21px; font-weight: 600; color: var(--text); letter-spacing: 0.3px; margin-bottom: 18px; }
.aroma-bar-title span { color: var(--gold); font-style: italic; }
.aroma-bar-pills { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 1000px; margin: 0 auto; }
.aroma-bar-pills .fam-tab { background: var(--bg); }
.aroma-bar-pills .fam-tab.act { background: linear-gradient(135deg, var(--gold-l), var(--gold)); }
@media (max-width: 768px) { .aroma-bar { padding: 24px 16px 26px; } .aroma-bar-title { font-size: 18px; margin-bottom: 14px; } .aroma-bar-pills { gap: 8px; } }

/* ── ETIQUETA DE AROMA EN TARJETA Y DETALLE ── */
.pcard-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; font-weight: 700; color: var(--gold-d); background: rgba(201,168,76,0.12); border: 1px solid var(--border); padding: 4px 9px; border-radius: 999px; margin-bottom: 12px; }
.pd-chip.tag { background: rgba(201,168,76,0.14); border-color: var(--gold); color: var(--gold-d); font-weight: 700; }

/* ── RESULTADOS EN VIVO DE LA BÚSQUEDA (LUPA) ── */
.search-results { margin: 16px 0 2px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; overflow: hidden; box-shadow: 0 14px 36px rgba(0,0,0,0.12); max-height: 56vh; overflow-y: auto; animation: srFade 0.2s ease; }
.sr-item { width: 100%; display: flex; align-items: center; gap: 14px; background: none; border: none; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 12px 16px; cursor: pointer; text-align: left; transition: background 0.15s; }
.sr-item:last-of-type { border-bottom: none; }
.sr-item:hover { background: rgba(201,168,76,0.09); }
.sr-img { width: 48px; height: 48px; flex-shrink: 0; border-radius: 7px; overflow: hidden; background: #f4f4f0; border: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; }
.sr-img img { width: 100%; height: 100%; object-fit: cover; }
.sr-noimg { font-size: 20px; opacity: 0.5; }
.sr-info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.sr-name { color: #161616; font-size: 14.5px; font-weight: 700; letter-spacing: 0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr-sub { color: #8a8a86; font-size: 11.5px; letter-spacing: 0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr-price { color: var(--gold-d); font-size: 14px; font-weight: 800; white-space: nowrap; flex-shrink: 0; }
.sr-all { width: 100%; background: rgba(201,168,76,0.12); border: none; border-top: 1px solid rgba(201,168,76,0.28); color: var(--gold-d); font-family: var(--sans); font-size: 12.5px; font-weight: 700; letter-spacing: 0.5px; padding: 14px; cursor: pointer; transition: background 0.15s; }
.sr-all:hover { background: rgba(201,168,76,0.2); }
.sr-empty { color: #8a8a86; font-size: 13.5px; padding: 24px 18px; text-align: center; line-height: 1.5; }

/* ── ENVÍO: NOTA EN CHECKOUT + HINT EN CARRITO ── */
.co-ship-note { font-size: 12px; color: var(--text-muted); margin-top: 8px; line-height: 1.5; }
.co-ship-note b { color: #1c7c3e; }
.cart-ship { font-size: 12.5px; color: var(--text-muted); background: var(--bg2); border: 1px dashed var(--border); border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; line-height: 1.5; text-align: center; }
.cart-ship b { color: var(--gold-d); }
.cart-ship.free { color: #1c7c3e; border-color: rgba(28,124,62,0.4); background: rgba(28,124,62,0.07); }
.cart-ship.free b { color: #1c7c3e; }

/* ── CUPÓN EN CHECKOUT ── */
.co-coupon { margin: 4px 0 14px; }
.co-coupon-row { display: flex; gap: 8px; }
.co-coupon-input { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--border); border-radius: 5px; padding: 11px 13px; font-family: var(--sans); font-size: 13px; letter-spacing: 0.5px; color: var(--text); text-transform: uppercase; outline: none; transition: border-color 0.2s; }
.co-coupon-input:focus { border-color: var(--gold); }
.co-coupon-input::placeholder { text-transform: none; color: var(--text-muted); letter-spacing: 0; }
.co-coupon-btn { background: var(--text); color: #fff; border: none; border-radius: 5px; padding: 0 18px; font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: opacity 0.2s; white-space: nowrap; }
.co-coupon-btn:hover { opacity: 0.85; }
.co-coupon-on { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(28,124,62,0.07); border: 1px solid rgba(28,124,62,0.35); border-radius: 6px; padding: 10px 14px; }
.co-coupon-on-info { display: flex; flex-direction: column; gap: 2px; }
.co-coupon-tag { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #1c7c3e; }
.co-coupon-desc { font-size: 11.5px; color: var(--text-muted); }
.co-coupon-rm { background: none; border: none; color: #c0392b; font-size: 12px; font-weight: 600; cursor: pointer; letter-spacing: 0.3px; }
.co-coupon-rm:hover { text-decoration: underline; }

/* ── DESGLOSE DE PRECIO EN CHECKOUT ── */
.co-breakdown { border-top: 1px solid rgba(0,0,0,0.08); padding-top: 14px; display: flex; flex-direction: column; gap: 9px; }
.co-brow { display: flex; justify-content: space-between; align-items: baseline; font-size: 13.5px; color: var(--text); }
.co-brow span:first-child { color: var(--text-muted); }
.co-brow.disc span { color: #1c7c3e; font-weight: 600; }
.co-free { color: #1c7c3e; font-weight: 700; letter-spacing: 0.5px; }
.co-ship-hint { font-size: 11.5px; color: var(--gold-d); background: rgba(201,168,76,0.1); border-radius: 5px; padding: 8px 11px; margin-top: 2px; line-height: 1.4; }

/* ── PANEL ADMIN: CREAR CUPONES ── */
.coupon-create { display: grid; grid-template-columns: 1.4fr 1fr 1fr auto; gap: 14px; align-items: end; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 22px; margin-bottom: 28px; }
.coupon-add-btn { background: linear-gradient(135deg, var(--gold-l), var(--gold)); color: #1a1208; border: none; border-radius: 7px; padding: 13px 22px; font-family: var(--sans); font-size: 13px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; transition: all 0.2s; white-space: nowrap; height: fit-content; }
.coupon-add-btn:hover { box-shadow: 0 8px 22px rgba(201,168,76,0.35); transform: translateY(-1px); }
.coupon-state { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 4px 11px; border-radius: 999px; background: rgba(150,150,150,0.16); color: #888; }
.coupon-state.on { background: rgba(28,124,62,0.14); color: #1c7c3e; }

/* ── Gestión de colecciones y tipos de aroma ── */
.tax-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.tax-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }
.tax-card-t { font-family: var(--serif); font-size: 22px; font-weight: 600; margin-bottom: 4px; }
.tax-card-t span { color: var(--gold); font-style: italic; }
.tax-card-sub { font-size: 12.5px; color: var(--text-muted); margin-bottom: 18px; }
.tax-add { display: flex; gap: 10px; margin-bottom: 18px; }
.tax-add .fi { flex: 1; }
.tax-list { display: flex; flex-direction: column; gap: 8px; }
.tax-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; }
.tax-item-name { font-size: 14px; font-weight: 600; color: var(--text); letter-spacing: 0.2px; }
.tax-rm { background: none; border: none; color: #b4453c; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.2s; }
.tax-rm:hover { background: rgba(180,69,60,0.1); }
.tax-empty { text-align: center; padding: 26px; color: #aaa; font-size: 13px; }
@media (max-width: 768px) { .tax-grid { grid-template-columns: 1fr; gap: 16px; } .tax-card { padding: 18px; } }

/* ── PANEL ADMIN: VENTAS EN TIEMPO REAL ── */
.vt-token { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; margin-bottom: 22px; }
.vt-token .fg { flex: 1; min-width: 230px; margin: 0; }
.vt-livebar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
.vt-live { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); }
.vt-dot { width: 9px; height: 9px; border-radius: 50%; background: #1fa855; animation: vtpulse 1.7s infinite; }
@keyframes vtpulse { 0%{ box-shadow: 0 0 0 0 rgba(31,168,85,0.5); } 70%{ box-shadow: 0 0 0 8px rgba(31,168,85,0); } 100%{ box-shadow: 0 0 0 0 rgba(31,168,85,0); } }
.vt-refresh { background: none; border: 1px solid var(--border); color: var(--gold-d); font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 9px 16px; border-radius: 7px; cursor: pointer; transition: all 0.2s; }
.vt-refresh:hover { background: rgba(201,168,76,0.08); border-color: var(--gold); }
.vt-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 26px; }
.vt-kpi { background: linear-gradient(165deg, var(--bg2), var(--bg)); border: 1px solid var(--border); border-radius: 14px; padding: 22px 24px; }
.vt-kpi.hot { border-color: var(--border-h); box-shadow: 0 10px 30px -16px rgba(201,168,76,0.5); }
.vt-kpi-l { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; }
.vt-kpi-v { font-family: var(--serif); font-size: 32px; font-weight: 700; color: var(--text); margin-top: 8px; line-height: 1.05; }
.vt-kpi-v span { color: var(--gold-d); }
.vt-kpi-s { font-size: 12.5px; color: var(--text-muted); margin-top: 6px; }
.vt-bars { display: flex; align-items: flex-end; gap: 8px; height: 168px; padding: 18px 8px 12px; background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 28px; }
.vt-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; height: 100%; justify-content: flex-end; }
.vt-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.vt-bar { width: 64%; max-width: 48px; background: linear-gradient(180deg, var(--gold-l), var(--gold)); border-radius: 7px 7px 0 0; min-height: 4px; transition: height 0.5s cubic-bezier(.22,.61,.36,1); }
.vt-bar.today { background: linear-gradient(180deg, var(--gold), var(--gold-d)); box-shadow: 0 0 16px rgba(201,168,76,0.45); }
.vt-bar-day { font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.3px; text-align: center; line-height: 1.3; }
.vt-bar-val { font-size: 10.5px; color: var(--gold-d); font-weight: 800; }
.vt-sec-t { font-family: var(--serif); font-size: 23px; font-weight: 600; margin: 6px 0 14px; }
.vt-sec-t span { color: var(--gold); font-style: italic; }
.vt-day-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--bg2); border: 1px solid var(--border); border-radius: 9px; margin-bottom: 8px; }
.vt-day-d { font-size: 14px; font-weight: 600; color: var(--text); }
.vt-day-c { font-size: 12px; color: var(--text-muted); }
.vt-day-t { font-family: var(--serif); font-size: 18px; font-weight: 700; color: var(--gold-d); }
.vt-id { display: inline-block; font-size: 11px; font-weight: 800; color: var(--gold-d); background: rgba(201,168,76,0.13); padding: 3px 9px; border-radius: 999px; letter-spacing: 0.3px; }
.vt-ref { font-size: 11px; color: var(--text-muted); letter-spacing: 0.5px; margin-top: 4px; }
.vt-items { font-size: 12px; color: var(--text-dim); margin-top: 3px; line-height: 1.45; }
.vt-cust-n { font-size: 14.5px; font-weight: 600; color: var(--text); }
.vt-cust-s { font-size: 12px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
.vt-pay { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: capitalize; color: var(--text-dim); background: var(--surface); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); white-space: nowrap; }
.vt-tot { font-family: var(--serif); font-size: 18px; font-weight: 700; color: var(--text); white-space: nowrap; }
.vt-when { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.vt-empty { text-align: center; padding: 64px 20px; color: #999; }
.vt-empty .emoji { font-size: 46px; opacity: 0.35; margin-bottom: 12px; }
.vt-err { background: rgba(214,69,69,0.07); border: 1px solid rgba(214,69,69,0.32); color: #b4453c; border-radius: 11px; padding: 15px 18px; font-size: 13.5px; margin-bottom: 20px; line-height: 1.55; }
.vt-err b { color: #9a342c; }
@media (max-width: 768px) {
  .vt-kpis { grid-template-columns: 1fr; }
  .vt-bars { gap: 5px; height: 150px; }
  .vt-bar-val { display: none; }
  .atbl.vt-tbl, .atbl.vt-tbl thead { display: none; }
}

@media (max-width: 768px) {
  .fam-filters { gap: 6px; padding: 18px 16px 6px; }
  .fam-tab { font-size: 11px; padding: 7px 11px; }
  .search-results { margin-top: 8px; }
  .sr-item { padding: 11px 13px; gap: 11px; }
  .sr-img { width: 40px; height: 40px; }
  .coupon-create { grid-template-columns: 1fr; gap: 12px; padding: 18px; }
  .coupon-add-btn { width: 100%; }
}

/* ── PÁGINA DE CATEGORÍA (pestañas independientes) ── */
.catpage { background: var(--bg); }
.catpage-hero { position: relative; min-height: 340px; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; border-bottom: 1px solid var(--border); }
.catpage-hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; transform: scale(1.06); }
.catpage-hero-ov { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,9,0.80) 0%, rgba(10,10,9,0.60) 45%, rgba(10,10,9,0.88) 100%); }
.catpage-hero-in { position: relative; z-index: 2; padding: 70px 24px 60px; max-width: 760px; animation: catFade 0.6s ease; }
@keyframes catFade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
.catpage-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 5px; text-transform: uppercase; color: var(--gold-l); margin-bottom: 16px; }
.catpage-title { font-family: var(--serif); font-size: 58px; font-weight: 600; color: #fff; line-height: 1.05; letter-spacing: 0.5px; }
.catpage-title span { color: var(--gold); font-style: italic; }
.catpage-desc { font-size: 16px; color: rgba(255,255,255,0.82); line-height: 1.6; margin: 18px auto 0; max-width: 560px; }
.catpage-count { display: inline-block; margin-top: 26px; font-size: 12px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--gold-l); border: 1px solid rgba(201,168,76,0.45); border-radius: 999px; padding: 8px 18px; }
.catpage-bc { position: absolute; top: 22px; left: 0; right: 0; z-index: 3; display: flex; gap: 8px; align-items: center; justify-content: center; font-size: 11.5px; color: rgba(255,255,255,0.7); letter-spacing: 1.5px; text-transform: uppercase; }
.catpage-bc .bc-lnk { cursor: pointer; transition: color 0.2s; }
.catpage-bc .bc-lnk:hover { color: var(--gold-l); }
.catpage-bc .cur { color: var(--gold); }

/* Barra de pestañas */
.cat-tabs { display: flex; gap: 10px; align-items: center; overflow-x: auto; scrollbar-width: none; padding: 18px 52px; background: rgba(12,12,11,0.97); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); position: sticky; top: 72px; z-index: 60; }
.cat-tabs::-webkit-scrollbar { display: none; }
.cat-tab { display: inline-flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.06); border: 1px solid rgba(201,168,76,0.32); color: #e9e9e4; font-family: var(--sans); font-size: 12.5px; font-weight: 600; letter-spacing: 0.6px; padding: 10px 18px; border-radius: 999px; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
.cat-tab:hover { border-color: var(--gold); color: #fff; transform: translateY(-1px); }
.cat-tab.act { background: linear-gradient(135deg, var(--gold-l), var(--gold)); border-color: var(--gold); color: #1a1208; box-shadow: 0 4px 16px rgba(201,168,76,0.32); }
.cat-tab-home { background: none; border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.7); }
.cat-tab-home:hover { border-color: rgba(255,255,255,0.5); color: #fff; }

/* Barra de herramientas (volver + ordenar) */
.catpage-toolbar { display: flex; align-items: center; justify-content: flex-start; gap: 20px; flex-wrap: wrap; background: var(--bg2); padding: 8px 52px 22px; border-bottom: 1px solid rgba(0,0,0,0.07); }
.catpage-back { display: inline-flex; align-items: center; gap: 8px; background: none; border: 1px solid var(--border); color: var(--text-dim); font-family: var(--sans); font-size: 12.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 11px 20px; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
.catpage-back:hover { border-color: var(--gold); color: var(--gold-d); transform: translateX(-2px); }

@media (max-width: 768px) {
  .catpage-hero { min-height: 268px; }
  .catpage-title { font-size: 42px; }
  .catpage-desc { font-size: 14px; }
  .cat-tabs { padding: 14px 16px; gap: 8px; top: 64px; }
  .cat-tab { font-size: 11.5px; padding: 9px 14px; }
  .catpage-toolbar { padding: 6px 16px 18px; gap: 12px; }
}
@media (max-width: 480px) {
  .catpage-title { font-size: 33px; }
  .catpage-hero { min-height: 230px; }
  .catpage-eyebrow { letter-spacing: 3.5px; }
}

/* ── PÁGINA PROPIA DE RESULTADOS DE BÚSQUEDA ── */
.srch { background: var(--bg); min-height: 62vh; }
.srch-hero { position: relative; background: linear-gradient(180deg, #0c0c0b 0%, #16140e 100%); border-bottom: 1px solid var(--border-h); padding: 32px 52px 36px; overflow: hidden; animation: catFade 0.5s ease; }
.srch-hero::after { content: ""; position: absolute; right: -70px; top: -70px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(201,168,76,0.18), transparent 70%); pointer-events: none; }
.srch-hero-in { position: relative; z-index: 2; max-width: 1040px; margin: 0 auto; }
.srch-bc { display: flex; gap: 9px; align-items: center; font-size: 11.5px; color: rgba(255,255,255,0.6); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 18px; }
.srch-bc .bc-lnk { cursor: pointer; transition: color 0.2s; background: none; border: none; color: inherit; font-family: var(--sans); font-size: inherit; letter-spacing: inherit; text-transform: inherit; padding: 0; }
.srch-bc .bc-lnk:hover { color: var(--gold-l); }
.srch-bc .cur { color: var(--gold); }
.srch-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: var(--gold-l); margin-bottom: 12px; }
.srch-title { font-family: var(--serif); font-size: 40px; font-weight: 600; color: #fff; line-height: 1.1; letter-spacing: 0.3px; }
.srch-title span { color: var(--gold); font-style: italic; }
.srch-count { display: inline-block; margin-top: 16px; font-size: 11.5px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--gold-l); border: 1px solid rgba(201,168,76,0.45); border-radius: 999px; padding: 7px 16px; }
.srch-refine { display: flex; align-items: center; gap: 10px; margin-top: 22px; max-width: 520px; background: rgba(255,255,255,0.06); border: 1px solid rgba(201,168,76,0.4); border-radius: 999px; padding: 11px 18px; transition: border-color 0.2s, background 0.2s; }
.srch-refine:focus-within { border-color: var(--gold); background: rgba(255,255,255,0.1); }
.srch-refine svg { width: 19px; height: 19px; color: var(--gold); flex-shrink: 0; }
.srch-refine input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #fff; font-family: var(--sans); font-size: 15px; }
.srch-refine input::placeholder { color: rgba(255,255,255,0.5); }
.srch-refine-x { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 15px; cursor: pointer; flex-shrink: 0; padding: 2px 4px; line-height: 1; transition: color 0.2s; }
.srch-refine-x:hover { color: var(--gold-l); }
.srch-empty { text-align: center; padding: 72px 24px 84px; max-width: 560px; margin: 0 auto; }
.srch-empty-ic { font-size: 52px; margin-bottom: 18px; }
.srch-empty h3 { font-family: var(--serif); font-size: 27px; font-weight: 600; color: var(--text); margin-bottom: 10px; }
.srch-empty h3 span { color: var(--gold-d); font-style: italic; }
.srch-empty p { font-size: 15px; color: var(--text-dim); line-height: 1.6; margin-bottom: 28px; }
.srch-sugg-lbl { font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 14px; }
.srch-sugg { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.srch-sugg button { background: var(--bg2); border: 1px solid var(--border); color: var(--text-dim); font-family: var(--sans); font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
.srch-sugg button:hover { border-color: var(--gold); color: var(--gold-d); transform: translateY(-1px); }
@media (max-width: 768px) {
  .srch-hero { padding: 22px 16px 26px; }
  .srch-title { font-size: 28px; }
  .srch-refine { max-width: 100%; }
  .srch-count { margin-top: 13px; }
  .srch-empty h3 { font-size: 23px; }
}

/* ── BOTÓN DE FILTROS EN EL INICIO (a la derecha, sobre las filas de productos) ── */
.home-filter-bar { display: flex; justify-content: flex-end; padding: 18px 52px 0; }
.home-filter-btn { position: relative; display: inline-flex; align-items: center; gap: 9px; background: #0b0b0a; border: 1px solid var(--border-h); color: var(--gold-l); font-family: var(--sans); font-size: 13.5px; font-weight: 700; letter-spacing: 0.6px; padding: 11px 22px; border-radius: 999px; cursor: pointer; transition: all 0.2s; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
.home-filter-btn:hover { border-color: var(--gold); color: #fff; transform: translateY(-1px); box-shadow: 0 10px 24px rgba(201,168,76,0.22); }
.home-filter-btn svg { display: block; }
.home-filter-badge { min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: linear-gradient(135deg, var(--gold), var(--gold-l)); color: #1a1407; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
@media (max-width: 768px) { .home-filter-bar { padding: 14px 16px 0; } }
/* Botón Filtros junto al título de la sección (categoría / aroma) */
.sec-hdr .home-filter-btn, .sec-tools .home-filter-btn { align-self: center; flex-shrink: 0; }
/* Botón Filtros en los resultados de búsqueda (hero oscuro → variante dorada) */
.srch-filter { margin-top: 20px; }
.srch-filter-btn { display: inline-flex; align-items: center; gap: 9px; background: linear-gradient(135deg, var(--gold), var(--gold-l)); color: #1a1407; border: none; font-family: var(--sans); font-size: 13px; font-weight: 800; letter-spacing: 0.5px; padding: 11px 22px; border-radius: 999px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 6px 18px rgba(201,168,76,0.28); }
.srch-filter-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(201,168,76,0.42); }
.srch-filter-btn svg { display: block; }
.srch-filter-badge { min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: #1a1407; color: var(--gold-l); font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }

/* ── PANEL DE FILTROS (cajón lateral, dorado y negro) ── */
.filt-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 200; backdrop-filter: blur(6px); overscroll-behavior: none; touch-action: none; animation: fadeIn 0.3s ease; }
.filt-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: 380px; max-width: 88vw; background: #0b0b0a; color: #f4f1e6; border-right: 1px solid var(--border-h); z-index: 201; display: flex; flex-direction: column; animation: slideInLeft 0.38s cubic-bezier(0.25,0.46,0.45,0.94); }
@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
.filt-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px 16px; border-bottom: 1px solid rgba(201,168,76,0.28); flex-shrink: 0; }
.filt-head-l { display: flex; align-items: center; gap: 10px; }
.filt-title { font-family: var(--serif); font-size: 23px; font-weight: 600; color: #fff; }
.filt-title span { color: var(--gold); font-style: italic; }
.filt-clear { background: none; border: none; color: var(--gold-l); font-family: var(--sans); font-size: 12px; font-weight: 600; letter-spacing: 0.5px; cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: color 0.2s; text-decoration: underline; text-underline-offset: 3px; }
.filt-clear:hover { color: #fff; }
.filt-x { background: none; border: none; color: var(--gold); font-size: 24px; line-height: 1; cursor: pointer; padding: 2px 6px; border-radius: 8px; transition: background 0.2s; }
.filt-x:hover { background: rgba(201,168,76,0.14); }
.filt-body { flex: 1; overflow-y: auto; padding: 8px 22px 20px; }
.filt-sec { padding: 22px 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
.filt-sec:last-child { border-bottom: none; }
.filt-sec-t { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--gold); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.filt-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.filt-chip { background: rgba(255,255,255,0.04); border: 1px solid rgba(201,168,76,0.3); color: #d8d4c4; font-family: var(--sans); font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
.filt-chip:hover { border-color: var(--gold); color: #fff; }
.filt-chip.act { background: linear-gradient(135deg, var(--gold) 0%, var(--gold-l) 100%); border-color: var(--gold-l); color: #1a1407; font-weight: 700; box-shadow: 0 4px 14px rgba(201,168,76,0.3); }
/* Slider de precio (doble manija) */
.filt-price-vals { font-size: 13px; color: #d8d4c4; margin-bottom: 18px; letter-spacing: 0.3px; }
.filt-price-vals b { color: var(--gold-l); font-weight: 700; }
.filt-range { position: relative; height: 34px; margin: 0 6px; }
.filt-range-track { position: absolute; top: 14px; left: 0; right: 0; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.14); }
.filt-range-fill { position: absolute; top: 14px; height: 4px; border-radius: 4px; background: linear-gradient(90deg, var(--gold) 0%, var(--gold-l) 100%); }
.filt-range input[type=range] { position: absolute; top: 0; left: 0; width: 100%; height: 34px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; }
.filt-range input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--gold); cursor: pointer; pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.4); margin-top: 0; }
.filt-range input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--gold); cursor: pointer; pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.filt-range input[type=range]::-webkit-slider-runnable-track { background: none; height: 34px; }
.filt-range input[type=range]::-moz-range-track { background: none; }
.filt-foot { flex-shrink: 0; padding: 16px 22px 22px; border-top: 1px solid rgba(201,168,76,0.28); background: #0b0b0a; }
.filt-clear-btn { width: 100%; background: none; border: 1px solid rgba(201,168,76,0.4); color: var(--gold-l); font-family: var(--sans); font-size: 13.5px; font-weight: 600; letter-spacing: 0.3px; padding: 12px; border-radius: 12px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s; }
.filt-clear-btn:hover { border-color: var(--gold); background: rgba(201,168,76,0.1); color: #fff; }
.filt-apply { width: 100%; background: linear-gradient(135deg, var(--gold) 0%, var(--gold-l) 100%); border: none; color: #1a1407; font-family: var(--sans); font-size: 15px; font-weight: 800; letter-spacing: 0.3px; padding: 15px; border-radius: 12px; cursor: pointer; transition: transform 0.15s, box-shadow 0.2s; box-shadow: 0 8px 22px rgba(201,168,76,0.28); }
.filt-apply:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(201,168,76,0.4); }
.filt-apply:active { transform: translateY(0); }
/* Botón Filtros del navbar (campana de embudo) */
.filt-btn-badge { position: absolute; top: -3px; right: -3px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px; background: var(--gold); color: #1a1407; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; line-height: 1; }

/* ── PÁGINA DE RESULTADOS FILTRADOS ── */
.filt-active { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; align-items: center; }
.filt-active-lbl { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.55); margin-right: 2px; }
.filt-tag { display: inline-flex; align-items: center; gap: 7px; background: rgba(201,168,76,0.14); border: 1px solid rgba(201,168,76,0.45); color: var(--gold-l); font-size: 12.5px; font-weight: 600; padding: 6px 8px 6px 14px; border-radius: 999px; }
.filt-tag button { background: rgba(255,255,255,0.12); border: none; color: #fff; width: 18px; height: 18px; border-radius: 50%; font-size: 12px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s; }
.filt-tag button:hover { background: rgba(255,255,255,0.3); }
.filt-edit { display: inline-flex; align-items: center; gap: 8px; background: none; border: 1px solid rgba(201,168,76,0.5); color: var(--gold-l); font-family: var(--sans); font-size: 12.5px; font-weight: 600; letter-spacing: 0.5px; padding: 9px 18px; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
.filt-edit:hover { border-color: var(--gold); background: rgba(201,168,76,0.12); color: #fff; }
@media (max-width: 768px) {
  .filt-drawer { width: 340px; }
  .filt-body { padding: 8px 18px 20px; }
  .filt-head { padding: 18px 18px 14px; }
}
`;

/* ──────────────────────────────────────────────────────────────
   LOGO CORONA (SVG)
────────────────────────────────────────────────────────────── */
const Crown = ({ size = 38 }) => (
  <svg width={size} height={size * 0.86} viewBox="0 0 110 95" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="110" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f0d060" />
        <stop offset="45%" stopColor="#c9a84c" />
        <stop offset="100%" stopColor="#8b6010" />
      </linearGradient>
    </defs>
    <path d="M8 68 L18 22 L30 50 Z" fill="url(#cg)" />
    <path d="M27 68 L37 27 L48 54 Z" fill="url(#cg)" />
    <path d="M44 68 L55 4 L66 68 Z" fill="url(#cg)" />
    <path d="M62 54 L73 27 L83 68 Z" fill="url(#cg)" />
    <path d="M80 50 L92 22 L102 68 Z" fill="url(#cg)" />
    <path d="M22 55 L55 34 L88 55" stroke="url(#cg)" strokeWidth="5" fill="none" opacity="0.5" />
    <path d="M55 20 C55 20 49 31 49 37.5 C49 41 51.7 44 55 44 C58.3 44 61 41 61 37.5 C61 31 55 20 55 20Z" fill="#6a4800" opacity="0.9" />
    <rect x="6" y="71" width="98" height="10" rx="3" fill="url(#cg)" />
  </svg>
);

/* placeholder cuando un producto no tiene imagen */
const NoImg = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0.4 }}>
    <Crown size={40} />
    <span style={{ fontSize: 11, letterSpacing: 3, color: "#999", textTransform: "uppercase" }}>Rey del Aroma</span>
  </div>
);

/* Medios de pago (logos oficiales). */
const PAY_METHODS = [
  { id: "wompi", label: "Wompi", logo: logoWompi },
  { id: "addi", label: "Addi", logo: logoAddi },
  { id: "sistecredito", label: "Sistecrédito", logo: logoSistecredito },
];
const PayBadges = ({ className = "" }) => (
  <div className={`pay-badges ${className}`}>
    {PAY_METHODS.map((m) => (
      <span key={m.id} className="pay-chip" title={m.label}>
        <img className="pay-img" src={m.logo} alt={m.label} />
      </span>
    ))}
  </div>
);

/* ──────────────────────────────────────────────────────────────
   TARJETA DE PRODUCTO (única, reutilizable en todas las vistas)
   - Sello "100% Original" en la esquina inferior derecha de la imagen
   - Botón "+ Agregar" a lo ancho en el pie
────────────────────────────────────────────────────────────── */
function ProductCard({ p, className = "", onOpen, onAdd }) {
  return (
    <div className={`pcard${className ? " " + className : ""}`} onClick={() => onOpen(p)}>
      <div className="pcard-img">
        {p.promo && <span className="pcard-badge">2 × $300.000</span>}
        {p.image ? <img src={p.image} alt={p.name} className="pcard-real-img" loading="lazy" /> : <NoImg />}
        <img className="pcard-seal" src={selloOriginal} alt="100% Original" loading="lazy" />
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{p.brand}</div>
        <div className="pcard-name">{p.name}</div>
        <div className="pcard-sub">{p.subtitle || p.size || p.collection}</div>
        <div className="pcard-price">{cop(p.price)} <span className="pcard-curr">COP</span></div>
        <div className="pcard-trust"><span className="pcard-stars">★★★★★</span><span className="pcard-trust-txt">+500 clientes satisfechos</span></div>
        {p.tag && <div className="pcard-aroma">{FAMILY_META[p.tag]?.emoji || "✨"} {p.tag}</div>}
      </div>
      <div className="pcard-foot">
        <button className="quick-buy" onClick={(e) => { e.stopPropagation(); onAdd(p, p.size || "", 1); }}>+ Agregar</button>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "", brand: "", subtitle: "", size: "", price: "",
  category: "Hombre", collection: "Árabes", promo: false,
  tag: "", description: "", image: "", images: [],
};

const FILTER_TABS = ["Todos", "Hombre", "Mujer", "Destacados", "Diseñador", "Árabes", "2 × $300.000"];

/* Pestañas que abren su propia página al hacer clic (orden de aparición) */
const CATEGORY_TABS = ["Hombre", "Mujer", "2 × $300.000", "Diseñador", "Árabes", "Destacados"];

/* Contenido del encabezado (hero) de cada página de categoría.
   La imagen se usa como fondo del banner; el resto es texto editable. */
const CATEGORY_META = {
  "Todos":        { eyebrow: "Colección", pre: "Nuestra",       hi: "Colección",   banner: "banner1", desc: "Todo nuestro catálogo de perfumes 100% originales, reunido en un solo lugar." },
  "Hombre":       { eyebrow: "Colección", pre: "Para",          hi: "Hombre",      banner: "feat1",   desc: "Fragancias intensas, amaderadas y con carácter. Encuentra el perfume que define tu presencia." },
  "Mujer":     { eyebrow: "Colección", pre: "Para",          hi: "Mujer",       banner: "feat2",   desc: "Aromas florales, dulces y envolventes. Esencias pensadas para realzar tu elegancia." },
  "Unisex":        { eyebrow: "Colección", pre: "",              hi: "Unisex",      banner: "feat3",   desc: "Fragancias versátiles que rompen las reglas. Para quienes eligen su aroma sin etiquetas." },
  "2 × $300.000":  { eyebrow: "Promoción", pre: "Promo",         hi: "2 × $300.000", banner: "banner2", desc: "Arma tu combo: lleva dos perfumes árabes seleccionados por $300.000. La mejor relación precio–calidad." },
  "Diseñador":     { eyebrow: "Colección", pre: "Perfumes de",   hi: "Diseñador",   banner: "banner1", desc: "Las casas más reconocidas del mundo. 100% originales, con la firma de las grandes marcas." },
  "Árabes":        { eyebrow: "Colección", pre: "Perfumes",      hi: "Árabes",      banner: "banner3", desc: "Lattafa, Armaf, Maison Alhambra y más. Proyección y duración excepcionales al mejor precio." },
  "Destacados":    { eyebrow: "Selección", pre: "Productos",     hi: "Destacados",  banner: "banner1", desc: "Nuestra selección curada: los más vendidos y mejor valorados por nuestros clientes." },
};

/* Slug de URL de cada categoría → permite abrir cada una en una PESTAÑA NUEVA
   del navegador con un enlace tipo  ?categoria=para-el  */
const CATEGORY_SLUGS = {
  "Todos": "catalogo",
  "Hombre": "hombre",
  "Mujer": "mujer",
  "Unisex": "unisex",
  "2 × $300.000": "promo",
  "Diseñador": "disenador",
  "Árabes": "arabes",
  "Destacados": "destacados",
};
const SLUG_TO_CATEGORY = Object.fromEntries(Object.entries(CATEGORY_SLUGS).map(([name, slug]) => [slug, name]));
// Opciones de ordenamiento del catálogo (las elige el cliente en el menú "Ordenar")
const SORTS = [
  { id: "recomendado", label: "Recomendado" },
  { id: "price-asc",   label: "Precio: menor a mayor" },
  { id: "price-desc",  label: "Precio: mayor a menor" },
  { id: "name-asc",    label: "Nombre: A → Z" },
  { id: "name-desc",   label: "Nombre: Z → A" },
];
function sortProducts(arr, mode) {
  const a = [...arr];
  switch (mode) {
    case "price-asc":  return a.sort((x, y) => x.price - y.price);
    case "price-desc": return a.sort((x, y) => y.price - x.price);
    case "name-asc":   return a.sort((x, y) => x.name.localeCompare(y.name, "es"));
    case "name-desc":  return a.sort((x, y) => y.name.localeCompare(x.name, "es"));
    default:           return a; // recomendado = orden original del catálogo
  }
}
const PROMO_LABEL = "2 X $300.000";
const PROMO_UNIT_DISCOUNT = 40000; // $ de descuento por CADA perfume incluido en la promo "2 × $300.000"

/* Rangos de precio para el filtro del catálogo (los elige el cliente) */
const PRICE_RANGES = [
  { id: "all",     label: "Todos los precios",     min: 0,      max: Infinity },
  { id: "u150",    label: "Menos de $150.000",     min: 0,      max: 150000 },
  { id: "150-250", label: "$150.000 – $250.000",   min: 150000, max: 250000 },
  { id: "250-400", label: "$250.000 – $400.000",   min: 250000, max: 400000 },
  { id: "400-600", label: "$400.000 – $600.000",   min: 400000, max: 600000 },
  { id: "600",     label: "Más de $600.000",       min: 600000, max: Infinity },
];
const inPriceRange = (price, id) => {
  const r = PRICE_RANGES.find((x) => x.id === id) || PRICE_RANGES[0];
  return price >= r.min && price < r.max;
};

/* Selección curada de "Productos destacados" (por slug del catálogo original) */
const FEATURED_SLUGS = [
  "dior-sauvage-649999",
  "valentino-uomo-born-in-roma-649999",
  "jean-paul-gaultier-le-male-elixir-479999",
  "ariana-grande-cloud-299999",
  "azzaro-chrome-azure-229900",
  "lacoste-blanc-319999",
  "lattafa-khamrah-190000",
  "lattafa-asad-190000",
  "lattafa-yara-190000",
  "armaf-club-de-nuit-intense-man-190000",
];

function matchFilter(p, f) {
  if (f === "Todos") return true;
  if (f === "Destacados") return FEATURED_SLUGS.includes(p.slug);
  if (f === "Hombre") return p.category === "Hombre" || p.category === "Unisex";
  if (f === "Mujer") return p.category === "Mujer" || p.category === "Unisex";
  if (f === "Unisex") return p.category === "Unisex";
  if (f === "2 × $300.000") return !!p.promo;
  // cualquier otro filtro se trata como nombre de colección
  return p.collection === f;
}

function describe(p) {
  const parts = [];
  parts.push(`Descubre ${p.name} de ${p.brand}, una fragancia 100% original disponible en Rey del Aroma.`);
  if (p.promo) parts.push("Incluida en nuestra promoción 2 × $300.000: arma tu combo de dos perfumes árabes.");
  parts.push("Págalo en línea de forma segura con Wompi, Addi o Sistecrédito, con envío a toda Colombia.");
  return parts.join(" ");
}

/* Normaliza categorías antiguas: catálogos guardados en versiones anteriores pueden
   tener "Para Él"/"Para Ella" como categoría, que ya no funcionan como filtro.
   Las convertimos al formato actual ("Hombre"/"Mujer"). Es idempotente. */
function fixCategory(c) {
  const v = (c || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v === "para el" || v === "hombre") return "Hombre";
  if (v === "para ella" || v === "mujer") return "Mujer";
  if (v === "unisex") return "Unisex";
  return c || "Hombre";
}

/* Comprime y redimensiona una imagen antes de guardarla como base64.
   Evita saturar el almacenamiento del navegador cuando hay varias fotos por producto.
   Devuelve una promesa con el data URL (JPEG) ya optimizado. */
function compressImage(file, maxDim = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        try {
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) { reject(err); }
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Catálogo inicial: usa el guardado en localStorage si existe, si no el del archivo.
   Se ejecuta una sola vez como estado inicial (evita un parpadeo del catálogo). */
function loadInitialProducts() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        // re-resolver imágenes originales por nombre de archivo (robusto entre builds)
        // y re-aplicar la familia olfativa (tag) por slug si el catálogo guardado aún no la tiene
        return parsed.map((p) => ({
          ...p,
          category: fixCategory(p.category),
          image: (p.img && imageForFile(p.img)) || p.image || "",
          tag: p.tag || TAG_BY_SLUG[p.slug] || "",
        }));
      }
    }
  } catch { /* ignore */ }
  return PRODUCTS;
}

/* Cupones guardados (los crea el admin). Estado inicial perezoso desde localStorage. */
function loadCoupons() {
  try {
    const saved = localStorage.getItem(LS_COUPONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

/* Colecciones que crea el admin. Si no hay guardadas, usa las del catálogo. */
function loadCollections() {
  try {
    const saved = localStorage.getItem(LS_COLLECTIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* ignore */ }
  return COLLECTIONS;
}

/* Tipos de aroma (familias) que crea el admin. Si no hay guardados, usa los del catálogo. */
function loadAromas() {
  try {
    const saved = localStorage.getItem(LS_AROMAS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* ignore */ }
  return FAMILIES;
}

/* ¿El usuario está volviendo de Wompi? (?wompi=1&id=<txId> o ?env=...) */
function readWompiReturn() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const fromWompi = params.get("wompi") === "1" || !!params.get("env");
    return id && fromWompi ? { id, fromWompi: true } : { id: null, fromWompi: false };
  } catch {
    return { id: null, fromWompi: false };
  }
}

/* ¿El usuario está volviendo de Sistecrédito? Al terminar, la pasarela agrega
   a la urlResponse:  ?sistecredito=1&paymentRef=<_id>&transactionId=...&orderId=... */
function readSistecreditoReturn() {
  try {
    const p = new URLSearchParams(window.location.search);
    const fromSiste = p.get("sistecredito") === "1";
    const id = p.get("paymentRef") || p.get("transactionId") || "";
    return fromSiste ? { fromSiste: true, id } : { fromSiste: false, id: "" };
  } catch {
    return { fromSiste: false, id: "" };
  }
}

/* Lee ?categoria=<slug> de la URL y devuelve el nombre de la categoría (o null).
   Es lo que permite que una pestaña nueva se abra ya mostrando esa categoría. */
function readCategoryParam() {
  try {
    const slug = new URLSearchParams(window.location.search).get("categoria");
    return slug && SLUG_TO_CATEGORY[slug] ? SLUG_TO_CATEGORY[slug] : null;
  } catch { return null; }
}
/* URLs para abrir en pestañas nuevas (inicio y cada categoría). */
function homeUrl() { return window.location.origin + window.location.pathname; }
function categoryUrl(name) {
  const slug = CATEGORY_SLUGS[name];
  return slug ? `${homeUrl()}?categoria=${slug}` : homeUrl();
}
/* URL y lectura del término de búsqueda (?busqueda=<texto>): permite que la
   página de resultados sobreviva a un refresh y se pueda compartir/abrir directo. */
function searchUrl(query) {
  const term = (query || "").trim();
  return term ? `${homeUrl()}?busqueda=${encodeURIComponent(term)}` : homeUrl();
}
function readSearchParam() {
  try {
    const v = new URLSearchParams(window.location.search).get("busqueda");
    return v ? v.trim() : "";
  } catch { return ""; }
}

/* ──────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
────────────────────────────────────────────────────────────── */
export default function ReyDelAroma() {
  const initialCat = readCategoryParam(); // si la URL trae ?categoria=… abrimos esa página directamente
  const initialSearch = readSearchParam(); // si la URL trae ?busqueda=… abrimos la página de resultados
  const [view, setView] = useState(() => (
    readWompiReturn().fromWompi ? "pago-resultado"
    : readSistecreditoReturn().fromSiste ? "pago-resultado"
    : initialSearch ? "search"
    : initialCat ? "category"
    : "store"
  ));
  const [products, setProducts] = useState(loadInitialProducts);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [selSize, setSelSize] = useState(null); // presentación / variante elegida en el detalle
  const [galleryIdx, setGalleryIdx] = useState(0); // foto activa en la galería del detalle
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [catFilter, setCatFilter] = useState(initialCat || "Todos");
  const [sortBy, setSortBy] = useState("recomendado"); // ordenamiento elegido por el cliente
  const [priceFilter, setPriceFilter] = useState("all"); // filtro por rango de precio
  const [toast, setToast] = useState(null);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminView, setAdminView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [menuOpen, setMenuOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [slide, setSlide] = useState(0);
  const [pauseSlide, setPauseSlide] = useState(false);
  const [search, setSearch] = useState(initialSearch || "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("Todos"); // filtro por familia olfativa (tipo de aroma)

  /* ── SUSCRIPCIÓN (correo) — al final de la página, sin ventana emergente ── */
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterDone, setNewsletterDone] = useState(false);

  /* ── CHECKOUT / PAGO ── */
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [payMethod, setPayMethod] = useState("wompi");
  const [coForm, setCoForm] = useState({ name: "", cedula: "", phone: "", email: "", city: "", cityCustom: "", address: "" });
  const [placing, setPlacing] = useState(false);
  const [payResult, setPayResult] = useState(() => (readWompiReturn().fromWompi || readSistecreditoReturn().fromSiste ? { loading: true } : null)); // resultado tras volver de Wompi o Sistecrédito

  /* ── VENTAS (panel admin en tiempo real) ── */
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersUpdatedAt, setOrdersUpdatedAt] = useState(null);
  const [adminToken, setAdminToken] = useState(() => { try { return localStorage.getItem(LS_ADMIN_TOKEN) || ""; } catch { return ""; } });
  const [tokenInput, setTokenInput] = useState(() => { try { return localStorage.getItem(LS_ADMIN_TOKEN) || ""; } catch { return ""; } });
  const sentRefs = useRef(new Set());     // evita enviar el mismo pedido dos veces
  const addiSentRef = useRef(false);      // un solo registro de pedido por checkout con Addi

  /* ── ENVÍO + CUPONES ── */
  const [coupons, setCoupons] = useState(loadCoupons);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponForm, setCouponForm] = useState({ code: "", type: "percent", value: "" });

  /* ── COLECCIONES Y TIPOS DE AROMA (los crea/edita el admin) ── */
  const [collectionList, setCollectionList] = useState(loadCollections);
  const [aromaList, setAromaList] = useState(loadAromas);
  const [newCollection, setNewCollection] = useState("");
  const [newAroma, setNewAroma] = useState("");

  /* ── PANEL DE FILTROS (Aroma · Sexo · Precio · Categoría) ── */
  const [filtersOpen, setFiltersOpen] = useState(false); // cajón abierto/cerrado
  const [fAroma, setFAroma] = useState("Todos");
  const [fSex, setFSex] = useState("Todos");
  const [fCat, setFCat] = useState("Todos");
  // Límites de precio (mín/máx reales del catálogo, redondeados a 10.000)
  const priceBounds = useMemo(() => {
    const ps = products.map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0);
    if (!ps.length) return { min: 0, max: 1000000 };
    return { min: Math.floor(Math.min(...ps) / 10000) * 10000, max: Math.ceil(Math.max(...ps) / 10000) * 10000 };
  }, [products]);
  const [priceLo, setPriceLo] = useState(priceBounds.min);
  const [priceHi, setPriceHi] = useState(priceBounds.max);
  // Al cargar (o si cambia el catálogo) ajustamos el slider a los límites reales
  useEffect(() => { setPriceLo(priceBounds.min); setPriceHi(priceBounds.max); }, [priceBounds.min, priceBounds.max]);

  const banners = [
    { src: banner2, alt: "2 perfumes por $300.000", filter: "2 × $300.000", dur: 15000 },
    { src: banner1, alt: "Más de 50 referencias disponibles", filter: "Todos", dur: 9000 },
    { src: banner3, alt: "Los mejores perfumes árabes", filter: "Árabes", dur: 9000 },
  ];

  /* cargar catálogo guardado (localStorage)
     → ya no hace falta un efecto: el catálogo se carga como estado inicial
       perezoso en loadInitialProducts(). */

  /* guardar cambios del catálogo en localStorage */
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(products)); }
    catch (err) {
      if (err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014)) {
        showToast("Almacenamiento lleno: usa menos fotos o más livianas");
      }
    }
  }, [products]);

  /* guardar cupones en localStorage */
  useEffect(() => {
    try { localStorage.setItem(LS_COUPONS, JSON.stringify(coupons)); } catch { /* ignore */ }
  }, [coupons]);

  /* El cupón activo se aplica AUTOMÁTICAMENTE al pedido (el cliente no escribe ningún código).
     Si hay varios activos, se usa el más reciente. Si no hay ninguno activo, no se aplica nada. */
  useEffect(() => {
    setAppliedCoupon(coupons.find((c) => c.active) || null);
  }, [coupons]);

  /* guardar colecciones y tipos de aroma en localStorage */
  useEffect(() => {
    try { localStorage.setItem(LS_COLLECTIONS, JSON.stringify(collectionList)); } catch { /* ignore */ }
  }, [collectionList]);
  useEffect(() => {
    try { localStorage.setItem(LS_AROMAS, JSON.stringify(aromaList)); } catch { /* ignore */ }
  }, [aromaList]);

  useEffect(() => { const t = requestAnimationFrame(() => setAppReady(true)); return () => cancelAnimationFrame(t); }, []);

  /* ── RETORNO DESDE WOMPI ──
     view y payResult ya se inicializan (perezosamente) según la URL.
     Aquí solo limpiamos la URL y consultamos el estado real de la transacción
     a la API pública de Wompi (los setState van en callbacks async, no en el
     cuerpo del efecto). */
  useEffect(() => {
    const { id, fromWompi } = readWompiReturn();
    if (!id || !fromWompi) return;

    // limpia la URL para que un refresh no reabra el resultado
    window.history.replaceState({}, "", window.location.pathname);

    fetch(`${WOMPI_API}/transactions/${id}`)
      .then((r) => r.json())
      .then((j) => {
        const t = j?.data || {};
        setPayResult({
          loading: false,
          status: t.status || "UNKNOWN",
          reference: t.reference || "",
          txId: t.id || id,
          amount: (t.amount_in_cents || 0) / 100,
          method: t.payment_method_type || "",
        });
        try { localStorage.removeItem("rda-cart-v1"); } catch { /* ignore */ }
      })
      .catch(() => setPayResult({ loading: false, status: "ERROR", txId: id }));
  }, []);

  /* ── RETORNO DESDE SISTECRÉDITO ──
     Igual que con Wompi: limpiamos la URL y consultamos el estado final real
     en la pasarela (vía nuestra función /api/sistecredito-status). */
  useEffect(() => {
    const { fromSiste, id } = readSistecreditoReturn();
    if (!fromSiste) return;
    window.history.replaceState({}, "", window.location.pathname);

    const PEND = ["Pending", "PendingForPaymentMethod", "Started"];
    const finish = (status, reference = "") => {
      let s = "ERROR";
      if (status === "Approved") s = "APPROVED";
      else if (PEND.includes(status)) s = "PENDING";
      else if (status) s = "DECLINED";
      setPayResult({ loading: false, status: s, txId: id, reference });
      try { localStorage.removeItem("rda-cart-v1"); } catch { /* ignore */ }
    };

    if (!id) { finish(""); return; }
    fetch(`/api/sistecredito-status?transactionId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => finish(d.status || "", d.reference || ""))
      .catch(() => finish(""));
  }, []);

  /* auto-avance del carrusel (cada banner con su propia duración) */
  useEffect(() => {
    if (pauseSlide || view !== "store") return;
    const dur = banners[slide]?.dur || 9000;
    const t = setTimeout(() => setSlide((s) => (s + 1) % banners.length), dur);
    return () => clearTimeout(t);
  }, [pauseSlide, view, slide, banners.length]);

  /* Bloquea el scroll del fondo mientras el CARRITO o la búsqueda están abiertos.
     Técnica robusta para celular: fija el body y guarda/restaura la posición del
     scroll, para que el fondo no se mueva detrás del panel. */
  useEffect(() => {
    if (!(searchOpen || cartOpen || filtersOpen)) return;
    const scrollY = window.scrollY;
    const b = document.body;
    const prev = {
      position: b.style.position, top: b.style.top, left: b.style.left,
      right: b.style.right, width: b.style.width, overflow: b.style.overflow,
    };
    b.style.position = "fixed";
    b.style.top = `-${scrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.overflow = "hidden";
    return () => {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.left = prev.left;
      b.style.right = prev.right;
      b.style.width = prev.width;
      b.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [searchOpen, cartOpen, filtersOpen]);

  /* ── VENTAS: traer pedidos guardados desde el servidor (Netlify) ── */
  const fetchOrders = async (tokenArg) => {
    const tk = (tokenArg ?? adminToken).trim();
    if (!tk) { setOrdersError("Escribe tu token de administrador para ver las ventas."); return; }
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/list-orders?token=${encodeURIComponent(tk)}`);
      if (res.status === 401) {
        setOrders([]); setOrdersError("Token incorrecto. Revisa el valor de ADMIN_TOKEN configurado en Netlify.");
      } else if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setOrders([]); setOrdersError(d.error || "No se pudieron cargar las ventas. ¿Ya publicaste la función en Netlify?");
      } else {
        const data = await res.json();
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setOrdersError(""); setOrdersUpdatedAt(new Date());
      }
    } catch {
      setOrdersError("Sin conexión con el servidor de ventas. Intenta de nuevo en unos segundos.");
    } finally {
      setOrdersLoading(false);
    }
  };

  /* Refresco automático cada 10 s mientras el panel de Ventas está abierto (tiempo real) */
  useEffect(() => {
    if (!(view === "admin" && adminAuth && adminView === "ventas")) return;
    if (!adminToken.trim()) return;
    fetchOrders();
    const id = setInterval(() => fetchOrders(), 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminAuth, adminView, adminToken]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  /* Suscripción al boletín — formulario al final de la página (sin ventana emergente) */
  const submitNewsletter = () => {
    const email = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("Escribe un correo válido");
    try {
      const list = JSON.parse(localStorage.getItem("rda-subscribers") || "[]");
      if (!list.includes(email)) list.push(email);
      localStorage.setItem("rda-subscribers", JSON.stringify(list));
      localStorage.setItem("rda-newsletter", "subscribed");
    } catch { /* ignore */ }
    setNewsletterEmail("");
    setNewsletterDone(true);
    showToast("¡Gracias por suscribirte! 👑");
  };

  /* "Catálogo" / "Todos" → abre la página propia con TODO el catálogo (grid completo) */
  const quickFilter = (f) => {
    setCatFilter(f);
    setTagFilter("Todos");
    setSortBy("recomendado");
    setPriceFilter("all");
    setSearch("");
    setSearchOpen(false);
    setMenuOpen(false);
    setView("category");
    try { window.history.replaceState({}, "", categoryUrl(f)); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };
  /* Envía la búsqueda a su PÁGINA propia de resultados (distinta a la de inicio). */
  const submitSearch = () => {
    const term = search.trim();
    if (!term) return;
    setSearchOpen(false);
    setMenuOpen(false);
    setView("search");
    try { window.history.replaceState({}, "", searchUrl(term)); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };
  /* Cierra los resultados, limpia el término y vuelve al inicio. */
  const exitSearch = () => {
    setSearch("");
    setSearchOpen(false);
    setMenuOpen(false);
    setView("store");
    try { window.history.replaceState({}, "", homeUrl()); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };

  /* Abre la página propia de una categoría (Hombre, Mujer, Unisex, 2 × $300.000, …) */
  const goCategory = (f) => {
    setCatFilter(f);
    setTagFilter("Todos");
    setSortBy("recomendado");
    setSearch("");
    setSearchOpen(false);
    setMenuOpen(false);
    setView("category");
    try { window.history.replaceState({}, "", categoryUrl(f)); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };
  /* Decide a dónde ir: "Todos"/"Catálogo" → tienda; el resto → su propia página */
  const goFilter = (f) => { if (f === "Todos") quickFilter("Todos"); else goCategory(f); };

  /* Desplaza un carrusel de productos del inicio (flechas ‹ ›) */
  const scrollRow = (id, dir) => {
    const el = document.getElementById(id);
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  const openProduct = (p) => {
    setSelectedProduct(p);
    setQty(1);
    setSelSize(null);
    setGalleryIdx(0);
    setView("product");
    window.scrollTo({ top: 0 });
  };

  const addToCart = (p, size, q) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id && i.size === size);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + q };
        return next;
      }
      return [...prev, { ...p, size, qty: q }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (id, size) => setCart((prev) => prev.filter((i) => !(i.id === id && i.size === size)));
  const updateQty = (id, size, delta) =>
    setCart((prev) => prev.map((i) => (i.id === id && i.size === size ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  // Promo "2 × $300.000" en el carrito: mismo cálculo que el checkout (sin envío, que se elige después).
  const cartPromoUnits = cart.reduce((n, i) => n + (i.promo ? i.qty : 0), 0);
  const cartPromoDiscount = cartPromoUnits >= 2 ? cartPromoUnits * PROMO_UNIT_DISCOUNT : 0;
  const cartCouponDisc = couponDiscount(appliedCoupon, cartTotal);
  const cartFinalTotal = Math.max(0, cartTotal - cartPromoDiscount - cartCouponDisc);
  const q = search.trim().toLowerCase();
  const matched = (q
    ? products.filter((p) =>
        [p.name, p.fullName, p.brand, p.collection, p.category, p.subtitle, p.tag]
          .filter(Boolean).join(" ").toLowerCase().includes(q)
      )
    : products.filter((p) => matchFilter(p, catFilter) && (tagFilter === "Todos" || p.tag === tagFilter))
  ).filter((p) => inPriceRange(p.price, priceFilter));
  const filtered = sortProducts(matched, sortBy);

  // Resultados en vivo bajo la lupa (primeros 6 mientras el cliente escribe)
  const searchResults = q ? filtered.slice(0, 6) : [];

  /* Aromas que REALMENTE tienen productos (evita filtros vacíos como Vainilla, Oud, etc.).
     El admin sigue viendo la lista completa para poder etiquetar; esto es solo para los filtros del cliente. */
  const aromaCounts = useMemo(() => {
    const m = {};
    for (const p of products) {
      const tags = (Array.isArray(p.tags) && p.tags.length) ? p.tags : (p.tag ? [p.tag] : []);
      for (const t of tags) if (t) m[t] = (m[t] || 0) + 1;
    }
    return m;
  }, [products]);
  const availableAromas = [
    ...aromaList.filter((a) => aromaCounts[a] > 0),
    ...Object.keys(aromaCounts).filter((a) => aromaCounts[a] > 0 && !aromaList.includes(a)),
  ];

  /* ── FILTRADO DEL PANEL (Aroma · Sexo · Precio · Categoría), combinables ── */
  // Categorías disponibles: las colecciones reales + la promo + destacados
  const collectionOpts = Array.from(new Set([...collectionList, ...products.map((p) => p.collection)].filter(Boolean)));
  const catOptions = [...collectionOpts, "2 × $300.000", "Destacados"];
  const fSexMatch = (p) =>
    fSex === "Todos" ? true
    : fSex === "Hombre" ? (p.category === "Hombre" || p.category === "Unisex")
    : fSex === "Mujer" ? (p.category === "Mujer" || p.category === "Unisex")
    : p.category === "Unisex";
  const fCatMatch = (p) =>
    fCat === "Todos" ? true
    : fCat === "2 × $300.000" ? !!p.promo
    : fCat === "Destacados" ? FEATURED_SLUGS.includes(p.slug)
    : p.collection === fCat;
  const fAromaMatch = (p) => {
    if (fAroma === "Todos") return true;
    const tags = (Array.isArray(p.tags) && p.tags.length) ? p.tags : (p.tag ? [p.tag] : []);
    return tags.includes(fAroma);
  };
  const fPriceMatch = (p) => p.price >= priceLo && p.price <= priceHi;
  const priceTouched = priceLo > priceBounds.min || priceHi < priceBounds.max;
  const panelResults = sortProducts(
    products.filter((p) => fSexMatch(p) && fCatMatch(p) && fAromaMatch(p) && fPriceMatch(p)),
    "recomendado"
  );
  const activeFilterCount = (fAroma !== "Todos" ? 1 : 0) + (fSex !== "Todos" ? 1 : 0) + (fCat !== "Todos" ? 1 : 0) + (priceTouched ? 1 : 0);

  const openFilters = () => {
    setSearchOpen(false); setMenuOpen(false);
    /* Deja ya seleccionada la categoría que el cliente está viendo (Hombre, Mujer,
       2 × $300.000, Diseñador, Árabes…) para que al filtrar no se pierda el contexto.
       Solo rellena la dimensión si está en "Todos" (no pisa una elección manual). */
    if (catFilter && catFilter !== "Todos") {
      if (catFilter === "Hombre" || catFilter === "Mujer" || catFilter === "Unisex") {
        setFSex((cur) => (cur === "Todos" ? catFilter : cur));
      } else {
        setFCat((cur) => (cur === "Todos" ? catFilter : cur));
      }
    }
    setFiltersOpen(true);
  };
  const clearFilters = () => { setFAroma("Todos"); setFSex("Todos"); setFCat("Todos"); setPriceLo(priceBounds.min); setPriceHi(priceBounds.max); };
  const applyFilters = () => { setFiltersOpen(false); setMenuOpen(false); setView("filtros"); window.scrollTo({ top: 0 }); };

  /* Totales del checkout: subtotal, descuento del cupón, envío y total. */
  const computeTotals = (items = checkoutItems) => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const couponDisc = couponDiscount(appliedCoupon, subtotal);
    // Promo "2 × $300.000": $40.000 de descuento por CADA perfume de la promo,
    // SOLO a partir de 2 unidades (con 1 sola NO aplica → 2 perfumes = 300.000).
    const promoUnits = items.reduce((n, i) => n + (i.promo ? i.qty : 0), 0);
    const promoDiscount = promoUnits >= 2 ? promoUnits * PROMO_UNIT_DISCOUNT : 0;
    const discount = Math.min(subtotal, couponDisc + promoDiscount);
    const base = Math.max(0, subtotal - discount);
    const shipping = shippingCost(coForm.city, subtotal);
    return { subtotal, couponDisc, promoUnits, promoDiscount, discount, base, shipping, total: base + shipping };
  };

  /* ── PAGO / CHECKOUT ── */
  const goCheckout = (items) => {
    if (!items || !items.length) return;
    setCheckoutItems(items);
    addiSentRef.current = false;
    setCartOpen(false);
    setMenuOpen(false);
    const first = ["wompi", "addi", "sistecredito"].find((m) => PAYMENTS[m]?.enabled);
    setPayMethod(first || "wompi");
    setView("checkout");
    window.scrollTo({ top: 0 });
  };
  const buyNow = (p, size, q) => goCheckout([{ ...p, size, qty: q }]);
  const setCo = (key) => (e) => setCoForm((f) => ({ ...f, [key]: e.target.value }));

  /* Datos del pedido que se guardan y se envían por correo */
  const buildOrderPayload = (reference) => {
    const { subtotal, discount, promoDiscount, shipping, total } = computeTotals();
    const finalCity = coForm.city === SHIPPING.otherLabel ? coForm.cityCustom.trim() : coForm.city.trim();
    return {
      reference,
      date: new Date().toISOString(),
      method: payMethod,
      customer: {
        name: coForm.name.trim(),
        cedula: coForm.cedula.trim(),   // ← ID del cliente (Cédula / NIT)
        phone: coForm.phone.trim(),
        email: coForm.email.trim(),
        city: finalCity,
        address: coForm.address.trim(),
      },
      items: checkoutItems.map((it) => ({ name: it.name, brand: it.brand || "", size: it.size || "", qty: it.qty, price: it.price })),
      coupon: appliedCoupon ? appliedCoupon.code : (promoDiscount > 0 ? PROMO_LABEL : ""),
      zone: finalCity,
      subtotal, discount, shipping, total,
    };
  };

  /* Guarda el pedido (servidor + respaldo local) y dispara el correo al admin */
  const sendOrder = async (order) => {
    if (!order || sentRefs.current.has(order.reference)) return;
    sentRefs.current.add(order.reference);
    // respaldo local inmediato (por si la red falla)
    try {
      const prev = JSON.parse(localStorage.getItem(LS_ORDERS) || "[]");
      localStorage.setItem(LS_ORDERS, JSON.stringify([order, ...prev].slice(0, 300)));
    } catch { /* ignore */ }
    // envío al servidor: guarda la venta en Netlify + manda el correo
    try {
      await Promise.race([
        fetch("/api/save-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        }),
        new Promise((r) => setTimeout(r, 6000)), // no bloquear más de 6 s la redirección
      ]);
    } catch { /* el respaldo local ya quedó guardado */ }
  };

  const isCheckoutFormValid = () =>
    coForm.name.trim() && coForm.cedula.trim() && coForm.phone.trim() && coForm.address.trim() &&
    coForm.city.trim() && (coForm.city !== SHIPPING.otherLabel || coForm.cityCustom.trim());

  /* Espera (polling) a que Sistecrédito entregue la URL de pago tras crear la
     transacción. Devuelve la URL, "" si la transacción falló o no llegó a tiempo. */
  const waitSistecreditoUrl = async (transactionId) => {
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1800));
      try {
        const r = await fetch(`/api/sistecredito-status?transactionId=${encodeURIComponent(transactionId)}`);
        const d = await r.json();
        if (d.redirectUrl) return d.redirectUrl;
        if (d.failed) return "";
      } catch { /* sigue intentando */ }
    }
    return "";
  };

  const placeOrder = async () => {
    if (!isCheckoutFormValid()) return showToast("Completa tus datos de envío");

    const { subtotal, discount, promoDiscount, shipping, total } = computeTotals();
    const reference = newReference();
    const order = buildOrderPayload(reference);
    try {
      localStorage.setItem("rda-last-order", JSON.stringify({
        reference, method: payMethod, subtotal, discount, shipping, total,
        coupon: appliedCoupon ? appliedCoupon.code : (promoDiscount > 0 ? PROMO_LABEL : ""), zone: order.zone,
        items: checkoutItems, ...coForm, city: order.customer.city, date: order.date,
      }));
    } catch { /* ignore */ }

    setPlacing(true);
    await sendOrder(order);   // ← registra la venta y envía el correo antes de redirigir

    if (payMethod === "wompi") {
      if (!WOMPI.publicKey) { setPlacing(false); return showToast("Falta configurar la llave de Wompi"); }
      try {
        const url = await buildWompiUrl({ amount: total, reference, email: coForm.email, phone: coForm.phone, fullName: coForm.name });
        window.location.href = url;
      } catch {
        setPlacing(false);
        showToast("No se pudo iniciar el pago. Intenta de nuevo.");
      }
      return;
    }
    if (payMethod === "sistecredito") {
      try {
        showToast("Conectando con Sistecrédito…");
        const res = await fetch("/api/sistecredito-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, amount: total, cedula: coForm.cedula.trim(), docType: "CC" }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo iniciar el pago con Sistecrédito.");
        let url = data.redirectUrl;
        if (!url && data.transactionId) url = await waitSistecreditoUrl(data.transactionId);
        if (!url) throw new Error("Sistecrédito no entregó el enlace de pago. Intenta de nuevo.");
        window.location.href = url;
      } catch (e) {
        setPlacing(false);
        showToast(e.message || "No se pudo iniciar el pago con Sistecrédito.");
      }
      return;
    }
    setPlacing(false);
    // Addi se gestiona con el widget en el resumen (registro de pedido al tocar el widget).
  };

  /* Registro del pedido cuando el cliente paga con Addi (al tocar el widget) */
  const captureAddiOrder = () => {
    if (addiSentRef.current) return;
    if (!isCheckoutFormValid()) { showToast("Completa tus datos de envío para registrar tu pedido"); return; }
    addiSentRef.current = true;
    sendOrder(buildOrderPayload(newReference()));
  };

  /* ── ADMIN ── */
  const adminLogin = () => {
    if (adminPw === ADMIN_PASSWORD) { setAdminAuth(true); setAdminPw(""); }
    else showToast("Contraseña incorrecta");
  };
  const startAdd = () => { setForm(EMPTY_FORM); setEditingId(null); setAdminView("form"); };
  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name || "", brand: p.brand || "", subtitle: p.subtitle || "", size: p.size || "", price: String(p.price || ""), category: p.category || "Hombre", collection: p.collection || "Árabes", promo: !!p.promo, tag: p.tag || "", description: p.description || "", image: p.image || "", img: p.img || "", images: Array.isArray(p.images) ? p.images.filter(Boolean) : [] });
    setAdminView("form");
  };
  const deleteProduct = (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast("Producto eliminado");
  };
  const resetCatalog = () => {
    if (!confirm("¿Restaurar el catálogo original con los 45 productos? Se perderán tus cambios.")) return;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    setProducts(PRODUCTS);
    showToast("Catálogo original restaurado");
  };
  const saveProduct = () => {
    if (!form.name.trim() || !form.price) return showToast("Nombre y precio son obligatorios");
    const data = {
      name: form.name.trim(),
      brand: form.brand.trim() || "Rey del Aroma",
      subtitle: form.subtitle.trim(),
      size: form.size.trim(),
      price: parseInt(String(form.price).replace(/[^\d]/g, "")) || 0,
      category: form.category,
      collection: form.collection,
      promo: form.promo ? PROMO_LABEL : "",
      tag: form.tag || "",
      description: form.description.trim(),
      image: form.image || "",
      images: Array.isArray(form.images) ? form.images.filter(Boolean) : [],
      img: form.img || "",
    };
    if (editingId) {
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...data, id: editingId } : p)));
      showToast("Producto actualizado");
    } else {
      setProducts((prev) => [{ ...data, id: Date.now() }, ...prev]);
      showToast("Producto agregado");
    }
    setAdminView("list");
  };
  const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Solo se permiten imágenes");
    if (file.size > 12 * 1024 * 1024) return showToast("La imagen no debe superar 12MB");
    compressImage(file)
      .then((dataUrl) => setForm((f) => ({ ...f, image: dataUrl, img: "" })))
      .catch(() => showToast("No se pudo procesar la imagen"));
  };
  // Galería: varias fotos adicionales por producto (se muestran como miniaturas en el detalle)
  const handleGalleryUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) { showToast("Solo se permiten imágenes"); return; }
      if (file.size > 12 * 1024 * 1024) { showToast("Cada imagen debe ser menor a 12MB"); return; }
      compressImage(file)
        .then((dataUrl) => setForm((f) => ({ ...f, images: [...(Array.isArray(f.images) ? f.images : []), dataUrl] })))
        .catch(() => showToast("No se pudo procesar una imagen"));
    });
    e.target.value = ""; // permite volver a subir el mismo archivo
  };
  const removeGalleryImage = (idx) => setForm((f) => ({ ...f, images: (Array.isArray(f.images) ? f.images : []).filter((_, i) => i !== idx) }));
  const makeGalleryCover = (idx) => setForm((f) => {
    const imgs = Array.isArray(f.images) ? [...f.images] : [];
    const chosen = imgs[idx];
    if (!chosen) return f;
    // La portada actual pasa a la galería y la elegida se vuelve portada
    const rest = imgs.filter((_, i) => i !== idx);
    const nextImages = f.image ? [f.image, ...rest] : rest;
    return { ...f, image: chosen, img: "", images: nextImages };
  });

  /* ── CUPONES ── */
  const couponLabel = (c) => (c.type === "percent" ? `${c.value}% de descuento` : `${cop(c.value)} de descuento`);
  const addCoupon = () => {
    const code = couponForm.code.trim().toUpperCase();
    const value = parseInt(String(couponForm.value).replace(/[^\d]/g, "")) || 0;
    if (!code) return showToast("Escribe un código de cupón");
    if (value <= 0) return showToast("El valor del cupón debe ser mayor a 0");
    if (couponForm.type === "percent" && value > 100) return showToast("El porcentaje no puede ser mayor a 100");
    if (coupons.some((c) => c.code.toUpperCase() === code)) return showToast("Ya existe un cupón con ese código");
    setCoupons((prev) => [{ id: Date.now(), code, type: couponForm.type, value, active: true }, ...prev]);
    setCouponForm({ code: "", type: "percent", value: "" });
    showToast("Cupón creado");
  };
  const toggleCoupon = (id) => setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
  const deleteCoupon = (id) => {
    if (!confirm("¿Eliminar este cupón?")) return;
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    showToast("Cupón eliminado");
  };

  /* ── COLECCIONES Y TIPOS DE AROMA ── */
  const addCollection = () => {
    const v = newCollection.trim();
    if (!v) return showToast("Escribe el nombre de la colección");
    if (collectionList.some((c) => c.toLowerCase() === v.toLowerCase())) return showToast("Esa colección ya existe");
    setCollectionList((prev) => [...prev, v]);
    setNewCollection("");
    showToast("Colección creada");
  };
  const deleteCollection = (name) => {
    if (collectionList.length <= 1) return showToast("Debe quedar al menos una colección");
    if (!confirm(`¿Eliminar la colección "${name}"? Los productos que la usan no se borran.`)) return;
    setCollectionList((prev) => prev.filter((c) => c !== name));
    showToast("Colección eliminada");
  };
  const addAroma = () => {
    const v = newAroma.trim();
    if (!v) return showToast("Escribe el tipo de aroma");
    if (aromaList.some((a) => a.toLowerCase() === v.toLowerCase())) return showToast("Ese tipo de aroma ya existe");
    setAromaList((prev) => [...prev, v]);
    setNewAroma("");
    showToast("Tipo de aroma creado");
  };
  const deleteAroma = (name) => {
    if (!confirm(`¿Eliminar el tipo de aroma "${name}"? Los productos que lo usan no se borran.`)) return;
    setAromaList((prev) => prev.filter((a) => a !== name));
    showToast("Tipo de aroma eliminado");
  };

  /* ── DATOS UI ── */
  const announceItems = [
    { icon: "🚚", text: "Envío GRATIS en Bogotá desde $250.000" },
    { icon: "🌎", text: "Enviamos a toda Colombia y al exterior" },
    { icon: "🔒", text: "Pago en línea 100% seguro" },
    { icon: "💎", text: "Fragancias 100% originales" },
    { icon: "🔥", text: "Promo 2 × $300.000" },
    { icon: "💳", text: "Paga a cuotas con Addi y Sistecrédito" },
  ];
  const featBadges = [
    { img: feat4, cap: "2 × $300.000", filter: "2 × $300.000" },
    { img: feat3, cap: "Destacados", filter: "Destacados" },
    { img: feat1, cap: "Hombre", filter: "Hombre" },
    { img: feat2, cap: "Mujer", filter: "Mujer" },
  ];
  /* Carruseles de productos en el inicio (2×300, Unisex, Diseñador) */
  const homeRows = [
    { id: "row-promo", title: "2 × $300.000", filter: "2 × $300.000" },
    { id: "row-disenador", title: "Diseñador", filter: "Diseñador" },
  ].map((r) => ({ ...r, list: products.filter((p) => matchFilter(p, r.filter)) }));

  /* ── FOOTER ── */
  const Footer = () => (
    <footer className="footer">
      <div className="footer-trust">
        {[
          { icon: "💎", title: "100% Originales", sub: "Garantizamos autenticidad" },
          { icon: "🚚", title: "Envíos Rápidos", sub: "A toda Colombia" },
          { icon: "💳", title: "Pago en Línea", sub: "Wompi · Addi · Sistecrédito" },
          { icon: "📱", title: "Atención Directa", sub: "Te asesoramos por WhatsApp" },
        ].map((f, i) => (
          <div key={i} className="ft-item">
            <div className="ft-icon">{f.icon}</div>
            <div className="ft-title">{f.title}</div>
            <div className="ft-sub">{f.sub}</div>
          </div>
        ))}
      </div>
      <div className="pay-section">
        <div className="pay-label">Medios de pago aceptados</div>
        <PayBadges />
        <button className="admin-gear" onClick={() => { setView("admin"); setMenuOpen(false); window.scrollTo({ top: 0 }); }} aria-label="Administración" title="Administración">⚙</button>
      </div>
      <div className="footer-bot">
        <div className="footer-logo">REY DEL AROMA</div>
        <div className="footer-tag">Tu esencia, tu reino</div>
        <a className="footer-wa" href={waLink("Hola Rey del Aroma 👑, quiero más información sobre sus perfumes.")} target="_blank" rel="noreferrer">
          💬 Escríbenos por WhatsApp
        </a>
        <div className="footer-divider" />
        <div className="footer-copy">© {new Date().getFullYear()} Rey del Aroma · Perfumería · Colombia<br />Todos los derechos reservados</div>
      </div>
    </footer>
  );

  /* ── VISTA TIENDA ── */
  const StoreView = () => {
    const browsing = q || catFilter !== "Todos" || tagFilter !== "Todos";
    return (
    <>
      {/* Carrusel de banners */}
      <section className="hero-carousel" onMouseEnter={() => setPauseSlide(true)} onMouseLeave={() => setPauseSlide(false)}>
        <div className="hc-viewport">
          <div className="hc-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {banners.map((b, i) => (
              <button key={i} className="hc-slide" onClick={() => goFilter(b.filter)} aria-label={b.alt}>
                <img src={b.src} alt={b.alt} className="hc-slide-img" loading={i === 0 ? "eager" : "lazy"} />
              </button>
            ))}
          </div>
          <button className="hc-arrow hc-prev" onClick={() => setSlide((s) => (s - 1 + banners.length) % banners.length)} aria-label="Anterior">‹</button>
          <button className="hc-arrow hc-next" onClick={() => setSlide((s) => (s + 1) % banners.length)} aria-label="Siguiente">›</button>
          <div className="hc-dots">
            {banners.map((_, i) => (
              <button key={i} className={`hc-dot${i === slide ? " act" : ""}`} onClick={() => setSlide(i)} aria-label={`Banner ${i + 1}`} />
            ))}
          </div>
          <div className="hc-progress">
            <div className={`hc-progress-bar${pauseSlide ? " paused" : " run"}`} key={slide} style={{ animationDuration: `${banners[slide]?.dur || 9000}ms` }} />
          </div>
        </div>
      </section>

      {/* Destacados (íconos dorados) */}
      <section className="featured">
        {featBadges.map((b, i) => (
          <button key={i} className={`feat-badge${b.filter ? " clk" : ""}`} onClick={() => b.filter && goFilter(b.filter)} disabled={!b.filter} style={!b.filter ? { cursor: "default" } : undefined}>
            <span className="feat-ring"><img src={b.img} alt={b.cap} loading="lazy" /></span>
            <span className="feat-cap">{b.cap}</span>
          </button>
        ))}
      </section>

      {/* Barra de categorías retirada por solicitud */}

      {/* Productos — solo al buscar, filtrar por aroma o elegir categoría */}
      {browsing && (
      <div className="products-wrap" id="cat">
        <div className="sec-hdr">
          <h2 className="sec-title">
            {q ? <>Resultados para <span>«{search.trim()}»</span></>
              : tagFilter !== "Todos" && catFilter === "Todos" ? <>Aroma <span>{tagFilter}</span></>
              : catFilter === "Todos" ? <>Nuestra <span>Colección</span></>
              : catFilter === "Destacados" ? <>Productos <span>Destacados</span></>
              : <><span>{catFilter}</span></>}
          </h2>
          <div className="sec-tools">
            <select className="sort-sel" value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} aria-label="Filtrar por precio">
              {PRICE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button className="home-filter-btn" onClick={openFilters}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
              Filtros
              {activeFilterCount > 0 && <span className="home-filter-badge">{activeFilterCount}</span>}
            </button>
          </div>
        </div>
        <div className="pgrid">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} onOpen={openProduct} onAdd={addToCart} />
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🫙</div>
              <p>{q ? `No encontramos perfumes para «${search.trim()}»` : "No hay productos en esta categoría"}</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Carruseles por categoría (2×300, Unisex, Diseñador) — protagonistas del inicio */}
      {!browsing && homeRows.map((row) => row.list.length > 0 && (
        <section key={row.id} className="prow">
          <div className="prow-hdr">
            <h2 className="prow-title">
              {row.id === "row-promo" ? (
                <>
                  <span className="prow-flame">🔥</span>
                  <span className="prow-title-txt">{row.title}</span>
                  <span className="prow-flame prow-flame2">🔥</span>
                </>
              ) : row.title}
            </h2>
            <button className="prow-all" onClick={() => goFilter(row.filter)}>Ver todos →</button>
          </div>
          <div className="prow-wrap">
            <button className="prow-arrow prow-prev" onClick={() => scrollRow(row.id, -1)} aria-label="Anterior">‹</button>
            <div className="prow-track" id={row.id}>
              {row.list.map((p) => (
                <ProductCard key={p.id} p={p} onOpen={openProduct} onAdd={addToCart} className="prow-card" />
              ))}
            </div>
            <button className="prow-arrow prow-next" onClick={() => scrollRow(row.id, 1)} aria-label="Siguiente">›</button>
          </div>
        </section>
      ))}

      {/* Suscripción — al final de la página, sin ventana emergente */}
      <section className="subscribe">
        <div className="sub-inner">
          {!newsletterDone ? (
            <>
              <div className="sub-crown"><img className="sub-logo" src={logoPrincipal} alt="Rey del Aroma" /></div>
              <div className="sub-eyebrow">Club Rey del Aroma</div>
              <h3 className="sub-title">Únete a la <span>realeza</span></h3>
              <p className="sub-text">Regístrate y recibe descuentos exclusivos, promociones y los nuevos lanzamientos antes que nadie.</p>
              <div className="sub-form">
                <input
                  className="sub-input"
                  type="email"
                  placeholder="tu@correo.com"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitNewsletter()}
                  aria-label="Correo para suscripción"
                />
                <button className="sub-btn" onClick={submitNewsletter}>Quiero mis descuentos →</button>
              </div>
              <div className="sub-mini">🔒 Tus datos están seguros · Sin spam</div>
            </>
          ) : (
            <div className="sub-success">
              <div className="sub-check">✓</div>
              <h3 className="sub-title">¡Bienvenido al reino! 👑</h3>
              <p className="sub-text">Te avisaremos de cada promoción y lanzamiento. ¡Gracias por registrarte!</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
    );
  };

  /* ── VISTA CATEGORÍA (página propia con pestañas) ── */
  const CategoryView = () => {
    const meta = CATEGORY_META[catFilter] || { eyebrow: "Colección", pre: "", hi: catFilter, banner: "banner1", desc: "" };
    return (
      <div className="catpage">
        {/* Productos de la categoría */}
        <div className="products-wrap">
          <div className="sec-hdr">
            <h2 className="sec-title">{meta.pre ? `${meta.pre} ` : ""}<span>{meta.hi}</span></h2>
            <button className="home-filter-btn" onClick={openFilters}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
              Filtros
              {activeFilterCount > 0 && <span className="home-filter-badge">{activeFilterCount}</span>}
            </button>
          </div>
          <div className="pgrid">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} onOpen={openProduct} onAdd={addToCart} />
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🫙</div>
                <p>No hay productos en esta categoría por ahora.</p>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    );
  };

  /* ── VISTA RESULTADOS DE BÚSQUEDA (página propia, distinta al inicio) ── */
  const SearchView = () => {
    const term = search.trim();
    const n = filtered.length;
    return (
      <div className="srch">
        {/* Encabezado de resultados: limpio y enfocado solo en la búsqueda */}
        <section className="srch-hero">
          <div className="srch-hero-in">
            <div className="srch-bc">
              <button className="bc-lnk" onClick={exitSearch}>Inicio</button>
              <span aria-hidden="true">›</span>
              <span className="cur">Búsqueda</span>
            </div>
            <div className="srch-eyebrow">🔍 Resultados de búsqueda</div>
            <h1 className="srch-title">{term ? <>Resultados para <span>«{term}»</span></> : <>Buscar <span>perfumes</span></>}</h1>
            {term && <span className="srch-count">{n} fragancia{n !== 1 ? "s" : ""} encontrada{n !== 1 ? "s" : ""}</span>}

            {/* Refinar la búsqueda sin salir de la página */}
            <div className="srch-refine">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Refinar búsqueda…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") exitSearch(); }}
                aria-label="Refinar búsqueda"
              />
              {search && <button className="srch-refine-x" onClick={exitSearch} aria-label="Limpiar búsqueda">✕</button>}
            </div>

            {term && (
              <div className="srch-filter">
                <button className="srch-filter-btn" onClick={openFilters}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
                  Filtros
                  {activeFilterCount > 0 && <span className="srch-filter-badge">{activeFilterCount}</span>}
                </button>
              </div>
            )}
          </div>
        </section>

        {term && n > 0 ? (
          <>
            {/* Solo los productos que coinciden con lo buscado */}
            <div className="products-wrap srch-products">
              <div className="pgrid">
                {filtered.map((p) => (
                  <ProductCard key={p.id} p={p} onOpen={openProduct} onAdd={addToCart} />
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Sin término (buscador vacío) o sin coincidencias: página útil con sugerencias */
          <div className="srch-empty">
            <div className="srch-empty-ic">{term ? "🔎" : "🛍️"}</div>
            <h3>{term ? <>Sin resultados para <span>«{term}»</span></> : <>¿Qué perfume <span>buscas</span>?</>}</h3>
            <p>{term
              ? "No encontramos perfumes que coincidan con tu búsqueda. Revisa la ortografía o explora nuestras categorías."
              : "Escribe arriba el nombre, la marca o el tipo de aroma que quieres encontrar."}</p>
            <div className="srch-sugg-lbl">Explora por categoría</div>
            <div className="srch-sugg">
              <button onClick={() => goCategory("Hombre")}>Hombre</button>
              <button onClick={() => goCategory("Mujer")}>Mujer</button>
              <button onClick={() => goCategory("Unisex")}>Unisex</button>
              <button onClick={() => goCategory("Árabes")}>Árabes</button>
              <button onClick={() => goCategory("2 × $300.000")}>2 × $300.000</button>
            </div>
          </div>
        )}

        <Footer />
      </div>
    );
  };

  /* ── VISTA RESULTADOS FILTRADOS (Aroma · Sexo · Precio · Categoría) ── */
  const FilterResultsView = () => {
    const n = panelResults.length;
    return (
      <div className="srch">
        <section className="srch-hero">
          <div className="srch-hero-in">
            <div className="srch-bc">
              <button className="bc-lnk" onClick={() => { setView("store"); try { window.history.replaceState({}, "", homeUrl()); } catch { /* ignore */ } window.scrollTo({ top: 0 }); }}>Inicio</button>
              <span aria-hidden="true">›</span>
              <span className="cur">Filtros</span>
            </div>
            <div className="srch-eyebrow">🎚️ Catálogo filtrado</div>
            <h1 className="srch-title">Tu <span>selección</span></h1>
            <span className="srch-count">{n} fragancia{n !== 1 ? "s" : ""}</span>

            {/* Filtros activos (se pueden quitar uno a uno) + editar */}
            <div className="filt-active">
              {activeFilterCount > 0 && <span className="filt-active-lbl">Filtros:</span>}
              {fAroma !== "Todos" && (
                <span className="filt-tag">{FAMILY_META[fAroma]?.emoji || "✨"} {fAroma}<button onClick={() => setFAroma("Todos")} aria-label="Quitar aroma">✕</button></span>
              )}
              {fSex !== "Todos" && (
                <span className="filt-tag">{fSex}<button onClick={() => setFSex("Todos")} aria-label="Quitar sexo">✕</button></span>
              )}
              {fCat !== "Todos" && (
                <span className="filt-tag">{fCat}<button onClick={() => setFCat("Todos")} aria-label="Quitar categoría">✕</button></span>
              )}
              {priceTouched && (
                <span className="filt-tag">{cop(priceLo)} – {cop(priceHi)}<button onClick={() => { setPriceLo(priceBounds.min); setPriceHi(priceBounds.max); }} aria-label="Quitar precio">✕</button></span>
              )}
              <button className="filt-edit" onClick={openFilters}>⚙️ Editar filtros</button>
            </div>
          </div>
        </section>

        {n > 0 ? (
          <div className="products-wrap srch-products">
            <div className="pgrid">
              {panelResults.map((p) => (
                <ProductCard key={p.id} p={p} onOpen={openProduct} onAdd={addToCart} />
              ))}
            </div>
          </div>
        ) : (
          <div className="srch-empty">
            <div className="srch-empty-ic">🫙</div>
            <h3>Sin <span>coincidencias</span></h3>
            <p>Ningún perfume cumple con esta combinación de filtros. Prueba ampliando el rango de precio o quitando alguna opción.</p>
            <div className="srch-sugg">
              <button onClick={openFilters}>Ajustar filtros</button>
              <button onClick={clearFilters}>Limpiar todo</button>
            </div>
          </div>
        )}

        <Footer />
      </div>
    );
  };

  /* ── VISTA DETALLE ── */
  const ProductDetailView = () => {
    if (!selectedProduct) return null;
    const p = selectedProduct;
    const words = p.name.split(" ");
    const last = words.pop();
    const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : null;
    const activeVar = variants ? (variants.find((v) => v.size === selSize) || variants[0]) : null;
    const shownPrice = activeVar ? activeVar.price : p.price;
    const shownSize = activeVar ? activeVar.size : (p.size || "");
    const shownImg = activeVar && activeVar.img ? (imageForFile(activeVar.img) || p.image) : p.image;
    const extraImgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const gallery = [shownImg, ...extraImgs.filter((u) => u && u !== shownImg)].filter(Boolean);
    const mainImg = gallery[galleryIdx] || gallery[0] || shownImg;
    const aromas = (Array.isArray(p.tags) && p.tags.length) ? p.tags : (p.tag ? [p.tag] : []);
    return (
      <div className="pd-wrap">
        <div className="bc">
          <span className="bc-lnk" onClick={() => setView("store")}>Inicio</span>
          <span className="bc-sep">›</span>
          <span className="bc-lnk" onClick={() => quickFilter("Todos")}>Catálogo</span>
          <span className="bc-sep">›</span>
          <span className="cur">{p.name}</span>
        </div>
        <div className="pd-grid">
          <div>
            <div className="pd-main">
              {mainImg ? <img src={mainImg} alt={p.name} className="pd-real-img" /> : <NoImg />}
              <span className="pd-hangpin" aria-hidden="true" />
              <div className="pd-hangtag" aria-hidden="true">
                <span className="pd-hangtag-in"><span className="pd-hangtag-stars">★★★</span><b>100%</b>Original</span>
              </div>
            </div>
            {gallery.length > 1 && (
              <div className="pd-gallery">
                {gallery.map((src, i) => (
                  <button key={i} type="button" className={`pd-thumb${i === galleryIdx ? " act" : ""}`} onClick={() => setGalleryIdx(i)} aria-label={`Ver foto ${i + 1}`}>
                    <img src={src} alt={`${p.name} ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pd-info">
            {p.promo && <div className="pd-badge">2 × $300.000</div>}
            <div className="pd-name">{words.join(" ")}{words.length > 0 ? " " : ""}<b>{last}</b></div>
            {p.subtitle && <div className="pd-sub">{p.subtitle}</div>}

            <div className="pd-chips">
              <span className="pd-chip gold">{p.brand}</span>
              <span className="pd-chip">{p.category}</span>
              <span className="pd-chip">{p.collection}</span>
              {shownSize && <span className="pd-chip">{shownSize}</span>}
            </div>

            <div className="pd-price">{cop(shownPrice)} <span className="pd-curr">COP</span></div>

            {p.promo && (
              <div className="pd-promo">
                <b>2 × $300.000</b>
                <span>Combina este perfume con cualquier otro de la promo y llévate ambos por $300.000.</span>
              </div>
            )}

            <AddiWidget price={shownPrice} className="pd-addi" />

            {variants ? (
              <>
                <div className="pd-sec-t">Presentación</div>
                <div className="sizes-row">
                  {variants.map((v) => (
                    <button key={v.size} className={`size-btn${activeVar.size === v.size ? " act" : ""}`} onClick={() => { setSelSize(v.size); setGalleryIdx(0); }}>{v.size}</button>
                  ))}
                </div>
              </>
            ) : shownSize ? (
              <>
                <div className="pd-sec-t">Presentación</div>
                <div className="sizes-row">
                  <button className="size-btn act">{shownSize}</button>
                </div>
              </>
            ) : null}

            <div className="add-row">
              <div className="qty-ctrl">
                <button className="qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="qty-n">{qty}</span>
                <button className="qty-btn" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
              <button className="add-btn" onClick={() => addToCart({ ...p, price: shownPrice, image: shownImg }, shownSize, qty)}>Agregar al carrito 🛒</button>
            </div>
            <div className="pd-buy">
              <button className="buy-now-btn" onClick={() => buyNow({ ...p, price: shownPrice, image: shownImg }, shownSize, qty)}>Comprar ahora →</button>
            </div>
            <div className="pd-stock">🔥 Quedan pocas unidades disponibles</div>

            <div className="pd-reassure">
              <div className="pd-trust">
                <span className="pd-stars">⭐⭐⭐⭐⭐</span>
                <span className="pd-trust-txt">Más de 500 clientes satisfechos</span>
              </div>
              <div className="pd-seals">
                <span className="pd-seal">✓ 100% Original</span>
                <span className="pd-seal">🔒 Pago seguro</span>
                <span className="pd-seal">🚚 Envío a todo Colombia</span>
              </div>
            </div>

            <div className="pd-sec-t">Sobre la fragancia</div>
            <div className="pd-desc">{p.description || describe(p)}</div>

            {aromas.length > 0 && (
              <div className="pd-aroma">
                <span className="pd-aroma-k">Notas de aroma</span>
                {aromas.map((a) => (
                  <span key={a} className="pd-aroma-v">{FAMILY_META[a]?.emoji || "✨"} {a}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── VISTA RESULTADO DE PAGO (retorno de Wompi) ── */
  const PaymentResultView = () => {
    const r = payResult || {};
    const goStore = () => { setPayResult(null); setView("store"); quickFilter("Todos"); window.scrollTo({ top: 0 }); };

    if (r.loading) {
      return (
        <div className="co-empty">
          <div className="empty-icon">⏳</div>
          <p style={{ fontSize: 15, letterSpacing: 1 }}>Confirmando tu pago…</p>
        </div>
      );
    }

    const map = {
      APPROVED: { ic: "✅", t: "¡Pago aprobado!", d: "Recibimos tu pago correctamente. Pronto te contactamos para coordinar el envío.", cls: "ok" },
      PENDING: { ic: "⏳", t: "Pago en proceso", d: "Tu pago está siendo confirmado. Te avisaremos apenas se acredite.", cls: "pend" },
      DECLINED: { ic: "❌", t: "Pago rechazado", d: "El pago no pudo completarse. Puedes intentar de nuevo o escribirnos por WhatsApp.", cls: "bad" },
      VOIDED: { ic: "↩️", t: "Pago anulado", d: "La transacción fue anulada. Si crees que es un error, escríbenos.", cls: "bad" },
      ERROR: { ic: "⚠️", t: "Hubo un problema", d: "No pudimos confirmar el estado del pago. Escríbenos por WhatsApp y lo verificamos.", cls: "bad" },
    };
    const info = map[r.status] || map.ERROR;

    return (
      <div className="pay-result-wrap">
        <div className={`pay-result ${info.cls}`}>
          <div className="pr-ic">{info.ic}</div>
          <h2 className="pr-title">{info.t}</h2>
          <p className="pr-desc">{info.d}</p>
          <div className="pr-data">
            {r.reference && <div className="pr-row"><span>Referencia</span><b>{r.reference}</b></div>}
            {r.amount > 0 && <div className="pr-row"><span>Monto</span><b>{cop(r.amount)}</b></div>}
            {r.txId && <div className="pr-row"><span>Transacción</span><b className="pr-tx">{r.txId}</b></div>}
          </div>
          <div className="pr-actions">
            <button className="btn-g" onClick={goStore} style={{ justifyContent: "center" }}>Volver a la tienda</button>
            <a className="btn-o" href={waLink(`Hola Rey del Aroma 👑, hice un pago con referencia ${r.reference || r.txId || ""} y quiero confirmar mi pedido.`)} target="_blank" rel="noreferrer" style={{ justifyContent: "center", textDecoration: "none" }}>Escribir por WhatsApp</a>
          </div>
        </div>
      </div>
    );
  };

  /* ── VISTA CHECKOUT / PAGO ── */
  const CheckoutView = () => {
    if (!checkoutItems.length) {
      return (
        <div className="co-empty">
          <div className="empty-icon">🛒</div>
          <p style={{ fontSize: 15, letterSpacing: 1 }}>No hay productos para pagar.</p>
          <button className="btn-g" onClick={() => { setView("store"); quickFilter("Todos"); }} style={{ marginTop: 20, justifyContent: "center" }}>Ver catálogo →</button>
        </div>
      );
    }
    const { subtotal, couponDisc, promoUnits, promoDiscount, shipping, total } = computeTotals();
    const freeLeft = SHIPPING.bogotaFreeFrom - subtotal;
    const methods = [
      { id: "wompi", name: "Wompi", logo: logoWompi, desc: "Tarjeta · PSE · Nequi · Bancolombia", badge: "Pago inmediato" },
      { id: "addi", name: "Addi", logo: logoAddi, desc: "Paga a cuotas, sin tarjeta", badge: "A cuotas" },
      { id: "sistecredito", name: "Sistecrédito", logo: logoSistecredito, desc: "Crédito en cuotas fijas", badge: "A crédito" },
    ].filter((m) => PAYMENTS[m.id]?.enabled);
    const activeName = methods.find((m) => m.id === payMethod)?.name || "";

    return (
      <div className="co-wrap">
        <div className="bc">
          <span className="bc-lnk" onClick={() => setView("store")}>Inicio</span>
          <span className="bc-sep">›</span>
          <span className="cur">Finalizar compra</span>
        </div>

        <div className="co-grid">
          {/* IZQUIERDA — datos + método de pago */}
          <div className="co-main">
            <h2 className="co-title">Finalizar <span>compra</span></h2>
            <p className="co-lead">Solo tus datos de envío y listo — una compra rápida y 100% segura.</p>

            <div className="co-sec-t">Tus datos de envío</div>
            <div className="co-form">
              <div className="fg full"><label className="fl">Nombre completo *</label><input className="fi" value={coForm.name} onChange={setCo("name")} placeholder="Ej. Ana Gómez" /></div>
              <div className="fg"><label className="fl">Cédula / NIT *</label><input className="fi" type="text" inputMode="numeric" value={coForm.cedula} onChange={setCo("cedula")} placeholder="Ej. 1094…" /></div>
              <div className="fg"><label className="fl">Celular / WhatsApp *</label><input className="fi" type="tel" value={coForm.phone} onChange={setCo("phone")} placeholder="300 123 4567" /></div>
              <div className="fg"><label className="fl">Correo (opcional)</label><input className="fi" type="email" value={coForm.email} onChange={setCo("email")} placeholder="tu@correo.com" /></div>
              <div className="fg"><label className="fl">Ciudad *</label>
                <select className="fsel" value={coForm.city} onChange={setCo("city")}>
                  <option value="">Selecciona tu ciudad…</option>
                  {SHIPPING_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name} · envío {cop(c.cost)}</option>
                  ))}
                  <option value={SHIPPING.otherLabel}>{SHIPPING.otherLabel} · envío {cop(SHIPPING.otherCost)}</option>
                </select>
              </div>
              {coForm.city === SHIPPING.otherLabel && (
                <div className="fg"><label className="fl">Escribe tu ciudad / municipio *</label><input className="fi" value={coForm.cityCustom} onChange={setCo("cityCustom")} placeholder="Ej. Garzón, Huila" /></div>
              )}
              <div className="fg full"><label className="fl">Dirección de envío *</label><input className="fi" value={coForm.address} onChange={setCo("address")} placeholder="Calle 00 # 00-00, barrio" /></div>
              <div className="fg full">
                <div className="co-ship-note">🚚 El costo de envío se calcula <b>automáticamente</b> según la ciudad que elijas. En <b>Bogotá es GRATIS</b> desde {cop(SHIPPING.bogotaFreeFrom)}.</div>
              </div>
            </div>

            <div className="co-sec-t" style={{ marginTop: 30 }}>¿Cómo quieres pagar?</div>
            <div className="pay-methods">
              {methods.map((m) => (
                <button key={m.id} type="button" className={`pay-card${payMethod === m.id ? " act" : ""}`} onClick={() => setPayMethod(m.id)}>
                  <img className="pay-card-logo" src={m.logo} alt={m.name} />
                  <span className="pay-desc">{m.desc}</span>
                  <span className="pay-badge">{m.badge}</span>
                  <span className="pay-check">✓</span>
                </button>
              ))}
            </div>
          </div>

          {/* DERECHA — resumen del pedido */}
          <aside className="co-summary">
            <div className="co-sum-t">Tu pedido</div>
            <div className="co-items">
              {checkoutItems.map((it, i) => (
                <div key={i} className="co-item">
                  <div className="co-item-img">{it.image ? <img src={it.image} alt={it.name} /> : <NoImg />}</div>
                  <div className="co-item-info">
                    <div className="co-item-name">{it.name}</div>
                    <div className="co-item-sub">{it.brand}{it.size ? ` · ${it.size}` : ""} · x{it.qty}</div>
                  </div>
                  <div className="co-item-price">{cop(it.price * it.qty)}</div>
                </div>
              ))}
            </div>
            {promoDiscount > 0 && (
              <div className="co-coupon">
                <div className="co-coupon-on">
                  <div className="co-coupon-on-info">
                    <span className="co-coupon-tag">🎟️ 2 × $300.000</span>
                    <span className="co-coupon-desc">−{cop(PROMO_UNIT_DISCOUNT)} por perfume ({promoUnits} en tu pedido) · aplicado automáticamente</span>
                  </div>
                </div>
              </div>
            )}
            {promoUnits === 1 && (
              <div className="co-coupon">
                <div className="co-ship-hint">Agrega 1 perfume más de la sección <b>2 × $300.000</b> y llévate los 2 por $300.000 🎉</div>
              </div>
            )}
            {appliedCoupon && (
              <div className="co-coupon">
                <div className="co-coupon-on">
                  <div className="co-coupon-on-info">
                    <span className="co-coupon-tag">🎟️ {appliedCoupon.code}</span>
                    <span className="co-coupon-desc">{couponLabel(appliedCoupon)} · aplicado automáticamente</span>
                  </div>
                </div>
              </div>
            )}
            <div className="co-breakdown">
              <div className="co-brow"><span>Subtotal</span><span>{cop(subtotal)}</span></div>
              {promoDiscount > 0 && <div className="co-brow disc"><span>Promo 2 × $300.000 ({promoUnits} {promoUnits === 1 ? "perfume" : "perfumes"})</span><span>−{cop(promoDiscount)}</span></div>}
              {couponDisc > 0 && <div className="co-brow disc"><span>Descuento{appliedCoupon ? ` (${appliedCoupon.code})` : ""}</span><span>−{cop(couponDisc)}</span></div>}
              <div className="co-brow">
                <span>Envío {coForm.city ? `(${coForm.city === SHIPPING.otherLabel ? (coForm.cityCustom.trim() || "otra ciudad") : coForm.city})` : ""}</span>
                <span>{!coForm.city ? <span style={{ color: "var(--gold)", fontSize: 12, fontWeight: 700 }}>Elige tu ciudad</span> : shipping === 0 ? <b className="co-free">GRATIS</b> : cop(shipping)}</span>
              </div>
              {coForm.city === "Bogotá" && shipping > 0 && freeLeft > 0 && (
                <div className="co-ship-hint">Agrega {cop(freeLeft)} más y tu envío en Bogotá es gratis 🎉</div>
              )}
            </div>
            <div className="co-total-row"><span>Total a pagar</span><span className="co-total">{cop(total)}</span></div>
            {payMethod === "addi" && PAYMENTS.addi.enabled ? (
              <div className="co-addi" onClickCapture={captureAddiOrder}>
                <p className="co-addi-lead">Solicita tu cupo en minutos, 100% en línea. Al aprobarte, Addi paga tu compra y tú la difieres a cuotas.</p>
                <AddiWidget price={total} className="co-addi-w" />
                <p className="co-addi-note">Toca el botón de Addi para conocer tus cuotas y continuar.</p>
              </div>
            ) : (
              <>
                <button className="co-pay-btn" onClick={placeOrder} disabled={placing}>
                  {placing ? "Redirigiendo a la pasarela…" : `Pagar con ${activeName}`}
                </button>
                <div className="co-secure">🔒 Pago seguro · Envío gratis en Bogotá desde {cop(SHIPPING.bogotaFreeFrom)}</div>
              </>
            )}
            <a className="co-help" href={waLink("Hola Rey del Aroma 👑, tengo una duda con mi compra.")} target="_blank" rel="noreferrer">¿Tienes dudas? Escríbenos</a>
          </aside>
        </div>
      </div>
    );
  };

  /* ── VISTA ADMIN ── */
  const AdminView = () => {
    if (!adminAuth) {
      return (
        <div className="login-screen">
          <div className="login-card">
            <img src={logoPrincipal} className="login-logo" alt="Rey del Aroma" />
            <div className="login-title">Panel <span>Admin</span></div>
            <div className="login-sub">Ingresa la contraseña para continuar</div>
            <div className="login-form">
              <input className="login-input" type="password" placeholder="Contraseña" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adminLogin()} autoFocus />
              <button className="login-btn" onClick={adminLogin}>Ingresar →</button>
            </div>
          </div>
        </div>
      );
    }

    if (adminView === "form") {
      return (
        <div className="admin-wrap">
          <div className="admin-hdr">
            <div className="admin-title">{editingId ? "Editar" : "Agregar"} <span>Producto</span></div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-o" onClick={() => setAdminView("list")}>← Volver</button>
              <button className="btn-g" onClick={saveProduct}>Guardar</button>
            </div>
          </div>
          <div className="form-g">
            <div className="fg"><label className="fl">Nombre *</label><input className="fi" placeholder="ej. Sauvage" value={form.name} onChange={setF("name")} /></div>
            <div className="fg"><label className="fl">Marca</label><input className="fi" placeholder="ej. Dior" value={form.brand} onChange={setF("brand")} /></div>
            <div className="fg"><label className="fl">Precio (COP) *</label><input className="fi" type="number" placeholder="190000" value={form.price} onChange={setF("price")} /></div>
            <div className="fg"><label className="fl">Subtítulo</label><input className="fi" placeholder="ej. Eau de Parfum" value={form.subtitle} onChange={setF("subtitle")} /></div>
            <div className="fg"><label className="fl">Presentación</label><input className="fi" placeholder="ej. 100 ml" value={form.size} onChange={setF("size")} /></div>
            <div className="fg">
              <label className="fl">Categoría</label>
              <select className="fsel" value={form.category} onChange={setF("category")}>
                <option>Hombre</option><option>Mujer</option><option>Unisex</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Colección</label>
              <select className="fsel" value={form.collection} onChange={setF("collection")}>
                {collectionList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Tipo de aroma</label>
              <select className="fsel" value={form.tag} onChange={setF("tag")}>
                <option value="">— Sin etiqueta —</option>
                {aromaList.map((fam) => (
                  <option key={fam} value={fam}>{FAMILY_META[fam]?.emoji || "✨"} {fam}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Promoción</label>
              <label className="fchk"><input type="checkbox" checked={form.promo} onChange={(e) => setForm((f) => ({ ...f, promo: e.target.checked }))} /> Incluir en 2 × $300.000</label>
            </div>
            <div className="fg full">
              <label className="fl">Imagen principal (portada)</label>
              {form.image ? (
                <div className="img-preview">
                  <img src={form.image} alt="Vista previa" />
                  <button className="img-preview-rm" onClick={() => setForm((f) => ({ ...f, image: "", img: "" }))}>✕</button>
                </div>
              ) : (
                <div className="img-upload">
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                  <div className="img-upload-icon">📷</div>
                  <div className="img-upload-text">Haz clic o arrastra una imagen</div>
                  <div className="img-upload-text" style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>JPG, PNG, WebP · se optimiza sola</div>
                </div>
              )}
            </div>
            <div className="fg full">
              <label className="fl">Más fotos del producto (galería)</label>
              <div className="multi-img">
                {(form.images || []).map((src, i) => (
                  <div className="multi-img-item" key={i}>
                    <img src={src} alt={`Foto ${i + 1}`} />
                    <button type="button" className="multi-img-rm" onClick={() => removeGalleryImage(i)} aria-label="Quitar foto">✕</button>
                    <button type="button" className="multi-img-cover" onClick={() => makeGalleryCover(i)} title="Usar como portada">★ Portada</button>
                  </div>
                ))}
                <label className="multi-img-add">
                  <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} />
                  <span className="multi-img-add-ic">＋</span>
                  <span className="multi-img-add-tx">Agregar fotos</span>
                </label>
              </div>
              <div className="multi-img-hint">Se muestran como miniaturas en la página del producto, junto a la portada. Puedes subir varias a la vez (se optimizan automáticamente). JPG, PNG, WebP.</div>
            </div>
            <div className="fg full"><label className="fl">Descripción</label><textarea className="fta" placeholder="Descripción de la fragancia (opcional)" value={form.description} onChange={setF("description")} /></div>
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
            <button className="btn-o" onClick={() => setAdminView("list")}>Cancelar</button>
            <button className="btn-g" onClick={saveProduct}>Guardar producto</button>
          </div>
        </div>
      );
    }

    if (adminView === "taxonomy") {
      return (
        <div className="admin-wrap">
          <div className="admin-hdr">
            <div className="admin-title">Colecciones y <span>Aromas</span></div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-o" onClick={() => setAdminView("list")}>← Volver</button>
            </div>
          </div>
          <div className="admin-info">Crea tus propias colecciones y tipos de aroma. Aparecerán automáticamente en el formulario al agregar o editar un producto. Se guardan en este navegador.</div>

          <div className="tax-grid">
            {/* Colecciones */}
            <div className="tax-card">
              <div className="tax-card-t">Colecciones</div>
              <div className="tax-card-sub">Ej. Diseñador, Árabes, Nicho…</div>
              <div className="tax-add">
                <input className="fi" placeholder="Nueva colección" value={newCollection} onChange={(e) => setNewCollection(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCollection()} />
                <button className="coupon-add-btn" onClick={addCollection}>+ Crear</button>
              </div>
              <div className="tax-list">
                {collectionList.length > 0 ? collectionList.map((c) => (
                  <div key={c} className="tax-item">
                    <span className="tax-item-name">{c}</span>
                    <button className="tax-rm" onClick={() => deleteCollection(c)}>Eliminar</button>
                  </div>
                )) : <div className="tax-empty">Aún no hay colecciones.</div>}
              </div>
            </div>

            {/* Tipos de aroma */}
            <div className="tax-card">
              <div className="tax-card-t">Tipos de <span>aroma</span></div>
              <div className="tax-card-sub">Ej. Amaderado, Floral, Cítrico…</div>
              <div className="tax-add">
                <input className="fi" placeholder="Nuevo tipo de aroma" value={newAroma} onChange={(e) => setNewAroma(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAroma()} />
                <button className="coupon-add-btn" onClick={addAroma}>+ Crear</button>
              </div>
              <div className="tax-list">
                {aromaList.length > 0 ? aromaList.map((a) => (
                  <div key={a} className="tax-item">
                    <span className="tax-item-name">{FAMILY_META[a]?.emoji || "✨"} {a}</span>
                    <button className="tax-rm" onClick={() => deleteAroma(a)}>Eliminar</button>
                  </div>
                )) : <div className="tax-empty">Aún no hay tipos de aroma.</div>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (adminView === "coupons") {
      return (
        <div className="admin-wrap">
          <div className="admin-hdr">
            <div className="admin-title">Gestión de <span>Cupones</span></div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-o" onClick={() => setAdminView("list")}>← Volver</button>
            </div>
          </div>
          <div className="admin-info">Crea cupones de descuento. El cupón activo se aplica <b>automáticamente</b> al pagar (el cliente no escribe ningún código). Si activas varios, se aplica el más reciente. Se guardan en este navegador.</div>

          <div className="coupon-create">
            <div className="fg">
              <label className="fl">Código del cupón *</label>
              <input className="fi" placeholder="EJ. BIENVENIDO10" value={couponForm.code} onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div className="fg">
              <label className="fl">Tipo de descuento</label>
              <select className="fsel" value={couponForm.type} onChange={(e) => setCouponForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="percent">Porcentaje (%)</option>
                <option value="fixed">Monto fijo (COP)</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">{couponForm.type === "percent" ? "Porcentaje (1–100)" : "Monto en pesos"}</label>
              <input className="fi" type="number" placeholder={couponForm.type === "percent" ? "10" : "20000"} value={couponForm.value} onChange={(e) => setCouponForm((f) => ({ ...f, value: e.target.value }))} />
            </div>
            <button className="coupon-add-btn" onClick={addCoupon}>+ Crear cupón</button>
          </div>

          {coupons.length > 0 ? (
            <table className="atbl">
              <thead>
                <tr><th>Código</th><th>Descuento</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td><div className="atn">🎟️ {c.code}</div></td>
                    <td className="atp">{couponLabel(c)}</td>
                    <td><span className={`coupon-state${c.active ? " on" : ""}`}>{c.active ? "Activo" : "Inactivo"}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="abtn abtn-e" onClick={() => toggleCoupon(c.id)}>{c.active ? "Desactivar" : "Activar"}</button>
                      <button className="abtn abtn-d" onClick={() => deleteCoupon(c.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: "center", padding: "80px", color: "#999" }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🎟️</div>
              <p>Aún no has creado cupones. Crea el primero arriba.</p>
            </div>
          )}
        </div>
      );
    }

    if (adminView === "ventas") {
      const fmtDay = (iso) => new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
      const fmtDayLong = (iso) => new Date(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
      const fmtWhen = (iso) => new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const todayK = fmtDay(new Date().toISOString());

      const byDay = {};
      orders.forEach((o) => {
        const k = fmtDay(o.date);
        if (!byDay[k]) byDay[k] = { count: 0, total: 0, last: o.date };
        byDay[k].count++;
        byDay[k].total += Number(o.total) || 0;
        if (o.date > byDay[k].last) byDay[k].last = o.date;
      });
      const todayTotal = byDay[todayK]?.total || 0;
      const todayCount = byDay[todayK]?.count || 0;
      const allTotal = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const allCount = orders.length;
      const avg = allCount ? Math.round(allTotal / allCount) : 0;

      const last7 = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const k = fmtDay(d.toISOString());
        return {
          k,
          dow: d.toLocaleDateString("es-CO", { weekday: "short" }),
          dm: d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
          total: byDay[k]?.total || 0,
          count: byDay[k]?.count || 0,
          isToday: k === todayK,
        };
      });
      const maxBar = Math.max(1, ...last7.map((d) => d.total));
      const daysSorted = Object.entries(byDay).sort((a, b) => new Date(b[1].last) - new Date(a[1].last));
      const ordersDesc = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));
      const hasToken = !!adminToken.trim();
      const connect = () => {
        const v = tokenInput.trim();
        setAdminToken(v);
        try { localStorage.setItem(LS_ADMIN_TOKEN, v); } catch { /* ignore */ }
        fetchOrders(v);
      };

      return (
        <div className="admin-wrap">
          <div className="admin-hdr">
            <div className="admin-title">Ventas en <span>tiempo real</span></div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-o" onClick={() => setAdminView("list")}>← Volver</button>
            </div>
          </div>

          <div className="vt-token">
            <div className="fg">
              <label className="fl">Token de administrador</label>
              <input
                className="fi"
                type="password"
                placeholder="Pega aquí tu ADMIN_TOKEN"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
              />
            </div>
            <button className="btn-g" onClick={connect}>Conectar</button>
          </div>

          {ordersError && <div className="vt-err">{ordersError}</div>}

          {hasToken && !ordersError && (
            <>
              <div className="vt-livebar">
                <span className="vt-live"><span className="vt-dot" /> En vivo · se actualiza solo cada 10 s{ordersUpdatedAt ? ` · última: ${ordersUpdatedAt.toLocaleTimeString("es-CO")}` : ""}</span>
                <button className="vt-refresh" onClick={() => fetchOrders()}>{ordersLoading ? "Actualizando…" : "↻ Actualizar"}</button>
              </div>

              <div className="vt-kpis">
                <div className="vt-kpi hot">
                  <div className="vt-kpi-l">Ventas de hoy</div>
                  <div className="vt-kpi-v"><span>{cop(todayTotal)}</span></div>
                  <div className="vt-kpi-s">{todayCount} {todayCount === 1 ? "pedido" : "pedidos"} hoy</div>
                </div>
                <div className="vt-kpi">
                  <div className="vt-kpi-l">Total histórico</div>
                  <div className="vt-kpi-v">{cop(allTotal)}</div>
                  <div className="vt-kpi-s">{allCount} {allCount === 1 ? "pedido" : "pedidos"} en total</div>
                </div>
                <div className="vt-kpi">
                  <div className="vt-kpi-l">Ticket promedio</div>
                  <div className="vt-kpi-v">{cop(avg)}</div>
                  <div className="vt-kpi-s">por pedido</div>
                </div>
              </div>

              <div className="vt-sec-t">Últimos <span>7 días</span></div>
              <div className="vt-bars">
                {last7.map((d) => (
                  <div key={d.k} className="vt-bar-col">
                    <div className="vt-bar-val">{d.total > 0 ? cop(d.total) : ""}</div>
                    <div className="vt-bar-wrap">
                      <div className={`vt-bar${d.isToday ? " today" : ""}`} style={{ height: `${Math.round((d.total / maxBar) * 100)}%` }} title={`${d.count} pedidos · ${cop(d.total)}`} />
                    </div>
                    <div className="vt-bar-day">{d.dow}<br />{d.dm}</div>
                  </div>
                ))}
              </div>

              <div className="vt-sec-t">Ventas por <span>día</span></div>
              {daysSorted.length > 0 ? daysSorted.map(([k, v]) => (
                <div key={k} className="vt-day-row">
                  <div>
                    <div className="vt-day-d">{fmtDayLong(v.last)}{k === todayK ? " · hoy" : ""}</div>
                    <div className="vt-day-c">{v.count} {v.count === 1 ? "pedido" : "pedidos"}</div>
                  </div>
                  <div className="vt-day-t">{cop(v.total)}</div>
                </div>
              )) : <div className="vt-empty"><div className="emoji">🧾</div><p>Aún no hay ventas registradas.</p></div>}

              <div className="vt-sec-t" style={{ marginTop: 30 }}>Pedidos <span>recientes</span></div>
              {ordersDesc.length > 0 ? (
                <table className="atbl vt-tbl">
                  <thead>
                    <tr><th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Productos</th><th>Pago</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {ordersDesc.map((o, idx) => {
                      const c = o.customer || {};
                      return (
                        <tr key={o.reference || idx}>
                          <td className="vt-when">{fmtWhen(o.date)}</td>
                          <td>
                            <span className="vt-id">ID: {c.cedula || "—"}</span>
                            <div className="vt-ref">{o.reference}</div>
                          </td>
                          <td>
                            <div className="vt-cust-n">{c.name || "—"}</div>
                            <div className="vt-cust-s">{c.phone || ""}{c.city ? ` · ${c.city}` : ""}{c.email ? ` · ${c.email}` : ""}{c.address ? <><br />{c.address}</> : ""}</div>
                          </td>
                          <td><div className="vt-items">{(o.items || []).map((it) => `${it.qty}× ${it.name}`).join(", ") || "—"}</div></td>
                          <td><span className="vt-pay">{o.method || "—"}</span></td>
                          <td className="vt-tot">{cop(o.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="vt-empty"><div className="emoji">🛍️</div><p>Cuando un cliente complete una compra, aparecerá aquí al instante.</p></div>}
            </>
          )}

          {!hasToken && !ordersError && (
            <div className="admin-info">Escribe tu <b>token de administrador</b> arriba y pulsa “Conectar” para ver las ventas. Es el mismo valor que configures como <b>ADMIN_TOKEN</b> en Netlify.</div>
          )}
        </div>
      );
    }

    return (
      <div className="admin-wrap">
        <div className="admin-hdr">
          <div className="admin-title">Panel de <span>Administración</span></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn-g" onClick={() => setAdminView("ventas")}>📊 Ventas</button>
            <button className="btn-o" onClick={() => setAdminView("taxonomy")}>🗂️ Colecciones y aromas</button>
            <button className="btn-o" onClick={() => setAdminView("coupons")}>🎟️ Cupones</button>
            <button className="btn-o" onClick={resetCatalog}>Restaurar catálogo</button>
            <button className="btn-o" onClick={() => { setAdminAuth(false); setView("store"); }}>Salir</button>
            <button className="btn-g" onClick={startAdd}>+ Agregar</button>
          </div>
        </div>
        <div className="admin-info"><b>{products.length}</b> productos en catálogo · Los cambios se guardan automáticamente en este navegador (localStorage).</div>
        <table className="atbl">
          <thead>
            <tr><th></th><th>Producto</th><th>Precio</th><th>Categoría</th><th>Colección</th><th>Promo</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.image ? <img className="athumb" src={p.image} alt={p.name} /> : <div className="athumb" />}</td>
                <td><div className="atn">{p.name}</div><div className="ats">{p.brand}{p.subtitle ? ` · ${p.subtitle}` : ""}</div></td>
                <td className="atp">{cop(p.price)}</td>
                <td className="atc">{p.category}</td>
                <td className="atc">{p.collection}</td>
                <td>{p.promo ? <span style={{ background: "rgba(201,168,76,.12)", color: "var(--gold-d)", fontSize: 11, padding: "4px 8px", letterSpacing: 1, fontWeight: 700, whiteSpace: "nowrap" }}>2×300K</span> : <span style={{ color: "#bbb" }}>—</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="abtn abtn-e" onClick={() => startEdit(p)}>Editar</button>
                  <button className="abtn abtn-d" onClick={() => deleteProduct(p.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px", color: "#999" }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📦</div>
            <p>No hay productos. Agrega el primero o restaura el catálogo.</p>
          </div>
        )}
      </div>
    );
  };

  /* ── RENDER ── */
  return (
    <div className={`app-root${appReady ? " ready" : ""}`} style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {view !== "admin" && (
        <div className="announce">
          <div className="ann-track">
            {[...announceItems, ...announceItems].map((item, i) => (
              <div key={i} className="ann-i"><span>{item.icon}</span><em>{item.text}</em><div className="ann-sep" /></div>
            ))}
          </div>
        </div>
      )}

      <nav className="nav">
        {view !== "admin" ? (
          <>
            {/* IZQUIERDA — botón de menú */}
            <div className="nav-left">
              <button className={`hamburger${menuOpen ? " open" : ""}`} onClick={() => { setMenuOpen((o) => !o); setSearchOpen(false); }} aria-label="Menú" aria-expanded={menuOpen}>
                <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
              </button>
            </div>

            {/* CENTRO — logo */}
            <div className="nav-logo nav-logo-c" onClick={() => { setView("store"); setCatFilter("Todos"); setSearch(""); setMenuOpen(false); try { window.history.replaceState({}, "", homeUrl()); } catch { /* ignore */ } window.scrollTo({ top: 0 }); }}>
              <img className="nav-logo-img" src={logoPrincipal} alt="Rey del Aroma" />
              <div className="nav-logo-text"><span className="l-rey">REY</span><span className="l-da">DEL AROMA</span></div>
            </div>

            {/* DERECHA — buscar + carrito */}
            <div className="nav-r">
              <button className={`icon-btn${searchOpen ? " act" : ""}`} onClick={() => { setSearchOpen((o) => !o); setMenuOpen(false); }} aria-label="Buscar">🔍</button>
              <button className="icon-btn" onClick={() => setCartOpen(true)} aria-label="Carrito">🛒 {cartCount > 0 && <span className="cbadge">{cartCount}</span>}</button>
            </div>

            {/* Menú desplegable */}
            <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
              <a className="nl" href={homeUrl()} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Inicio</a>
              <a className="nl nl-promo" href={categoryUrl("2 × $300.000")} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}><span className="nl-flame">🔥</span><span className="nl-promo-txt">2 × $300.000</span><span className="nl-flame nl-flame2">🔥</span></a>
              <a className="nl" href={homeUrl()} onClick={(e) => { e.preventDefault(); quickFilter("Todos"); setMenuOpen(false); }}>Catálogo</a>
              <a className="nl" href={categoryUrl("Hombre")} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Hombre</a>
              <a className="nl" href={categoryUrl("Mujer")} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Mujer</a>
              <a className="nl" href={categoryUrl("Unisex")} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Unisex</a>
              <a className="nl" href={categoryUrl("Diseñador")} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Diseñador</a>
              <a className="nl" href={categoryUrl("Árabes")} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Árabes</a>
            </div>
          </>
        ) : (
          <>
            <div className="nav-logo" onClick={() => { setView("store"); setCatFilter("Todos"); setSearch(""); setMenuOpen(false); try { window.history.replaceState({}, "", homeUrl()); } catch { /* ignore */ } window.scrollTo({ top: 0 }); }}>
              <img className="nav-logo-img" src={logoPrincipal} alt="Rey del Aroma" />
              <div className="nav-logo-text"><span className="l-rey">REY</span><span className="l-da">DEL AROMA</span></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 12, color: "#aaa", letterSpacing: 2.5, textTransform: "uppercase" }}>Administración</span>
              <button className="nl" onClick={() => setView("store")}>← Volver a la tienda</button>
            </div>
          </>
        )}
      </nav>

      {view !== "admin" && searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Buscar nuestro sitio">
          <div className="search-backdrop" onClick={() => { setSearch(""); setSearchOpen(false); }} />
          <div className="search-panel">
            <div className="search-panel-inner">
              <div className="search-panel-head">
                <span className="search-panel-title">Buscar nuestro sitio</span>
                <button className="search-panel-x" onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda">✕</button>
              </div>
              <div className="search-field">
                <input
                  className="search-input"
                  autoFocus
                  type="text"
                  placeholder="Buscar"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                    if (e.key === "Escape") { setSearch(""); setSearchOpen(false); }
                  }}
                  aria-label="Buscar productos"
                />
                {search && <button className="search-clear" onClick={() => setSearch("")} aria-label="Limpiar">✕</button>}
                <span className="search-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              {q && (
                <div className="search-results">
                  {searchResults.length > 0 ? (
                    <>
                      {searchResults.map((p) => (
                        <button key={p.id} className="sr-item" onClick={() => { openProduct(p); setSearchOpen(false); }}>
                          <span className="sr-img">{p.image ? <img src={p.image} alt={p.name} /> : <span className="sr-noimg">🧴</span>}</span>
                          <span className="sr-info">
                            <span className="sr-name">{p.name}</span>
                            <span className="sr-sub">{p.brand}{p.tag ? ` · ${FAMILY_META[p.tag]?.emoji || ""} ${p.tag}` : ""}</span>
                          </span>
                          <span className="sr-price">{cop(p.price)}</span>
                        </button>
                      ))}
                      <button className="sr-all" onClick={submitSearch}>Ver todos los resultados de “{search.trim()}” →</button>
                    </>
                  ) : (
                    <div className="sr-empty">No encontramos perfumes para “{search.trim()}”. Prueba con otra marca o tipo de aroma.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "store" && StoreView()}
      {view === "category" && CategoryView()}
      {view === "search" && SearchView()}
      {view === "filtros" && FilterResultsView()}
      {view === "product" && ProductDetailView()}
      {view === "checkout" && CheckoutView()}
      {view === "pago-resultado" && PaymentResultView()}
      {view === "admin" && AdminView()}

      {/* ── PANEL DE FILTROS (cajón lateral) ── */}
      {view !== "admin" && filtersOpen && (
        <>
          <div className="filt-overlay" onClick={() => setFiltersOpen(false)} />
          <div className="filt-drawer" role="dialog" aria-modal="true" aria-label="Filtros">
            <div className="filt-head">
              <div className="filt-head-l">
                <span className="filt-title">Filtrar <span>perfumes</span></span>
              </div>
              <button className="filt-x" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">✕</button>
            </div>

            <div className="filt-body">
              {/* AROMA */}
              <div className="filt-sec">
                <div className="filt-sec-t">✨ Aroma</div>
                <div className="filt-chips">
                  <button className={`filt-chip${fAroma === "Todos" ? " act" : ""}`} onClick={() => setFAroma("Todos")}>Todos</button>
                  {availableAromas.map((fam) => (
                    <button key={fam} className={`filt-chip${fAroma === fam ? " act" : ""}`} onClick={() => setFAroma(fam)}>
                      <span>{FAMILY_META[fam]?.emoji || "✨"}</span>{fam}
                    </button>
                  ))}
                </div>
              </div>

              {/* SEXO */}
              <div className="filt-sec">
                <div className="filt-sec-t">⚥ Sexo</div>
                <div className="filt-chips">
                  {["Todos", "Hombre", "Mujer", "Unisex"].map((s) => (
                    <button key={s} className={`filt-chip${fSex === s ? " act" : ""}`} onClick={() => setFSex(s)}>{s}</button>
                  ))}
                </div>
              </div>

              {/* PRECIO */}
              <div className="filt-sec">
                <div className="filt-sec-t">💰 Precio</div>
                <div className="filt-price-vals">Desde <b>{cop(priceLo)}</b> hasta <b>{cop(priceHi)}</b></div>
                <div className="filt-range">
                  <div className="filt-range-track" />
                  <div
                    className="filt-range-fill"
                    style={{
                      left: `${((priceLo - priceBounds.min) / Math.max(1, priceBounds.max - priceBounds.min)) * 100}%`,
                      right: `${(1 - (priceHi - priceBounds.min) / Math.max(1, priceBounds.max - priceBounds.min)) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={10000}
                    value={priceLo}
                    onChange={(e) => setPriceLo(Math.min(Number(e.target.value), priceHi - 10000))}
                    aria-label="Precio mínimo"
                  />
                  <input
                    type="range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={10000}
                    value={priceHi}
                    onChange={(e) => setPriceHi(Math.max(Number(e.target.value), priceLo + 10000))}
                    aria-label="Precio máximo"
                  />
                </div>
              </div>

              {/* CATEGORÍA */}
              <div className="filt-sec">
                <div className="filt-sec-t">🏷️ Categoría</div>
                <div className="filt-chips">
                  <button className={`filt-chip${fCat === "Todos" ? " act" : ""}`} onClick={() => setFCat("Todos")}>Todos</button>
                  {catOptions.map((c) => (
                    <button key={c} className={`filt-chip${fCat === c ? " act" : ""}`} onClick={() => setFCat(c)}>{c}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filt-foot">
              <button className="filt-clear-btn" onClick={clearFilters}>Limpiar filtros</button>
              <button className="filt-apply" onClick={applyFilters}>Ver {panelResults.length} resultado{panelResults.length !== 1 ? "s" : ""}</button>
            </div>
          </div>
        </>
      )}

      {cartOpen && (
        <>
          <div className="cart-overlay" onClick={() => setCartOpen(false)} />
          <div className="cart-drawer">
            <div className="cart-hdr">
              <div className="cart-title">Carrito {cartCount > 0 && <span style={{ color: "var(--gold)", fontSize: 17 }}>({cartCount})</span>}</div>
              <button className="cart-x" onClick={() => setCartOpen(false)}>✕</button>
            </div>
            <div className="cart-body">
              {cart.length === 0 ? (
                <div className="empty-cart"><div className="empty-icon">🛒</div><p style={{ fontSize: 15, letterSpacing: 1 }}>Tu carrito está vacío</p></div>
              ) : cart.map((item, i) => (
                <div key={i} className="ci">
                  <div className="ci-img">{item.image ? <img src={item.image} alt={item.name} className="ci-real-img" /> : <NoImg />}</div>
                  <div className="ci-info">
                    <div className="ci-name">{item.name}</div>
                    <div className="ci-sz">{item.brand}{item.size ? ` · ${item.size}` : ""}</div>
                    <div className="ci-row">
                      <div className="ci-qty">
                        <button className="ci-qbtn" onClick={() => updateQty(item.id, item.size, -1)} disabled={item.qty <= 1} aria-label="Quitar uno">−</button>
                        <span className="ci-qn">{item.qty}</span>
                        <button className="ci-qbtn" onClick={() => updateQty(item.id, item.size, 1)} aria-label="Agregar uno">+</button>
                      </div>
                      <div className="ci-price">{cop(item.price * item.qty)} COP</div>
                    </div>
                  </div>
                  <button className="ci-rm" onClick={() => removeFromCart(item.id, item.size)} aria-label="Eliminar producto">✕</button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="cart-foot">
                {(cartPromoDiscount > 0 || cartCouponDisc > 0) && (
                  <div className="cart-bd">
                    <div className="cart-bd-row"><span>Subtotal</span><span>{cop(cartTotal)}</span></div>
                    {cartPromoDiscount > 0 && <div className="cart-bd-row disc"><span>Promo 2 × $300.000 ({cartPromoUnits} {cartPromoUnits === 1 ? "perfume" : "perfumes"})</span><span>−{cop(cartPromoDiscount)}</span></div>}
                    {cartCouponDisc > 0 && <div className="cart-bd-row disc"><span>Descuento{appliedCoupon ? ` (${appliedCoupon.code})` : ""}</span><span>−{cop(cartCouponDisc)}</span></div>}
                  </div>
                )}
                <div className="cart-tr"><span className="cart-tl">Total</span><span className="cart-ta">{cop(cartFinalTotal)}</span></div>
                {cartTotal >= SHIPPING.bogotaFreeFrom ? (
                  <div className="cart-ship free">🎉 ¡Tu envío en Bogotá es <b>GRATIS</b>!</div>
                ) : (
                  <div className="cart-ship">🚚 Envío <b>GRATIS</b> a Bogotá a partir de {cop(SHIPPING.bogotaFreeFrom)} · te faltan {cop(SHIPPING.bogotaFreeFrom - cartTotal)}</div>
                )}
                {cartPromoUnits === 1 && (
                  <div className="cart-ship">🎁 Agrega 1 perfume más de la promo <b>2 × $300.000</b> y ahorra {cop(PROMO_UNIT_DISCOUNT * 2)}</div>
                )}
                <div className="cart-seals">
                  <div className="cart-seal"><span className="cart-seal-ic">💎</span><span className="cart-seal-tx">100%<br />Original</span></div>
                  <div className="cart-seal"><span className="cart-seal-ic">🔒</span><span className="cart-seal-tx">Pago<br />seguro</span></div>
                  <div className="cart-seal"><span className="cart-seal-ic">🚚</span><span className="cart-seal-tx">Envío a toda<br />Colombia</span></div>
                </div>
                <div className="cart-pays">
                  <PayBadges className="sm" />
                </div>
                <button className="co-checkout-btn" onClick={() => goCheckout(cart)}>Finalizar compra →</button>
                <button className="cart-more" onClick={() => setCartOpen(false)}>
                  <span className="cart-more-main">🎁 Agregar otro perfume</span>
                  <span className="cart-more-sub">Aprovecha nuestras promociones</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {view !== "admin" && !cartOpen && (
        <a
          className="wa-float"
          href={waLink("Hola Rey del Aroma 👑, quiero más información sobre sus perfumes.")}
          target="_blank"
          rel="noreferrer"
          aria-label="Escríbenos por WhatsApp"
          title="Escríbenos por WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </a>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
