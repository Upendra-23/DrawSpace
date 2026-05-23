import { useState, useRef, useEffect } from 'react'

const presetColors = [
  '#000000', '#ffffff', '#ff0000', '#ff6600', '#ffcc00',
  '#00ff00', '#00ccff', '#0066ff', '#6600ff', '#ff00ff',
  '#999999', '#663300', '#003300', '#000066', '#660066',
]

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  presets?: string[]
}

export function ColorPicker({ color, onChange, presets }: ColorPickerProps) {
  const colors = presets ?? presetColors
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="color-picker-wrapper" ref={pickerRef}>
      <div
        className="color-swatch"
        style={{ backgroundColor: color }}
        onClick={() => setOpen(!open)}
        title={`Color: ${color}`}
      />
      {open && (
        <div className="color-picker-dropdown">
          <div className="color-presets">
            {colors.map((c) => (
              <div
                key={c}
                className={`color-preset ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid rgba(0,0,0,0.08)' : 'none' }}
                onClick={() => { onChange(c); setOpen(false) }}
              />
            ))}
          </div>
          <div className="color-custom">
            <span>Custom</span>
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="color-input"
            />
          </div>
        </div>
      )}
    </div>
  )
}
