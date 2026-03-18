# DaisyUI Stadium Night Redesign — Design Document

## Goal

Modernize MyFutTV with a dark "stadium at night" aesthetic using daisyUI v5 (native Tailwind v4). Full redesign: header, match cards, filters, navigation, all views.

## Tech Stack

- daisyUI v5 (`@plugin "daisyui"` in CSS, no JS config needed)
- Tailwind v4 (already installed)
- Custom theme tokens overriding daisyUI's `night` theme base

---

## Color Palette

| Token | Value | Use |
|---|---|---|
| `base-100` | `#0f1923` | Main background — stadium dark navy |
| `base-200` | `#162232` | Cards and panels |
| `base-300` | `#1e2d3d` | Elevated cards / hover states |
| `primary` | `#16a34a` | Grass green — primary action |
| `primary-content` | `#f0fdf4` | Text on green |
| `secondary` | `#f59e0b` | Amber gold — live scores, highlights |
| `accent` | `#38bdf8` | Sky blue — TV channel bar |
| `neutral` | `#1e2d3d` | Neutral surfaces |
| `base-content` | `#e2e8f0` | Main text |

Body background: gradient `from-[#0f1923] to-[#0a1520]` for depth.

---

## Global Structure

### Header (sticky)
- `bg-base-200` + `border-b border-base-300` + subtle `backdrop-blur`
- "MyFutTV" branding with a small green pulsing dot beside it
- ViewSwitcher → daisyUI `tabs tabs-boxed`, active tab in `btn-primary` (green)
- DateNavigator → `btn btn-ghost btn-circle` arrows, bold date centered
- LeagueFilter → collapsible, each league as `btn btn-xs`: selected = `btn-primary`, unselected = `btn-ghost` with border

### Content area
- Dark gradient background
- DayView time groups → daisyUI `divider` with time in `text-base-content/50`
- Loading → `loading loading-ring text-primary` size `lg`, centered
- Error → `alert alert-error`
- No matches → football icon + centered text on dark background

---

## MatchCard

### Container
- daisyUI `card bg-base-200 border border-base-300`
- Slightly square corners (less rounded than default)
- Hover: `hover:border-primary/40 hover:bg-base-300` with transition

### Competition row (top)
- Competition emblem + name in `text-xs text-base-content/60`
- Status badge (right-aligned):
  - IN_PLAY → `badge badge-error animate-pulse` + minute in `text-secondary` (amber)
  - PAUSED → `badge badge-warning` "Descanso"
  - FINISHED → `badge` muted gray "Finalizado"
  - SCHEDULED/TIMED → subtle time text "Empieza en X"
  - POSTPONED → `badge badge-ghost` "Aplazado"
  - CANCELLED → `badge badge-error` outline "Cancelado"

### Teams + score row
- Team names: `text-base font-bold`
- Team crests: `w-8 h-8`
- Score (center): `text-3xl font-black text-secondary` (amber gold) when goals exist
- No score (SCHEDULED): `text-xl text-base-content/70` showing kickoff time

### Goal scorers
- Same layout as current (home left, away right)
- `text-xs text-base-content/50`
- ⚽ prefix, penalty → `(pp)`, own goal → `(en)`

### Channel footer
- Channel available → `bg-primary/20 border-t border-primary/30`, TV icon and name in `text-primary`
- No channel → `bg-base-300/50`, text in `text-base-content/30`

---

## Implementation Notes

- Install daisyUI v5: `npm install daisyui@latest`
- Add to `globals.css`: `@plugin "daisyui"` with custom theme block
- daisyUI v5 uses CSS-based theme config (no `tailwind.config.ts` needed)
- Apply `data-theme="stadium"` on `<html>` in `layout.tsx`
- Components to update: `page.tsx`, `MatchCard.tsx`, `DayView.tsx`, `LeagueFilter.tsx`, `DateNavigator.tsx`, `ViewSwitcher.tsx`, `WeekView.tsx`, `MonthView.tsx`, `LiveIndicator.tsx`
