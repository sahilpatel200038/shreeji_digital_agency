# Design System

## 1. Brand colours (sampled from the logo PNG)

| Token | Hex | Source in logo | Use |
|---|---|---|---|
| `forest-900` (brand) | `#053620` | "SHREEJI" wordmark, tagline, globe base | Primary surface (hero, footer, buttons), headings |
| `bronze-500` (brand) | `#C27E2A` | "MARKETING" wordmark, divider | Accent, secondary CTA, highlights |
| `gold-500` | `#B47F2B` | Arrow tip | Deep gold gradient end |
| `gold-300` (brand) | `#F1DA4A` | Gradient highlight on globe/arrow | Glow, gradient highlight, accents on dark |

**Permitted variations** (tints/shades/alpha of the four brand colours only):
- Forest: `950 #032516` · `900 #053620` · `800 #0A4A2D` · `700 #14613D` · `100 #E3EEE7` · `50 #F1F6F3`.
- Bronze: `700 #8A5614` (text on light, AA) · `600 #A86A1E` · `500 #C27E2A` · `300 #E4B26A` · `100 #F7E9D2`.
- Gold: `300 #F1DA4A` · `200 #F6E88F`.
- Brand gradient (mirrors the logo mark): `linear-gradient(135deg, #053620 0%, #7A7A2E 45%, #F1DA4A 70%, #B47F2B 100%)` — decorative only (rules, glows, large display accents), never behind body text.
- Transparent: `forest-900/5…/90`, `bronze-500/10…/40`, `white/10…/70` for borders, glass and overlays.

**Neutrals (readability only):** warm paper `#FBF8F1` (page bg), `#FFFFFF` (cards), ink `#10261A` (a forest-tinted near-black for text), muted `#4D5F54`, border `#E3E7E1`. No blue, purple, red-as-brand or unrelated hues. Semantic states reuse neutrals + brand: success = forest-700, error = a muted brick `#9B2C1F` (**functional-only**, used solely for validation errors), warning = bronze-700.

**Contrast rules (WCAG 2.2 AA):**
- Body text on paper/white: `ink #10261A` (≈ 15:1).
- Bronze text on light must use `bronze-700 #8A5614` (≈ 5.8:1 on `#FBF8F1`). `bronze-500` is for large display text ≥ 24px, icons and fills only.
- On forest backgrounds: white / `#F1DA4A` / `#E4B26A` text (≥ 7:1).
- Buttons: primary = forest bg + white text; secondary = gold→bronze fill with forest text (≥ 6:1); outline = forest border/text.

## 2. Typography
- **Headings:** *Plus Jakarta Sans* (600–800), geometric and close in feel to the Montserrat-style logo wordmark. **Body:** *Inter* (400–600). Both via `next/font/google` (self-hosted at build, `display: swap`, no layout shift).
- Fluid scale (`clamp`):
  | Role | Size | Line-height |
  |---|---|---|
  | Display (H1 hero) | `clamp(2.5rem, 5.5vw + 1rem, 5rem)` | 1.05 |
  | H1 | `clamp(2.125rem, 3.5vw + 1rem, 3.5rem)` | 1.1 |
  | H2 | `clamp(1.75rem, 2.2vw + 1rem, 2.75rem)` | 1.15 |
  | H3 | `clamp(1.25rem, 1vw + 1rem, 1.625rem)` | 1.3 |
  | Body | 1rem (1.0625rem ≥ 1024px) | 1.7 |
  | Small | 0.875rem | 1.5 |
- Max line length for prose: 68ch. One `<h1>` per page.

## 3. Spacing & layout
- 4-px base grid (Tailwind scale). Section vertical rhythm: `py-16 md:py-24`. Container max width 1200px (prose 720px), side gutter 16px (mobile) / 24px (≥ 640) / 32px (≥ 1024).
- Radii: 10px (inputs/buttons), 16px (cards), 24px (feature panels), full (pills).
- Elevation: soft forest-tinted shadows (`0 10px 30px -12px rgb(5 54 32 / .25)`).

## 4. Components

| Component | Spec |
|---|---|
| **Button** | Heights 40/48/56. Variants: `primary` (forest), `accent` (gold→bronze), `outline`, `ghost`, `light` (on dark). Hover: 2px lift + shadow; focus: 3px gold-300 ring offset 2px; disabled/loading: spinner + `aria-busy`, `pointer-events:none`. |
| **Form fields** | Label above, 48px input, 1px `#CBD5CC` border, focus ring forest-700 + gold-300 glow, inline error text (`role="alert"`) with `aria-describedby`; required marker; honeypot hidden off-screen. |
| **Cards** | White, 1px border, 16px radius, hover lift and border→bronze-300. Service cards carry an icon tile (forest bg, gold icon). |
| **Header** | Sticky, paper/90% + backdrop blur, 72px; logo mark + wordmark; condenses on scroll; dropdown mega-list for services; CTA button right. |
| **Footer** | Forest-950 background, 4 columns, gold rules, social icon buttons. |
| **Section bands** | Alternate paper / white / forest-900 (dark, with subtle brand-gradient glow) for rhythm. |
| **Accordion** | `<button aria-expanded>` + animated height via `motion`; one or many open. |
| **Badges/pills** | Bronze-100 bg, bronze-700 text. |

## 5. Icons & imagery
- Icons: `lucide`-style inline SVG set written in `src/components/ui/icons.tsx` (stroke 1.75, `currentColor`). No icon fonts, no emoji as icons.
- Imagery: next/image only; AVIF/WebP; explicit `width/height` or `fill`+aspect box; meaningful `alt` (decorative → `alt=""`). Stock hotlinks from the live site (Unsplash) are **not** used; hero art is a CSS/SVG composition derived from the logo mark (no external dependency). Portfolio images are the uploaded logo PNGs, stored in the media library.

## 6. Motion guidelines
Library: `motion` (Motion for React), imported from `motion/react`.
- Durations 0.25–0.7s; ease `[0.22, 1, 0.36, 1]`; distances ≤ 24px; stagger 0.06–0.1s.
- Patterns: hero text mask/slide-up entrance, `Reveal` on scroll (`whileInView`, `once`, margin `-80px`), staggered grids, button hover, nav underline, accordion height, animated counters (only when stats are verified), route fade (`template.tsx`), skeleton shimmer.
- **Reduced motion:** `MotionConfig reducedMotion="user"` wraps the app; CSS `@media (prefers-reduced-motion: reduce)` disables shimmer/transitions.
- Content is server-rendered visible; animation only transforms/opacity (no layout shift). `Reveal` renders children in their final state when JS is disabled (initial state applied only after hydration check via `initial={false}` fallback in SSR for above-the-fold).

## 7. Breakpoints (Tailwind v4 defaults)
`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`. Tested at 320, 375, 425, 768, 1024, 1280, 1440, 1920.

## 8. Accessibility requirements
Skip-to-content link · landmarks (`header/nav/main/footer`) · visible focus · 44px min touch targets · keyboard-operable menus/accordions/dialogs (focus trap, `Esc`) · form labels + error association · `aria-live` for form status · `aria-current` for nav · alt text · AA contrast · reduced motion · `lang="en-IN"`.

## 9. Admin panel styling
Same tokens: forest sidebar, paper content area, gold active indicator; dense tables with sticky header, responsive stacking cards < 768px; same buttons/forms. Admin does not use public animations beyond subtle transitions.
