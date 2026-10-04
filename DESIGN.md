---
version: alpha
name: "Test Simulator"
description: "A focused study workspace with a familiar classic layout and a distinct rail-based new layout."
colors:
  primary: "#07855e"
  background: "#f6f8fa"
  surface: "#ffffff"
  text: "#152331"
  accent-warm: "#e2bc72"
typography:
  sans:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  mono:
    fontFamily: "Fira Code, JetBrains Mono, Source Code Pro, monospace"
rounded:
  control: "0.75rem"
  card: "1.125rem"
  sidebar: "1.375rem"
spacing:
  page-gutter: "clamp(1rem, 2vw, 1.75rem)"
  workspace-gap: "clamp(1rem, 2vw, 1.75rem)"
  content-max: "92.5rem"
components:
  workspace-rail: "Deep green navigation rail with clear selected-mode state and a visible paper-change action."
  question-card: "Full-width reading surface with generous text spacing and a distinct question number."
  mode-switch: "One persistent control in Settings; classic stays the default for new browsers."
---

# Test Simulator Design System

## Overview

### Creative North Star

Treat the interface as a well-organised study desk: a clear place for the current paper, a short set of work modes, and a calm central surface for one question at a time. The new layout uses a deep-green rail and a warm brass selection mark to make navigation easy to scan. It keeps the existing study content and controls.

### Product context and register

- **Audience and primary job:** UNISA students practising assessments and learning from question notes.
- **Target market(s) and evidence:** South African study use, supported by the supplied UNISA papers and South African module content.
- **Locale(s) and language policy:** English UI and English study content.
- **Usage scene:** Desktop study sessions and phone review between tasks. Text entry and long question content need room.
- **Register:** Product UI.
- **Memorable signature:** A persistent vertical mode rail on desktop that becomes a compact labelled mode strip on phones.
- **Restraint:** Keep the active paper, question, answer controls, and study notes easy to find. Avoid extra dashboards, decorative charts, and cramped cards.
- **Anti-references:** Generic AI purple gradients; a cosmetic-only redesign that leaves navigation and page structure unchanged.
- **Token ownership/runtime mapping:** Existing theme variables in styles.css remain canonical. ui-variant.css adapts those values for the alternate layout and uses the existing theme selection. Fixed rail and selection colours are documented beside their CSS rules.

## Colors

The existing light and dark themes remain user-controlled. The new workspace uses their surface, text, accent, and border variables. Its navigation rail uses deep green (#153a35 in light theme and #0b1716 in dark theme). Warm brass (#e2bc72) marks the selected mode; it is reserved for navigation state.

## Typography

Inter remains the body and control typeface. Question text uses a relaxed line height for reading; small labels use uppercase sparingly for navigation hierarchy. Long answers and technical content retain the app's existing monospace choices.

## Layout

Desktop uses a full-width compact header, a 250px navigation rail, and a flexible reading area capped at 1480px. The rail holds mode navigation and a paper-change action; the center holds a mode heading and study content. Below 980px the rail moves above the content. On narrow phones the modes become three or four equal, labelled targets and the paper selector moves to its own header row. Content keeps natural document scrolling; no shared page shell is locked to the viewport.

## Elevation & Depth

The header is a light translucent sticky surface. The rail is a single solid anchor surface. Question surfaces use a thin border and soft shadow; no extra shadow is added on hover that could distract while reading. The modal retains its established overlay behavior.

## Shapes

The new layout uses 12–22px radii to group related controls. The rail has a 22px outer radius on desktop and tightens on phones. The selected mode is indicated by both a filled state and a brass edge, not color alone.

## Components

### Foundational visual states

Buttons retain native semantics and the app's existing action labels. The new mode links and paper action have hover and visible keyboard focus. Selected mode uses text, fill, and a brass edge. Reduced-motion preferences shorten new transitions.

### Buttons and actions

Primary and secondary actions continue using the existing button classes. The interface switch is a reversible setting and announces its state with aria-pressed.

### Navigation and data display

The existing mode-tab buttons move into the rail. The selected paper remains available in the header and a paper-change action is also available in the rail. On phones, navigation becomes a horizontal strip. Question cards remain in document flow.

### Forms and overlays

The paper picker and current settings dialogs keep their existing behavior. New workspace controls open the existing paper picker rather than duplicating selection logic.

### Iconography

Existing SVG icons are retained. Labels remain visible on desktop and phones.

### Motion

Transitions are short and state-based. Reduced-motion preferences disable movement and animation in the new layout.

### Content and data visualization

Use direct student-facing language. Label actions by their result. Keep the question and its notes together.
