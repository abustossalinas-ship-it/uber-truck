# Identidad visual — Uber Truck

**Eslogan:** Inteligencia en movimiento.

## Logo

| Uso | Ruta |
|-----|------|
| App / web | `public/brand/logo.png` |
| Favicon | `public/brand/logo.png` (mismo archivo) |

No modificar proporciones del isotipo. En fondos oscuros usar versión sobre blanco o contenedor blanco con borde redondeado (como el arte original).

## Colorimetría

Extraída del logo oficial (naranja camión / franja TRUCK, negro tipografía, blanco fondo).

| Token | HEX | Uso |
|-------|-----|-----|
| **Naranja primario** | `#F26522` | CTAs, pestaña activa, badges, acentos |
| **Naranja oscuro** | `#D95418` | Hover botones, estados pressed |
| **Naranja claro** | `#FF8A4C` | Highlights secundarios |
| **Negro** | `#000000` | Texto principal, títulos |
| **Blanco** | `#FFFFFF` | Fondos de tarjeta, header logo |
| **Gris 50** | `#F9FAFB` | Fondo página |
| **Gris 200** | `#E5E7EB` | Bordes, inputs |
| **Gris 700** | `#374151` | Texto secundario |

### CSS (implementado)

Variables en `public/theme.css`:

```css
--brand-orange: #f26522;
--brand-black: #000000;
--brand-white: #ffffff;
```

### Contraste

- Texto negro sobre blanco o gris 50: OK (WCAG AA).
- Texto blanco sobre naranja `#F26522`: usar solo en botones; verificar tamaño mínimo 14px bold.

## Tipografía

- **UI:** Segoe UI, Inter o system-ui — sans-serif, peso 600 en títulos.
- **Títulos marca:** mayúsculas solo en eslogan; “Uber Truck” en sentence case en UI.

## Componentes

| Elemento | Estilo |
|----------|--------|
| Botón primario | Fondo `#F26522`, texto negro o blanco según contraste |
| Botón secundario | Borde negro, fondo blanco |
| Tarjetas | Fondo blanco, sombra suave, radio 12px |
| Pills de estado | Fondo `rgba(242,101,34,0.12)`, texto naranja oscuro |

## Railway / favicon

Al desplegar, `public/brand/logo.png` se sirve en `/brand/logo.png`. No requiere CDN aparte en MVP.
