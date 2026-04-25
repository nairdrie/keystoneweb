# Builder UI Kit — Keystone Web Editor

Recreates the **AI Builder + Visual Editor** chrome from `app/(app)/editor/editor-content-v2.tsx` and `FloatingToolbar.tsx`. This is the workspace customers land in after onboarding — where they generate, customize, and publish their site.

## What's covered

- **`EditorBanner.jsx`** — top red `--brand-primary` strip: hamburger toggle, page selector ("Home ▾"), undo/redo, save, edit/preview pill toggle, publish button.
- **`FloatingSidebar.jsx`** — slide-in 352-px left panel with sections: Site identity (name + logo), AI Builder chat, Color palette grid + custom picker, Font picker, Pages, Publish status. Has a close (×) button in the corner.
- **`AIBuilderChat.jsx`** — the conversational interface. Suggested prompt chips, message list (user-bubbles + AI-cards with tool-call summaries), composer with Sparkles icon and Pro upgrade prompt for free users.
- **`SitePreview.jsx`** — center stage. Renders a fake "Hargrove Plumbing" template using the site's chosen palette so the user sees their work live.
- **`PalettePicker.jsx`** — 3-color swatches in a grid, with a "Custom" tile that opens individual color inputs.
- **`PageSelector.jsx`** — dropdown with Home / About / Services / Contact + "Add page" button.
- **`OnboardingWizard.jsx`** — 3-step flow: industry → describe business → AI prompt entry — the screen *before* the editor.

## Files

```
index.html             ← interactive demo (Onboarding → Editor with chat)
EditorBanner.jsx
FloatingSidebar.jsx
AIBuilderChat.jsx
SitePreview.jsx
PalettePicker.jsx
PageSelector.jsx
OnboardingWizard.jsx
EditorIcons.jsx        ← lucide SVG primitives used here
```

## What's stubbed

- The AI is faked via local prompt → scripted response.
- `SitePreview` renders one mocked template (a plumber landing page); real editor swaps in a registered template component per site.
- No real auth, no real publish — clicking Publish flips a status pill.

## Notes from source

The editor's banner background is `var(--brand-primary)` — red `#fe4545` — not slate. The 22rem sidebar margins the main canvas (`lg:ml-[22rem]`) when open. Edit/preview pill and View-as toggle live on the right side of the banner. AI Builder chat lives **inside** the sidebar, not as a separate panel.
