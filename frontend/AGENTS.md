# DermaSathiAI Frontend â€” project instructions

## Project boundary and integration
- This is the standalone frontend lab. Do not modify the separate backend repository.
- Keep backend work behind a typed API/service layer. Use existing mock/demo services until the real FastAPI contracts are supplied.
- Never connect the browser directly to PostgreSQL or invent API routes, payloads, auth rules, or database fields.

## Existing stack and preservation
- Inspect the current implementation before editing. Reuse existing pages, contexts, tokens, CSS modules, mock services and Three.js scenes where suitable.
- Current baseline: React 18, React Three Fiber 8, Three.js, Vite, TypeScript, React Router and Framer Motion. Do not upgrade major versions without proving the need and checking compatibility.
- Keep changes incremental and buildable. Do not delete working features or rewrite the whole project blindly.

## DermaSathiAI visual direction
- Premium, bright, calm, trustworthy healthcare design. Dark/cybersecurity/hacker/neon aesthetics are prohibited.
- Palette is provisional; centralize design tokens for later adjustment.
- Use 3D selectively for hero storytelling, feature demonstrations and appropriate processing states. Do not make every screen heavy.
- Combine 3D, video previews, editorial typography, depth and motion only when they improve the user journey.
- Responsive behavior is mandatory at phone, tablet and desktop sizes. Never rely on hover for essential mobile interactions.
- Respect reduced motion, keyboard accessibility, readable contrast, touch targets and lower-powered phones.

## Healthcare UX and safety
- Build complete frontend journeys for authentication/onboarding, dashboard, skin assessment, symptoms, reports/OCR review, medication safety/reminders, health history, lifestyle/wellness, facility discovery, localization and settings.
- Mock data and simulated AI must be clearly identified as demo content. Never present mock predictions as real diagnoses or verified results.
- Avoid diagnostic certainty and prescribing language. Show uncertainty, warnings, referral and clinician review clearly.
- Forms need validation, loading, success, error, empty and retry states.

## Skill use â€” apply explicitly when relevant
- Use `ponytail` / `ponytail-review` for minimal, safe implementation and review.
- Use `design-taste-frontend` for an audit-first redesign of the public landing page; do not apply its landing-only rules blindly to clinical dashboards.
- Use `landing-page-design` for public landing-page structure, message hierarchy and conversion flow.
- Use `impeccable` for product brief, critique, audit, accessibility, responsive and final polish; use its bundled helper scripts as documented.
- Use `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, and `find-animation-opportunities` when planning or reviewing purposeful motion.
- Skills are task-specific tools. Do not load or execute every skill/script on every change; explicitly invoke the relevant skills for each work package and report which were applied.

## Implementation discipline
- Prefer existing dependencies and components. Ask before adding heavy libraries or changing major versions.
- After meaningful changes, run the production build and visually inspect at approximately 1440px, 768px and 390px widths.
