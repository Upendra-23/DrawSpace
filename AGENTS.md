# Drawing App — AGENTS.md

## Commands
- `npm run dev` — Vite dev server with HMR
- `npm run build` — `tsc -b && vite build` (type-check then bundle; both must pass)
- `npm run lint` — ESLint (no tests configured)

## Architecture
- **Vite + React 19 + TypeScript + Zustand**, single-page, no router
- All state in `src/store/useStore.ts` (tool, elements, history, zoom, pan, clipboard, selectionRect, pasteWorldPos, theme)
- **Theme**: `theme` field (`'light'` | `'dark'`) in store, toggled by 🌙/☀️ button in toolbar. `App.tsx` sets `data-theme` on `<html>`. CSS custom properties in `:root` / `[data-theme="dark"]` in `index.css`.
- **Canvas** (`src/components/Canvas.tsx`): renders imperatively via `<canvas>` 2D context — NOT React SVG/DOM
- **Toolbar** (`src/components/Toolbar.tsx`) uses Zustand selectors for reactivity
- **Keyboard shortcuts** in `src/App.tsx` — disabled when focus is in `<input>` or `<textarea>`

## Critical Conventions
- **All element coordinates are in world space.** Canvas transforms via `ctx.translate(panX, panY)` + `ctx.scale(zoom, zoom)`. Helper `screenToWorld` in Canvas.
- **History is post-mutation** — each undo removes exactly one element. Never push intermediate drag states to history (`replaceElement` → `updateElement` on mouseup).
- **Laser elements are NOT in Zustand.** They live in Canvas `useRef` (`laserPoints`, `laserCurrent`) and render via `requestAnimationFrame` loop. 1s inactivity timeout.
- **Space key panning** — Canvas space handler skips `preventDefault` when focus is on `<input>` or `<textarea>`.
- **Selection state is dual** — `selectionRect` in Zustand store (for App.tsx Ctrl+C/X/V shortcuts) AND `selectionRectRef`/`selectedElements` refs in Canvas (for overlay buttons). Store subscribe callback syncs refs when `selectionRect` becomes null.

## Tool Model
| Tool | Key | Behavior |
|------|-----|----------|
| pen | D | Free-draw path |
| shapes | S | Rectangle/circle/line/arrow/triangle |
| laser | L | Temporary strokes, 1s auto-clear |
| eraser | E | Proximity erase (threshold = strokeWidth × 5) |
| select | C | Drag selection rect → Cut/Copy buttons appear |
| move | M | Click+ drag to move existing elements |

Shape sub-types: R=rect, O=circle, A=arrow. Ctrl+Z/Y=undo/redo, Ctrl+C/X=copy/cut inside selection rect, Ctrl+V=paste at cursor, Escape=clear selection + switch to move.

## Canvas Drawing Order
1. Fill `bgColor`
2. Dot grid (80px screen spacing, 8000-dot cap)
3. All `elements` from store (paths → shapes)
4. Live drag highlight (blue dashed bounding box around `dragElementId`)
5. In-progress pen/shape/selection previews
6. Persistent selection rect (from `store.selectionRect`)

## Files
- `src/types/index.ts` — `DrawingElement` union: `PathElement | ShapeElement | LaserElement`
- `src/store/useStore.ts` — Zustand store with all actions
- `src/utils/drawing.ts` — Pure canvas drawing functions + hit testing (`isPointNearElement`, `isElementInRect`)
- `src/components/Canvas.tsx` — All drawing, events, zoom/pan, laser loop, drag, selection overlay
- `src/components/Toolbar.tsx` — Tool buttons, shape selector, color picker, size slider, zoom controls, undo/redo/clear, theme toggle
- `src/components/ColorPicker.tsx` — Preset grid + custom `<input type="color">`
- `src/App.tsx` — Keyboard handler, Ctrl+C/X/V cut/copy/paste
- `src/App.css` — Glassmorphism toolbar (`backdrop-filter: blur(24px)`), CSS vars theming
- `src/index.css` — CSS custom properties for `:root` and `[data-theme="dark"]`, reset
