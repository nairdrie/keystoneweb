# Marketing UI Kit — Keystone Web

Recreates the public-facing kswd.ca marketing site as a click-thru prototype. The components in this kit are the pieces you'd reach for to mock up any new marketing page in the brand.

## What's covered

- **`Header.jsx`** — sticky white header with logo, nav (Templates / Industries dropdown / Pricing / Contact), and red pill CTA.
- **`Hero.jsx`** — the homepage hero: 2-line bold headline (red gradient on line 2), italic word, subhead, two pill CTAs, animated grid background, 3-up stat card.
- **`FeatureGrid.jsx` + `FeatureCard.jsx`** — 6-up "Built for Your Success" feature grid with lucide icons in slate-50 tile badges. Hover lifts border to red-300 and shadow to lg.
- **`TemplateShowcase.jsx`** — dark slate-950 section with auto-scrolling rows of the 8 template thumbnails.
- **`PricingCards.jsx`** — Basic ($15) light tier, Pro ($30) dark tier with red "Most Popular" pill and brand-glow shadow on hover.
- **`FAQ.jsx`** — accordion with the verbatim "Will I get a surprise bill?" / "Can you build my site for me?" copy.
- **`CTABlock.jsx`** — closing red CTA section with two blurred decorative red circles.
- **`Footer.jsx`** — single-row strip: small mark + "Made in Canada 🍁" (PNG) + legal links.

## What's stubbed

- **The animated grid background** is a static SVG render of the 60×60 grid (real site animates 3 floating mockups on a 15s loop). Captures the visual without the runtime cost.
- **No real navigation** — the nav links are click-only and route to anchor sections.
- **The form on Contact** is not implemented; only marketing chrome.

## Files

```
index.html             ← interactive demo (Home → Pricing → Templates via tab switch)
Header.jsx             ← <Header active="home" onNav={…} />
Hero.jsx               ← <Hero />
FeatureGrid.jsx        ← <FeatureGrid />  also exports <FeatureCard>
TemplateShowcase.jsx   ← <TemplateShowcase />
PricingCards.jsx       ← <PricingCards />
FAQ.jsx                ← <FAQ />
CTABlock.jsx           ← <CTABlock title="…" body="…" cta="…" />
Footer.jsx             ← <Footer />
Icons.jsx              ← lucide-style SVG primitives used across the kit
```

All components are factored as named globals on `window` so other Babel scripts can pull them.
