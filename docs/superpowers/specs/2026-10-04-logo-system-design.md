# Qifa Talk Website Logo System Design

## Goal

Adopt the supplied transparent Qifa Talk emblem throughout the website while preserving a clear, accessible live-text name in compact navigation.

## Selected Direction

Use the transparent 364×364 RGBA emblem as the website logo. Pair it with live “启发说” text in the header. Do not place the full dark-background English wordmark artwork inside the website interface; reserve that version for promotional and social materials where it has sufficient space.

## Asset

- Store the supplied emblem unchanged at `assets/images/qifa-talk-logo.png`.
- Preserve the original PNG bytes and transparency.
- Use the single master emblem for responsive browser rendering rather than maintaining manually resized duplicates.

## Placements

### Header

- Replace `🌟 启发说` with a 40-pixel emblem and live “启发说” text.
- Apply the same header brand treatment to the default, home, timer, and hands-up layouts.
- Keep the complete mark linked to the homepage and provide descriptive alternative text.

### Homepage hero

- Display a larger emblem above “西雅图 · 启发说”.
- Retain the existing Chinese title, English subtitle, tagline, and actions.

### Footer

- Replace the star emoji with a compact emblem beside the live “西雅图 · 启发说” text.
- Apply consistently wherever the shared site footer appears.

### Browser and sharing metadata

- Use the emblem as the standard PNG favicon and Apple touch icon.
- Use an absolute emblem URL as the default Open Graph and Twitter image.
- Preserve each page’s existing title behavior.

## Reuse and Maintainability

- Create reusable Liquid includes for the header brand, footer brand, and brand metadata.
- Render those includes from all four layouts so later logo changes have one source of truth.
- Keep layout-specific navigation width and active-link behavior unchanged.

## Accessibility

- Use meaningful alt text for standalone visual appearances.
- Treat decorative footer images as decorative when adjacent live text repeats the name.
- Keep live text instead of baking the organization name into the navigation image.
- Preserve keyboard focus and the homepage link target.

## Validation

- Verify the supplied asset checksum after copying.
- Assert all four layouts use the shared header and metadata includes.
- Assert applicable footers use the shared footer include.
- Confirm no `🌟 启发说` or `🌟 西雅图 · 启发说` branding remains.
- Build with GitHub Pages and test homepage, About, timer, and hands-up routes.
- Inspect desktop and 375×812 mobile screenshots for logo sizing, clipping, alignment, and overflow.
- Confirm the favicon, Apple touch icon, Open Graph image, and all internal navigation paths return HTTP 200.
