---
name: design-system-extractor
description: Extract design systems from websites and product screenshots, producing structured documentation that enables design engineers and AI coding agents to recreate the exact aesthetic in new applications. Use this skill whenever the user wants to analyze a site's visual language, clone a design system, extract a UI style guide, reverse-engineer a brand's design tokens, document a competitor's aesthetic, or produce reusable design specs from a URL or screenshot. Triggers on phrases like "extract the design system", "analyze the design of", "document the style of", "how does X look/feel", "clone the UI of", "replicate the aesthetic of", or whenever a URL or screenshot is shared for design analysis purposes.
---

This skill extracts design systems from live websites or static screenshots, producing structured documentation — named design tokens, typography scales, spacing rhythms, color palettes, motion patterns — ready for use by a design engineer or AI agent building a new interface in the same aesthetic.

The input may be a URL (preferred) or one or more screenshots. The output is a single markdown file saved to the project.

## Phase 0 — MCP Playwright Setup

**Before doing anything else**, verify Playwright MCP is configured and permitted. This is mandatory: browser automation is the primary tool for extracting precise values from live sites.

Check `.mcp.json` in the project root. If `playwright` is missing:
```json
"playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest", "--output-dir", ".playwright-mcp"]
}
```

Check `.Codex/settings.local.json`. If any of these tools are missing from `permissions.allow`, add them all:
```json
"mcp__playwright__browser_navigate",
"mcp__playwright__browser_snapshot",
"mcp__playwright__browser_click",
"mcp__playwright__browser_hover",
"mcp__playwright__browser_take_screenshot",
"mcp__playwright__browser_type",
"mcp__playwright__browser_press_key",
"mcp__playwright__browser_evaluate",
"mcp__playwright__browser_wait_for",
"mcp__playwright__browser_console_messages",
"mcp__playwright__browser_resize",
"mcp__playwright__browser_tabs"
```

If either file was modified, note it to the user and proceed — no restart required for permissions. Playwright MCP itself needs a Codex restart only if `.mcp.json` was newly added; if it was already present, continue immediately.

## Phase 1 — Exploration (URL inputs)

For URLs, traverse the full primary user journey before extracting anything. Surface-level analysis of a single page misses the system — the palette emerges from contrast across pages, the spacing rhythm from repeated patterns.

**Navigate in this order:**
1. Landing / home page — first impression, hero treatment, primary palette
2. Key feature pages — component density, data display patterns
3. Authentication views if accessible — form treatment, focus states
4. Settings, modals, drawers — overlay system, elevation layers

**At each page:**
- Take a full-page screenshot (`browser_take_screenshot` with `fullPage: true`) — **always save to `.playwright-mcp/` with a descriptive name like `01-invoices-light.png`**
- Take an accessibility snapshot (`browser_snapshot`) — reveals semantic structure and text content
- Hover interactive elements (buttons, links, inputs) and observe state changes
- Click to open modals, dropdowns, tooltips — document overlay appearance

**CRITICAL — Read every screenshot after taking it:**
After taking each screenshot, immediately use the `Read` tool on the saved file to visually inspect it. DevTools gives you computed values, but screenshots reveal:
- Actual layout composition (proportions, whitespace, visual rhythm)
- Layout patterns: is this a table, card grid, master-detail split, or slide-over?
- Color relationships between elements that computed styles don't capture
- Typography hierarchy as rendered (not just size numbers)
- States and visual signals that only appear visually (e.g. negative values in red)
- Dark vs light mode differences in contrast and mood

```
// Screenshot naming convention — always prefix with .playwright-mcp/
filename: ".playwright-mcp/01-page-name-light.png"
filename: ".playwright-mcp/02-page-name-dark.png"
filename: ".playwright-mcp/03-modal-name-light.png"
```

**DevTools extraction via `browser_evaluate`:**
```js
// Extract computed styles from a target element
getComputedStyle(document.querySelector('button')).cssText

// Extract CSS custom properties (design tokens)
const styles = getComputedStyle(document.documentElement);
const props = [...document.styleSheets]
  .flatMap(s => [...s.cssRules].filter(r => r.selectorText === ':root'))
  .flatMap(r => r.cssText.match(/--[\w-]+:\s*[^;]+/g) || []);

// Extract font stacks in use
[...document.querySelectorAll('*')].map(el => getComputedStyle(el).fontFamily)
  .filter((v, i, a) => a.indexOf(v) === i).slice(0, 10)
```

Use DevTools extraction for precise values (hex, px, timing). Use screenshot visual inspection for layout, composition, and relationships. Both are required — neither alone is sufficient.

**For screenshot-only inputs:** Describe qualitatively. Never invent hex codes or px values you cannot verify. Note explicitly what was inferred vs. observed.

## Phase 2 — Primitive Extraction

Extract these in order. Depth matters more than breadth — a precise shadow value beats a vague description.

**Color Palette**
Verified hex codes first. Group by role: background tiers, text hierarchy, accent/brand, semantic (success/error/warning/info), border/divider, shadow colors.

**Typography**
Font families (headings vs. body vs. mono), weight scale actually in use (not just what's loaded), size scale mapped to semantic roles (h1→h6, body, caption, label, code), line-height and letter-spacing values, text-transform treatments.

**Spacing**
Identify the base unit (4px, 8px, 5px — look for the GCD of common spacing values). Map to a named scale: xs/sm/md/lg/xl. Container max-widths and horizontal margins.

**Elevation & Depth**
Shadow values (box-shadow CSS), border-radius pattern (one value? multiple?), z-index conventions for overlays vs. dropdowns vs. modals.

**Interactive States**
For every control type (button, link, input, checkbox, select): default, hover, focus, active, disabled. Focus ring style especially — it reveals design sensitivity. Transition timing and easing if extractable from computed styles.

**Motion**
Philosophy (instant? snappy? smooth? theatrical?). Common durations and easing functions. Entrance/exit patterns for modals, toasts, dropdowns. Loading states.

## Phase 3 — Name the System

Create a memorable name that captures the aesthetic without referencing the source product. The name should evoke the emotional character of the design:

- Cold + technical + dark → "Obsidian Terminal", "Carbon Grid"
- Warm + editorial + serif → "Letterpress", "Broadsheet"
- Playful + rounded + colorful → "Playground", "Confetti"
- Clean + spacious + minimal → "Arctic Dawn", "Linen"
- Bold + geometric + systematic → "Bauhaus Mono", "Signal"
- Dense + information-rich → "Trading Floor", "Control Room"

Commit to a name. It frames the documentation.

## Phase 4 — Generate the Report

Save to `.Codex/design-systems/{system-name}.md` (create the directory if needed). Use this exact structure:

```markdown
# {System Name}

> Extracted from: {source type — "live site" or "static screenshot(s)"}
> Values marked † are inferred; all others are verified via DevTools.

## Essence
2–3 sentences. The emotional register of the design. What it communicates before you read a word. What design principles are visibly at work.

## Color Palette

### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| bg-primary | `#1a1a2e` | Page background |
| bg-surface | `#16213e` | Card, panel surfaces |
| bg-elevated | `#0f3460` | Modals, dropdowns |

### Text
| Token | Value | Usage |
|-------|-------|-------|
| text-primary | `#e2e8f0` | Body text |
| text-muted | `#94a3b8` | Labels, captions |

### Brand & Accents
(list with token, value, usage)

### Semantic
(success, warning, error, info — value + usage)

### Borders & Shadows
(border colors, shadow colors if distinct from bg)

## Typography

### Families
| Role | Family | Weights Used |
|------|--------|-------------|
| Display/Heading | Söhne, sans-serif | 700, 800 |
| Body | Inter, sans-serif | 400, 500 |
| Mono | JetBrains Mono | 400 |

### Scale
| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Display | 56px | 800 | 1.05 | -0.02em | Hero headings |
| H1 | 40px | 700 | 1.1 | -0.01em | Page titles |
| H2 | 28px | 600 | 1.2 | 0 | Section headers |
| Body | 16px | 400 | 1.6 | 0 | Prose |
| Small | 14px | 400 | 1.5 | 0 | Labels, meta |
| Micro | 12px | 500 | 1.4 | 0.02em | Badges, tags |

### Notable Treatments
- (e.g., "All-caps tracking on navigation labels: letter-spacing: 0.08em")
- (e.g., "Numeric tabular figures for data columns")

## Spacing

### Base Unit
{value}px — all spacing values are multiples of this base.

### Scale
| Token | Value | Common Usage |
|-------|-------|-------------|
| space-1 | 4px | Icon gaps, tight pairs |
| space-2 | 8px | Input padding |
| space-4 | 16px | Component internal padding |
| space-6 | 24px | Section gaps |
| space-8 | 32px | Major section separation |

### Layout
- Max container width: {value}
- Horizontal page margin: {value}
- Column gutter: {value}

## Elevation

### Border Radii
| Token | Value | Applied To |
|-------|-------|-----------|
| radius-sm | 4px | Tags, badges |
| radius-md | 8px | Buttons, inputs |
| radius-lg | 12px | Cards |
| radius-xl | 20px | Modals, panels |

### Shadows
| Token | Value | Applied To |
|-------|-------|-----------|
| shadow-sm | `0 1px 3px rgba(0,0,0,0.12)` | Subtle cards |
| shadow-md | `0 4px 16px rgba(0,0,0,0.24)` | Dropdowns |
| shadow-lg | `0 16px 48px rgba(0,0,0,0.40)` | Modals |

## Interactive States

### Buttons (Primary)
| State | Visual Treatment |
|-------|-----------------|
| Default | bg: {value}, text: {value} |
| Hover | bg shifts {direction} ~{amount}, transition: {timing} |
| Active | scale(0.97) or bg darkens |
| Focus | {ring color} ring, {offset} offset |
| Disabled | opacity: 0.4, cursor: not-allowed |

### Form Inputs
| State | Visual Treatment |
|-------|-----------------|
| Default | border: {value}, bg: {value} |
| Focus | border-color: {accent}, ring: {value} |
| Error | border-color: {error-color} |
| Disabled | bg: {value}, opacity: {value} |

### Links
- Default: {color}, {underline treatment}
- Hover: {treatment}
- Transition: {timing}

## Motion

### Philosophy
(Characterize the motion language: instant? snappy? cinematic? restrained? Does it use physics-based easing?)

### Timing Scale
| Name | Duration | Easing | Used For |
|------|----------|--------|---------|
| fast | 100ms | ease-out | Hover state transitions |
| base | 200ms | cubic-bezier(0.4, 0, 0.2, 1) | Most transitions |
| slow | 350ms | ease-in-out | Modals, panels sliding |

### Patterns
- **Modal enter**: {description — e.g., "fade + translate-y from +16px, 250ms ease-out"}
- **Toast**: {description}
- **Dropdown**: {description}
- **Loading**: {description — skeleton? spinner? pulse?}

## Design Principles

1. **{Principle name}** — {one sentence describing the observable manifestation}
2. **{Principle name}** — {description}
3. **{Principle name}** — {description}
(3–5 principles max)

## Implementation Notes

CSS custom property naming convention observed: {e.g., "--color-{role}-{scale}" or "--{component}-{property}"}

Design token structure if present: {describe the token naming system}

Notable implementation patterns: {e.g., "uses CSS container queries", "dark mode via data-theme attribute", "animations use Web Animations API"}

Framework hints: {if detectable from DOM structure or class naming}
```

## Rules

1. **No product names.** Refer to "the application", "the site", "the service". The documentation must be context-free and portable.

2. **Verified over inferred.** Use DevTools every time precision matters. Mark inferred values with †. A verified `#1a1a2e` beats an inferred "very dark navy".

3. **Tokens not components.** Document primitives: colors, type, spacing, elevation, motion. Full component specs belong elsewhere. The goal is a design language, not a component library.

4. **Traverse before synthesizing.** For live URLs, visit at minimum 3 pages before drawing conclusions. The home page alone is never the system.

5. **States reveal character.** Click and hover everything. Focus rings, transition timing, and disabled states show how much care the design team invested. They're worth documenting precisely.

6. **Concise is correct.** Simple systems get brief docs. Padding a sparse design into a long document adds noise, not value. Match depth to complexity.

7. **Name with conviction.** A good system name sets expectations and makes documentation memorable. Don't default to the brand name or a generic descriptor.
