import { useStore } from '../store/useStore'
import type { ToolType, ShapeType } from '../types'
import type { ReactNode, MouseEvent } from 'react'
import { ColorPicker } from './ColorPicker'

function ripple(e: MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const el = document.createElement('span')
  el.className = 'ripple'
  const size = Math.max(rect.width, rect.height)
  el.style.width = el.style.height = `${size}px`
  el.style.left = `${e.clientX - rect.left - size / 2}px`
  el.style.top = `${e.clientY - rect.top - size / 2}px`
  btn.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

const tools: { id: ToolType; label: string; shortcut: string; icon: ReactNode }[] = [
  {
    id: 'pen', label: 'Pen (D)', shortcut: 'D',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>,
  },
  {
    id: 'laser', label: 'Laser (L)', shortcut: 'L',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="22" x2="22" y2="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/><line x1="12" y1="12" x2="16" y2="8"/></svg>,
  },
  {
    id: 'select', label: 'Select (C)', shortcut: 'C',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3 9 21l3-7 7-3Z"/><path d="M13 13 16 20"/></svg>,
  },
  {
    id: 'cursor', label: 'Move (M)', shortcut: 'M',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9 9 5 13 9"/><path d="M9 5v14"/><path d="M15 13 19 9 15 5"/><path d="M19 9H9"/></svg>,
  },
  {
    id: 'eraser', label: 'Eraser (E)', shortcut: 'E',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7.5L3.5 16a2.12 2.12 0 0 1 0-3L15 2l6 6Z"/><path d="M18 13 11 6"/></svg>,
  },
]

const shapeTypes: { id: ShapeType; label: string; icon: ReactNode; shortcut: string }[] = [
  {
    id: 'rectangle', label: 'Rectangle (R)', shortcut: 'R',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/></svg>,
  },
  {
    id: 'circle', label: 'Circle (O)', shortcut: 'O',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/></svg>,
  },
  {
    id: 'line', label: 'Line', shortcut: '',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>,
  },
  {
    id: 'arrow', label: 'Arrow (A)', shortcut: 'A',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>,
  },
  {
    id: 'triangle', label: 'Triangle', shortcut: '',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><polygon points="12 3 2 21 22 21 12 3"/></svg>,
  },
]

export function Toolbar() {
  const {
    tool, setTool,
    shapeType, setShapeType,
    strokeWidth, setStrokeWidth,
    color, setColor,
    bgColor, setBgColor,
    theme, toggleTheme,
    zoom, setZoom, setPan,
    undo, redo,
    clearCanvas,
  } = useStore()

  const zoomPct = Math.round(zoom * 100)

  function zoomIn() {
    const s = useStore.getState()
    const newZoom = Math.min(10, s.zoom * 1.25)
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setZoom(newZoom)
    setPan(cx - (cx - s.panX) * (newZoom / s.zoom), cy - (cy - s.panY) * (newZoom / s.zoom))
  }

  function zoomOut() {
    const s = useStore.getState()
    const newZoom = Math.max(0.1, s.zoom / 1.25)
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setZoom(newZoom)
    setPan(cx - (cx - s.panX) * (newZoom / s.zoom), cy - (cy - s.panY) * (newZoom / s.zoom))
  }

  function zoomReset() {
    setZoom(1)
    setPan(0, 0)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <div className="tool-group">
          {tools.map((t) => (
            <button
              key={t.id}
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              onMouseDown={ripple}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div className="tool-group shape-subtypes">
          {shapeTypes.map((s) => (
            <button
              key={s.id}
              className={`tool-btn ${shapeType === s.id && tool === 'shapes' ? 'active' : ''}`}
              onClick={() => { setTool('shapes'); setShapeType(s.id) }}
              onMouseDown={ripple}
              title={s.label}
            >
              {s.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="tool-group quick-colors">
          {['#000000', '#ff0000', '#0066ff', '#00cc66', '#ff6600'].map((c) => (
            <div
              key={c}
              className={`quick-color ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
        </div>
        <ColorPicker color={color} onChange={setColor} />
      </div>

      <div className="toolbar-section">
        <ColorPicker
          color={bgColor}
          onChange={setBgColor}
          presets={['#ffffff', '#f5f5f5', '#fff8e1', '#e8f5e9', '#e3f2fd', '#fce4ec', '#f3e5f5', '#fff3e0', '#e0f7fa', '#fafafa']}
        />
      </div>

      <div className="toolbar-section">
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="size-slider"
          title={`Stroke width: ${strokeWidth}px`}
        />
        <span className="size-label">{strokeWidth}px</span>
      </div>

      <div className="toolbar-section">
        <button className="tool-btn" onClick={zoomOut} onMouseDown={ripple} title="Zoom out">−</button>
        <button className="tool-btn zoom-pct" onClick={zoomReset} onMouseDown={ripple} title="Reset zoom to 100%">{zoomPct}%</button>
        <button className="tool-btn" onClick={zoomIn} onMouseDown={ripple} title="Zoom in">+</button>
      </div>

      <div className="toolbar-section">
        <button className="tool-btn theme-btn" onClick={toggleTheme} onMouseDown={ripple} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="toolbar-section toolbar-actions">
        <button className="tool-btn" onClick={undo} onMouseDown={ripple} title="Undo (Ctrl+Z)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button className="tool-btn" onClick={redo} onMouseDown={ripple} title="Redo (Ctrl+Y)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
        </button>
        <button className="tool-btn clear-btn" onClick={clearCanvas} onMouseDown={ripple} title="Clear all">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>
  )
}
