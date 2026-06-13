# 👑 Rey del Aroma — Tienda de perfumes

Tienda web de perfumería (React + Vite), **responsive** para celular y computador, con tu
catálogo real, tus banners, promociones y **pedidos por WhatsApp**.

---

## ✅ Lo que incluye

- **45 productos reales** cargados desde tu catálogo (diseñador y árabes), con precios en **COP**.
- **Carrusel** con tus 3 banners (auto-avanza, con flechas y puntos).
- Franja de **íconos dorados** (destacados) tomados de tus imágenes.
- **Carrito** + **checkout por WhatsApp** (te arma el pedido y lo abre en WhatsApp).
- **Panel de administración** para agregar / editar / eliminar productos (se guarda en el navegador).
- Diseño dorado de lujo, totalmente **responsive** (celular, tablet y PC).

---

## 🚀 Cómo usarla

### Opción A — Subir la tienda ya construida (lo más rápido)
La carpeta **`dist/`** es la tienda lista para publicar. Súbela tal cual a tu hosting
(Hostinger, Netlify, Vercel, cPanel, etc.). En Netlify o Vercel puedes simplemente
**arrastrar la carpeta `dist`**. Eso es todo.

> Nota: no abras `dist/index.html` con doble clic (file://); súbela a un hosting o usa la Opción B.

### Opción B — Correr / editar el proyecto en tu computador
Necesitas tener **Node.js 18+** instalado.

    npm install      # instala dependencias (solo la primera vez)
    npm run dev      # abre la tienda en http://localhost:5173 (modo desarrollo)
    npm run build    # genera la carpeta dist/ lista para publicar
    npm run preview  # previsualiza la versión construida

---

## ✏️ Personalización rápida

Todo lo importante está al inicio del archivo **`src/ReyDelAroma.jsx`**:

    const WHATSAPP = "573189917571";   // tu número de WhatsApp (con 57 al inicio, sin + ni espacios)
    const ADMIN_PASSWORD = "admin123"; // cambia tu contraseña del panel de administración

- **Cambiar el número de WhatsApp:** edita `WHATSAPP`. Ya está puesto el tuyo: `573189917571`.
- **Cambiar la contraseña del admin:** edita `ADMIN_PASSWORD` (por defecto `admin123`).

Después de editar, vuelve a correr `npm run build` para actualizar la carpeta `dist/`.

---

## 🛠️ Panel de administración

1. Entra a la tienda y haz clic en el ícono **⚙️** (arriba a la derecha).
2. Ingresa la contraseña (`admin123` por defecto).
3. Desde ahí puedes **Agregar**, **Editar** o **Eliminar** productos, y subir fotos.
4. Los cambios se guardan **automáticamente en ese navegador** (localStorage).
5. El botón **"Restaurar catálogo"** vuelve a los 45 productos originales.

> Importante: como los cambios del admin se guardan en el navegador, sirven para gestionar
> el catálogo desde tu propio equipo. Si quieres que esos cambios queden fijos para todos
> los visitantes, edita los productos en `src/data/products.js` y vuelve a hacer `npm run build`.

---

## 📁 Estructura

    ├── dist/                  -> tienda construida, lista para publicar
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── ReyDelAroma.jsx    -> la tienda completa (config + diseño + logica)
        ├── data/products.js   -> los 45 productos (generado desde tu catalogo)
        └── assets/
            ├── products/      -> fotos de los perfumes (optimizadas)
            ├── banners/       -> tus 3 banners
            ├── featured/      -> iconos dorados destacados
            └── logo.png       -> tu logo

---

Hecho con amor para **Rey del Aroma**.
