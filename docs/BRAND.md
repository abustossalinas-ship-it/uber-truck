# Cubik — identidad visual

**Eslogan (logo):** Optimiza tus envíos  
**Subtítulo producto:** Conecta cubicación disponible con demanda en tiempo real  
**Logo:** `public/brand/logo.png` (fondo negro + isotipo 3D naranja/azul)

## Colorimetría (extraída del logo)

| Token | HEX | Uso |
|-------|-----|-----|
| **Navy** | `#0F2744` | Texto principal, bordes header, barra demo, theme PWA |
| **Navy oscuro** | `#09182A` | Fondos oscuros, borde botones CTA |
| **Navy medio** | `#1A3D66` | Hover links, énfasis secundario |
| **Naranja** | `#F7941D` | CTAs, tagline, acentos primarios |
| **Naranja oscuro** | `#D97A08` | Hover botones |
| **Naranja claro** | `#FFB84D` | Highlights |
| **Azul** | `#29ABE2` | Acento secundario (isotipo), pills info |
| **Azul oscuro** | `#1E8FBF` | Hover secundario |
| **Negro** | `#000000` | Fondo del logo (contenedor `.brand-logo-wrap`) |
| **Gris fondo** | `#F4F7FB` | Fondo página |

### CSS (`public/theme.css`)

```css
--brand-navy: #0f2744;
--brand-orange: #f7941d;
--brand-blue: #29abe2;
--accent: var(--brand-orange);
--accent-secondary: var(--brand-blue);
--text: var(--brand-navy);
```

## Isotipo

Hexágono 3D: bloques naranja, celeste y navy — comunica **cubicación / volumen / espacio**.

## Play Store / Android

Regenerar iconos launcher en Android Studio → Image Asset con `logo.png`.  
Guía: [CUBIK-PLAY-STORE.md](./CUBIK-PLAY-STORE.md)

## Shortlist marcas (referencia)

Cubik ✓ · Trayek · FlowCargo · RutaGo · Andes Flow
