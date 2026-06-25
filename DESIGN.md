---
name: Neon Serpent
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#baccb0'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#85967c'
  outline-variant: '#3c4b35'
  surface-tint: '#2ae500'
  primary: '#efffe3'
  on-primary: '#053900'
  primary-container: '#39ff14'
  on-primary-container: '#107100'
  inverse-primary: '#106e00'
  secondary: '#a2e7ff'
  on-secondary: '#003642'
  secondary-container: '#00d2fd'
  on-secondary-container: '#005669'
  tertiary: '#fff9f0'
  on-tertiary: '#3a3000'
  tertiary-container: '#ffdb40'
  on-tertiary-container: '#736000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79ff5b'
  primary-fixed-dim: '#2ae500'
  on-primary-fixed: '#022100'
  on-primary-fixed-variant: '#095300'
  secondary-fixed: '#b4ebff'
  secondary-fixed-dim: '#3cd7ff'
  on-secondary-fixed: '#001f27'
  on-secondary-fixed-variant: '#004e5f'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  score-display:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  label-caps:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1200px
  gutter: 20px
---

## Brand & Style
The design system is engineered for a high-intensity, multiplayer competitive environment. It evokes a sense of speed, precision, and digital athleticism. The aesthetic is rooted in **Glassmorphism**, utilizing layered translucency to maintain a connection to the underlying game world at all times. 

The visual language balances the "retro-future" nostalgia of classic arcade games with a sleek, modern finish. Depth is created through vibrant background blurs and luminous glow effects that simulate light emitting from the snakes themselves. The interface should feel like a high-tech HUD (Heads-Up Display) overlaying a deep-space arena.

## Colors
This design system utilizes a high-contrast dark palette to make neon elements pop with maximum intensity.

- **Background**: A deep, saturated midnight black (#0A0A0C) serves as the void.
- **Primary (Neon Green)**: Reserved for player snakes, growth indicators, and primary "Play" actions.
- **Secondary (Electric Blue)**: Used for functional UI elements, navigation, and secondary snake skins.
- **Accents**: Gold is used exclusively for high-value food items and leaderboard "Top 3" spots. Diamond is used for rare power-ups and premium currency indicators.
- **Gradients**: Use linear gradients (45-degree angle) combining Electric Blue and Neon Green for progress bars and active state highlights.

## Typography
The system uses **Outfit** for its geometric, modern friendliness and excellent legibility at large sizes. 

**Tabular Numbers**: For all scores, timers, and fluctuating data, **JetBrains Mono** is employed. This ensures that numbers do not "jump" or shift horizontally as they increment, which is critical for competitive tracking. Headlines should use tight letter-spacing for a more aggressive, impactful look, while labels utilize wider tracking for clarity at small sizes.

## Layout & Spacing
The layout follows a **Fluid Grid** model to accommodate various monitor aspect ratios and mobile orientations. 

- **Gaming HUD**: Fixed-position elements in corners with a safe-area margin of `md` (24px).
- **Menu System**: Centered 12-column grid with a `container-max` of 1200px.
- **Mobile**: Transitions to a 4-column layout with reduced margins (`sm`). 
- **Rhythm**: All spacing is derived from a 4px base unit to ensure alignment with the pixel-based nature of the snake movement grid. Components should feel "airy" with significant internal padding to allow the glass backgrounds to breathe.

## Elevation & Depth
Depth is achieved through a layering of semi-transparent surfaces rather than traditional shadows.

- **Backdrop Blur**: All panels must have a `backdrop-filter: blur(12px)`.
- **Inner Glow**: Higher elevation elements (like modals) feature a subtle 1px inner border of `rgba(255, 255, 255, 0.2)` to simulate light hitting the edge of the glass.
- **Outer Glow**: Active gameplay elements (snakes, food) use `box-shadow` with high spread and low opacity using their respective brand color (e.g., Neon Green) to create a "bloom" effect.
- **Stacking**: Level 1 (Background), Level 2 (Glass Panels), Level 3 (Interactive Elements/Buttons), Level 4 (Modals/Alerts).

## Shapes
The design system utilizes **Rounded** shapes to offset the "sharp" competitive nature of the game, making it feel modern and polished. 

- **Standard Elements**: 0.5rem (8px) corner radius.
- **Buttons & Chips**: Use `rounded-xl` (1.5rem) or full pill-shapes for a sleek, ergonomic feel.
- **Snake Segments**: Should be fully circular (pill) to emphasize the fluid, organic movement of the snake against the rigid grid of the arena.

## Components
### Buttons
Buttons are large and tactile. Primary buttons use a solid Neon Green fill with dark text. Secondary buttons are "ghost" glass panels with an Electric Blue border and white text. All buttons feature a 10% brightness increase on hover.

### Progress Bars
Used for "XP" or "Energy" levels. These are thin (8px) glass tracks with a vibrant gradient fill. The leading edge of the progress bar should have a small "spark" glow to indicate movement.

### Cards & Panels
Game mode cards use a 12px blur glass effect. On hover, the border opacity increases from 12% to 30%. Background images within cards should be darkened by 40% to ensure text legibility.

### Input Fields
Dark backgrounds with a 1px Electric Blue bottom border. When focused, a subtle blue glow emanates from the border.

### Leaderboard Rows
Alternating glass opacity levels (5% and 8%). The "Local Player" row is highlighted with a 1px Neon Green left-border stroke to make it immediately identifiable.