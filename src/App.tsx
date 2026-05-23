import { useEffect } from 'react'
import { Canvas } from './components/Canvas'
import { Toolbar } from './components/Toolbar'
import { useStore } from './store/useStore'
import { isElementInRect } from './utils/drawing'
import type { DrawingElement } from './types'
import './App.css'

function App() {
  const { tool, setTool, setShapeType, undo, redo, theme } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        const state = useStore.getState()
        if (state.tool !== 'select' || !state.selectionRect) return
        const copied = state.elements.filter((el) => isElementInRect(el, state.selectionRect!))
        if (copied.length > 0) state.setClipboard(copied.map((el: DrawingElement) => ({ ...el })))
        state.setSelectionRect(null)
        setTool('pen')
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault()
        const state = useStore.getState()
        if (state.tool !== 'select' || !state.selectionRect) return
        const toCut = state.elements.filter((el) => isElementInRect(el, state.selectionRect!))
        if (toCut.length > 0) {
          state.setClipboard(toCut)
          state.removeElements(toCut.map((el: DrawingElement) => el.id))
        }
        state.setSelectionRect(null)
        setTool('pen')
        return
      }

      if (e.key === 'Escape') {
        if (useStore.getState().selectionRect) {
          useStore.getState().setSelectionRect(null)
        }
        setTool('cursor')
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        const state = useStore.getState()
        if (state.clipboard.length === 0) return
        const cx = state.pasteWorldPos.x, cy = state.pasteWorldPos.y
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const el of state.clipboard) {
          if (el.type === 'path') {
            for (const p of el.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
          } else if (el.type === 'shape') {
            minX = Math.min(minX, el.startPoint.x, el.endPoint.x)
            minY = Math.min(minY, el.startPoint.y, el.endPoint.y)
            maxX = Math.max(maxX, el.startPoint.x, el.endPoint.x)
            maxY = Math.max(maxY, el.startPoint.y, el.endPoint.y)
          }
        }
        const ox = cx - (minX + maxX) / 2, oy = cy - (minY + maxY) / 2
        const pasted = state.clipboard.map((el) => {
          const clone = structuredClone(el)
          clone.id = crypto.randomUUID()
          if (clone.type === 'path') {
            clone.points = clone.points.map((p) => ({ x: p.x + ox, y: p.y + oy }))
          } else if (clone.type === 'shape') {
            clone.startPoint = { x: clone.startPoint.x + ox, y: clone.startPoint.y + oy }
            clone.endPoint = { x: clone.endPoint.x + ox, y: clone.endPoint.y + oy }
          }
          return clone
        })
        state.addElements(pasted)
        return
      }

      const key = e.key.toLowerCase()

      switch (key) {
        case 'd':
          setTool('pen')
          break
        case 'l':
          setTool('laser')
          break
        case 'e':
          setTool('eraser')
          break
        case 'c':
          setTool('select')
          break
        case 'm':
          setTool('cursor')
          break
        case 'r':
          setTool('shapes')
          setShapeType('rectangle')
          break
        case 'o':
          setTool('shapes')
          setShapeType('circle')
          break
        case 'a':
          setTool('shapes')
          setShapeType('arrow')
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [tool, setTool, setShapeType, undo, redo])

  return (
    <div className="app">
      <Toolbar />
      <Canvas />
    </div>
  )
}

export default App
