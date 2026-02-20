# Templates Directory

This directory stores all website templates for the Keystone Web CMS.

## Structure

```
templates/
├── metadata.json          # Master metadata file with all template definitions
├── services/
│   ├── plumber/
│   │   ├── classic-pro.json
│   │   ├── classic-pro.html
│   │   ├── modern-blue.json
│   │   ├── modern-blue.html
│   │   ├── minimal-white.json
│   │   └── minimal-white.html
│   ├── electrician/
│   │   └── ...
│   └── ...
├── products/
│   ├── ecommerce/
│   │   └── ...
│   └── ...
└── both/
    └── ...
```

## Template File Format

### Metadata File (.json)

Each template has a JSON metadata file describing its properties:

```json
{
  "id": "plumber-classic-pro",
  "name": "Classic Professional",
  "businessType": "services",
  "category": "plumber",
  "tags": ["professional", "modern", "blue", "services"],
  "description": "Clean professional design with emphasis on service listings",
  "sections": [
    "header",
    "hero",
    "services",
    "about",
    "testimonials",
    "cta",
    "footer"
  ],
  "colors": {
    "primary": "#0066cc",
    "secondary": "#003399",
    "accent": "#ff6600"
  },
  "imageUrl": "/templates/services/plumber/classic-pro-preview.png"
}
```

### HTML File (.html)

Template HTML files contain the complete, responsive website markup. They should:

1. Use **Tailwind CSS** classes for styling
2. Include color variables that can be dynamically replaced
3. Be fully responsive (mobile-first)
4. Use realistic placeholder content for the business type
5. Include all standard sections (header, hero, services/products, about, testimonials, CTA, footer)

**Color Variables**: Templates should use one of these patterns for colors:
- CSS variables: `var(--primary)`, `var(--secondary)`, `var(--accent)`
- Data attributes: `[primary]`, `[secondary]`, `[accent]`
- Tailwind arbitrary values: `bg-[#0066cc]`

The TemplateRenderer component will dynamically replace these with user-selected colors.

## Adding New Templates

1. Create a new directory: `templates/{businessType}/{category}/`
2. Create metadata JSON file: `{template-id}.json`
3. Create HTML file: `{template-id}.html`
4. Add entry to `metadata.json` master file
5. Generate preview screenshot (optional, improves UX)
6. Update Supabase with template metadata (see SETUP.md)

## Preview Screenshots

Store preview images in the template directory with naming convention:
- `{template-id}-preview.png` (1200x800px recommended)

These are referenced in metadata.json's `imageUrl` field.

## Future: Dynamic Loading

Currently, templates are served from the filesystem. In the future, we can:

1. Store template content in a CDN (S3, Cloudflare)
2. Cache template HTML in Redis
3. Load template metadata from Supabase
4. Support versioning (template updates without redeployment)

This architecture is designed to support those changes without modifying the API endpoints.

## Template Design Guidelines

### Services Templates
- Emphasize: service listings, expertise, testimonials, booking CTAs
- Include: team member profiles, before/after portfolios, service area maps
- Color schemes: Professional blues, greens, grays with accent colors

### Products Templates
- Emphasize: product showcase, pricing, reviews, add-to-cart CTAs
- Include: product galleries, specifications, customer testimonials
- Color schemes: Bold colors, contrasting primary/accent, high visual hierarchy

### Both Templates
- Emphasize: Mix of service and product listings
- Include: Services section + product gallery + testimonials + booking/shop CTAs
- Color schemes: Versatile, works with both services and products

### Design Styles

Each category should have 3 distinct design approaches:

1. **Classic/Professional**: Traditional business look, focus on content
2. **Modern/Bold**: Contemporary design, high visual impact, generous spacing
3. **Minimal/Clean**: Simplistic, whitespace-focused, elegant typography

## Testing Templates

1. Navigate to onboarding
2. Select business type and category
3. Choose a template
4. View in `/editor?siteId={siteId}`
5. Test color customization in FloatingToolbar settings
6. Verify responsiveness on mobile/tablet/desktop

## Performance Tips

- Keep HTML files under 100KB
- Use inline CSS for critical above-the-fold styles
- Lazy-load images with `loading="lazy"`
- Minimize DOM depth (avoid deeply nested structures)
- Use CSS Grid and Flexbox for responsive layouts

## Accessibility

All templates must:
- Use semantic HTML (header, nav, main, footer, etc.)
- Include alt text for all images
- Ensure color contrast ratios meet WCAG AA standards
- Support keyboard navigation
- Include ARIA labels where necessary

---

For more information, see SETUP.md for Supabase integration instructions.
