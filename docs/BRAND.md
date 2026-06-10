# Cubik — identidad visual

**Eslogan:** Optimiza tus envíos  
**Logo:** `public/brand/logo.png` (isotipo 3D + wordmark, **sin fondo negro**)

## Colorimetría (solo colores del logo)

| Token | HEX | Origen en logo |
|-------|-----|----------------|
| **Navy** | `#0F2744` | Texto «Cubik», bloque oscuro del isotipo |
| **Navy medio** | `#1A3D66` | Bordes, barra demo, profundidad |
| **Naranja** | `#F7941D` | Eslogan, bloque cálido del isotipo |
| **Naranja claro** | `#FFBA42` | Highlight superior del bloque naranja |
| **Celeste** | `#29ABE2` | Bloque azul del isotipo |
| **Celeste claro** | `#5EC4EF` | Highlight del bloque celeste |
| **Fondo app** | `#F4F7FB` | UI clara (no negro) |

**Regla:** no usar `#000000` en UI. El tono más oscuro es **navy** `#0A1C32`.

### Uso en UI

| Rol | Color |
|-----|--------|
| Texto | Navy |
| Fondos de página / cards | Blanco + gris azulado `#F4F7FB` |
| Barra admin / demo / viaje activo | Degradado navy → celeste |
| CTAs principales | Naranja sólido |
| CTAs secundarios | Borde navy, hover celeste |
| Info / hints | Fondo celeste suave + borde celeste |
| Montos a cobrar («Te deben») | Celeste oscuro (no verde) |
| Montos a pagar («Debes») | Naranja |

### CSS

Ver `:root` en `public/theme.css` — variables `--brand-navy`, `--brand-orange`, `--brand-blue`.

## Dominio vs marca

- **Marca producto:** Cubik (app, correos, stores).
- **Dominio web/correo:** puede ser variante (`cubikenvios.com`, etc.); no requiere renombrar la app.
- **Dominio producto:** `getcubik.cl` (HostGator DNS → Railway).
- `cubik.cl` y `cubik.com` siguen ocupados — ver [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md).

## Play Store

Iconos Android: Image Asset desde `logo.png`. Guía: [CUBIK-PLAY-STORE.md](./CUBIK-PLAY-STORE.md)
