import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  drawPath, drawShape, isPointNearElement, isElementInRect,
} from '../utils/drawing'
import type { Point } from '../types'

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const currentPoints = useRef<Point[]>([])
  const shapeStart = useRef<Point | null>(null)
  const shapeEnd = useRef<Point | null>(null)
  const selectStart = useRef<Point | null>(null)
  const selectEnd = useRef<Point | null>(null)
  const selectionRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const [, forceRender] = useState(0)
  const selectedElements = useRef<import('../types').DrawingElement[]>([])
  const dragElementId = useRef<string | null>(null)
  const dragOffset = useRef<Point>({ x: 0, y: 0 })

  const laserPoints = useRef<Point[][]>([])
  const laserCurrent = useRef<Point[]>([])
  const laserRaf = useRef<number>(0)
  const isLaserActive = useRef(false)
  const laserTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const spaceHeld = useRef(false)

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCanvasSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        spaceHeld.current = true
        setSpaceCursor('grab')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        setSpaceCursor(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  function setSpaceCursor(grab?: string | null) {
    if (!canvasRef.current) return
    if (grab) {
      canvasRef.current.style.cursor = grab
    } else if (spaceHeld.current) {
      canvasRef.current.style.cursor = 'grab'
    } else {
      canvasRef.current.style.cursor = toolCursor(useStore.getState().tool)
    }
  }

  function screenToWorld(sx: number, sy: number): Point {
    const { panX, panY, zoom } = useStore.getState()
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom }
  }

  function drawGrid(ctx: CanvasRenderingContext2D, zoom: number, panX: number, panY: number, w: number, h: number) {
    const baseSpacing = 20
    const targetScreenPx = 80
    const spacing = baseSpacing * Math.max(1, Math.floor(targetScreenPx / (baseSpacing * zoom)))
    const dotR = Math.max(0.5, 1.5 / zoom)

    const left = -panX / zoom
    const top = -panY / zoom
    const right = (w - panX) / zoom
    const bottom = (h - panY) / zoom

    const sx = Math.floor(left / spacing) * spacing
    const sy = Math.floor(top / spacing) * spacing

    const cols = Math.ceil((right - sx) / spacing)
    const rows = Math.ceil((bottom - sy) / spacing)
    if (cols * rows > 8000) return

    ctx.save()
    ctx.fillStyle = useStore.getState().theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.15)'

    for (let x = sx; x <= right; x += spacing) {
      for (let y = sy; y <= bottom; y += spacing) {
        ctx.beginPath()
        ctx.arc(x, y, dotR, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  }

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { elements, tool, shapeType, color, strokeWidth, zoom, panX, panY, bgColor, selectionRect: storeSelRect } = useStore.getState()

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, zoom, panX, panY, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    for (const el of elements) {
      switch (el.type) {
        case 'path':
          drawPath(ctx, el.points, el.color, el.strokeWidth, 1)
          break
        case 'shape':
          drawShape(ctx, el.shapeType, el.startPoint, el.endPoint, el.color, el.strokeWidth)
          break
      }
    }

    // ── Drag / Selection Highlight ────────────────────────

    const highlightedId = dragElementId.current
    if (highlightedId) {
      const highlightedEl = elements.find((e) => e.id === highlightedId)
      if (highlightedEl) {
        ctx.save()
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 2 / zoom
        ctx.setLineDash([4 / zoom, 3 / zoom])
        if (highlightedEl.type === 'path') {
          if (highlightedEl.points.length > 1) {
            const xs = highlightedEl.points.map((p) => p.x), ys = highlightedEl.points.map((p) => p.y)
            const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
            ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8)
          }
        } else if (highlightedEl.type === 'shape') {
          const x = Math.min(highlightedEl.startPoint.x, highlightedEl.endPoint.x)
          const y = Math.min(highlightedEl.startPoint.y, highlightedEl.endPoint.y)
          const w = Math.abs(highlightedEl.endPoint.x - highlightedEl.startPoint.x)
          const h = Math.abs(highlightedEl.endPoint.y - highlightedEl.startPoint.y)
          ctx.strokeRect(x - 4, y - 4, w + 8, h + 8)
        }
        ctx.restore()
      }
    }

    // ── Live draw previews ────────────────────────────────

    if (tool === 'pen' && currentPoints.current.length > 1) {
      drawPath(ctx, currentPoints.current, color, strokeWidth, 1)
    }

    if (tool === 'shapes' && shapeStart.current && shapeEnd.current) {
      drawShape(ctx, shapeType, shapeStart.current, shapeEnd.current, color, strokeWidth)
    }

    const selRect = storeSelRect || (tool === 'select' && selectStart.current && selectEnd.current
      ? { x: Math.min(selectStart.current.x, selectEnd.current.x), y: Math.min(selectStart.current.y, selectEnd.current.y), width: Math.abs(selectEnd.current.x - selectStart.current.x), height: Math.abs(selectEnd.current.y - selectStart.current.y) }
      : null)
    if (selRect) {
      ctx.save()
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 2 / zoom
      ctx.setLineDash([6 / zoom, 4 / zoom])
      ctx.strokeRect(selRect.x, selRect.y, selRect.width, selRect.height)
      ctx.fillStyle = 'rgba(255,68,68,0.1)'
      ctx.fillRect(selRect.x, selRect.y, selRect.width, selRect.height)
      ctx.restore()
    }

    ctx.restore()
  }

  useEffect(() => {
    function handleStoreChange() {
      const state = useStore.getState()
      const sr = state.selectionRect
      if (!sr && selectionRectRef.current) {
        selectionRectRef.current = null
        selectedElements.current = []
        forceRender((n) => n + 1)
      }
      redraw()
    }
    redraw()
    const unsub = useStore.subscribe(handleStoreChange)
    return () => unsub()
  }, [])

  useEffect(() => {
    return () => {
      if (laserRaf.current) cancelAnimationFrame(laserRaf.current)
      if (laserTimer.current) clearTimeout(laserTimer.current)
    }
  }, [])

  useEffect(() => {
    redraw()
  }, [canvasSize])

  useEffect(() => {
    setSpaceCursor()
    const unsub = useStore.subscribe((state, prev) => {
      if (state.tool !== prev.tool || state.theme !== prev.theme) setSpaceCursor()
    })
    return unsub
  }, [])

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return screenToWorld(clientX - rect.left, clientY - rect.top)
  }, [])

  function scheduleLaserClear() {
    if (laserTimer.current) clearTimeout(laserTimer.current)
    laserTimer.current = setTimeout(() => {
      laserPoints.current = []
      if (!isLaserActive.current && laserRaf.current === 0) redraw()
    }, 1000)
  }

  function startLaser() {
    isLaserActive.current = true
    laserCurrent.current = []
    if (laserTimer.current) { clearTimeout(laserTimer.current); laserTimer.current = null }
    if (!laserRaf.current) laserRaf.current = requestAnimationFrame(laserLoop)
  }

  function laserLoop() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { elements, zoom, panX, panY, bgColor } = useStore.getState()

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, zoom, panX, panY, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    for (const el of elements) {
      switch (el.type) {
        case 'path':
          drawPath(ctx, el.points, el.color, el.strokeWidth, 1)
          break
        case 'shape':
          drawShape(ctx, el.shapeType, el.startPoint, el.endPoint, el.color, el.strokeWidth)
          break
      }
    }

    for (const stroke of laserPoints.current) drawLaserStroke(ctx, stroke, zoom)
    if (isLaserActive.current && laserCurrent.current.length > 1) {
      drawLaserStroke(ctx, laserCurrent.current, zoom)
    }

    ctx.restore()

    if (isLaserActive.current || laserPoints.current.length > 0) {
      laserRaf.current = requestAnimationFrame(laserLoop)
    } else {
      laserRaf.current = 0
    }
  }

  function drawLaserStroke(ctx: CanvasRenderingContext2D, pts: Point[], zoom: number) {
    if (pts.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.shadowBlur = 20 / zoom
    ctx.shadowColor = '#ff0000'
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 7 / zoom
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.strokeStyle = '#ff6666'
    ctx.lineWidth = 5 / zoom
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()

    ctx.strokeStyle = '#ffcccc'
    ctx.lineWidth = 3 / zoom
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5 / zoom
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()

    ctx.restore()
  }

  function beginPan(clientX: number, clientY: number) {
    isPanning.current = true
    const s = useStore.getState()
    panStart.current = { x: clientX, y: clientY, panX: s.panX, panY: s.panY }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
  }

  function doPan(clientX: number, clientY: number) {
    if (!panStart.current) return
    const dx = clientX - panStart.current.x
    const dy = clientY - panStart.current.y
    useStore.getState().setPan(panStart.current.panX + dx, panStart.current.panY + dy)
  }

  function endPan() {
    isPanning.current = false
    panStart.current = null
    setSpaceCursor()
  }

  const startDraw = useCallback((point: Point) => {
    isDrawing.current = true
    const tool = useStore.getState().tool
    if (tool === 'pen') currentPoints.current = [point]
    else if (tool === 'shapes') { shapeStart.current = point; shapeEnd.current = point }
    else if (tool === 'select') { selectStart.current = point; selectEnd.current = point; useStore.getState().setSelectionRect(null) }
    else if (tool === 'cursor') {
      const els = useStore.getState().elements
      const hitEl = els.findLast((el) => isPointNearElement(point, el, 10))
      if (hitEl) {
        dragElementId.current = hitEl.id
        if (hitEl.type === 'path') {
          const cx = hitEl.points.reduce((s, p) => s + p.x, 0) / hitEl.points.length
          const cy = hitEl.points.reduce((s, p) => s + p.y, 0) / hitEl.points.length
          dragOffset.current = { x: point.x - cx, y: point.y - cy }
        } else if (hitEl.type === 'shape') {
          const cx = (hitEl.startPoint.x + hitEl.endPoint.x) / 2
          const cy = (hitEl.startPoint.y + hitEl.endPoint.y) / 2
          dragOffset.current = { x: point.x - cx, y: point.y - cy }
        }
      }
    }
    redraw()
  }, [])

  const moveDraw = useCallback((point: Point) => {
    if (!isDrawing.current) return
    const tool = useStore.getState().tool
    if (tool === 'pen') currentPoints.current.push(point)
    else if (tool === 'shapes') shapeEnd.current = point
    else if (tool === 'select') { selectEnd.current = point }
    else if (tool === 'cursor') {
      if (dragElementId.current) {
        useStore.getState().replaceElement(dragElementId.current, (e) => {
          const targetX = point.x - dragOffset.current.x
          const targetY = point.y - dragOffset.current.y
          if (e.type === 'path') {
            const curCx = e.points.reduce((s, p) => s + p.x, 0) / e.points.length
            const curCy = e.points.reduce((s, p) => s + p.y, 0) / e.points.length
            const dx = targetX - curCx, dy = targetY - curCy
            return { ...e, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
          } else if (e.type === 'shape') {
            const curCx = (e.startPoint.x + e.endPoint.x) / 2
            const curCy = (e.startPoint.y + e.endPoint.y) / 2
            const dx = targetX - curCx, dy = targetY - curCy
            return { ...e, startPoint: { x: e.startPoint.x + dx, y: e.startPoint.y + dy }, endPoint: { x: e.endPoint.x + dx, y: e.endPoint.y + dy } }
          }
          return e
        })
      }
    }
    else if (tool === 'eraser') {
      const threshold = useStore.getState().strokeWidth * 5
      const toRemove: string[] = []
      for (const el of useStore.getState().elements) {
        if (isPointNearElement(point, el, threshold)) toRemove.push(el.id)
      }
      if (toRemove.length > 0) useStore.getState().removeElements(toRemove)
    }
    redraw()
  }, [])

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false
    const state = useStore.getState()

    if (state.tool === 'cursor' && dragElementId.current) {
      const id = dragElementId.current; dragElementId.current = null
      const el = state.elements.find((e) => e.id === id)
      if (el) state.updateElement(id, (e) => e)
      redraw(); return
    }

    if (state.tool === 'pen' && currentPoints.current.length > 1) {
      state.addElement({
        id: crypto.randomUUID(), type: 'path',
        points: [...currentPoints.current], color: state.color, strokeWidth: state.strokeWidth,
      })
      currentPoints.current = []
    }

    if (state.tool === 'shapes' && shapeStart.current && shapeEnd.current) {
      state.addElement({
        id: crypto.randomUUID(), type: 'shape',
        shapeType: state.shapeType,
        startPoint: { ...shapeStart.current }, endPoint: { ...shapeEnd.current },
        color: state.color, strokeWidth: state.strokeWidth,
      })
      shapeStart.current = null; shapeEnd.current = null
    }

    if (state.tool === 'select' && selectStart.current && selectEnd.current) {
      const sx = Math.min(selectStart.current.x, selectEnd.current.x)
      const sy = Math.min(selectStart.current.y, selectEnd.current.y)
      const sw = Math.abs(selectEnd.current.x - selectStart.current.x)
      const sh = Math.abs(selectEnd.current.y - selectStart.current.y)
      selectedElements.current = state.elements.filter((el) =>
        isElementInRect(el, { x: sx, y: sy, width: sw, height: sh })
      )
      const r = { x: sx, y: sy, width: sw, height: sh }
      selectionRectRef.current = r; useStore.getState().setSelectionRect(r); forceRender((n) => n + 1)
      selectStart.current = null; selectEnd.current = null
    }

    redraw()
  }, [])

  // ── Event Handlers ──────────────────────────────────────

  const hMDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      beginPan(e.clientX, e.clientY)
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    const tool = useStore.getState().tool
    if (tool === 'laser') { startLaser(); return }

    startDraw(getCanvasPoint(e))
  }, [getCanvasPoint, startDraw])

  const hMMove = useCallback((e: React.MouseEvent) => {
    const pt = getCanvasPoint(e)
    useStore.getState().setPasteWorldPos(pt)
    if (isPanning.current) { doPan(e.clientX, e.clientY); return }
    if (useStore.getState().tool === 'laser') {
      if (isLaserActive.current) laserCurrent.current.push(pt)
      return
    }
    moveDraw(pt)
  }, [getCanvasPoint, moveDraw])

  const hMUp = useCallback(() => {
    if (isPanning.current) { endPan(); return }
    if (useStore.getState().tool === 'laser') {
      if (isLaserActive.current && laserCurrent.current.length > 0) {
        laserPoints.current.push([...laserCurrent.current])
        laserCurrent.current = []
      }
      isLaserActive.current = false; scheduleLaserClear()
      return
    }
    endDraw()
  }, [endDraw])

  const hMLeave = useCallback(() => {
    if (isPanning.current) { endPan(); return }
    if (useStore.getState().tool === 'laser') {
      if (isLaserActive.current && laserCurrent.current.length > 0) {
        laserPoints.current.push([...laserCurrent.current])
        laserCurrent.current = []
      }
      isLaserActive.current = false; scheduleLaserClear()
      return
    }
    endDraw()
  }, [endDraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const { zoom, panX, panY } = useStore.getState()
      const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15
      const newZoom = Math.max(0.1, Math.min(10, zoom * factor))
      const newPanX = mx - (mx - panX) * (newZoom / zoom)
      const newPanY = my - (my - panY) * (newZoom / zoom)
      useStore.getState().setZoom(newZoom)
      useStore.getState().setPan(newPanX, newPanY)
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [])

  const hTStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2) {
      beginPan(e.touches[0].clientX, e.touches[0].clientY)
      return
    }
    if (useStore.getState().tool === 'laser') { startLaser(); return }
    startDraw(getCanvasPoint(e))
  }, [getCanvasPoint, startDraw])

  const hTMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const pt = getCanvasPoint(e)
    useStore.getState().setPasteWorldPos(pt)
    if (isPanning.current) { doPan(e.touches[0].clientX, e.touches[0].clientY); return }
    if (useStore.getState().tool === 'laser') {
      if (isLaserActive.current) laserCurrent.current.push(pt)
      return
    }
    moveDraw(pt)
  }, [getCanvasPoint, moveDraw])

  const hTEnd = useCallback(() => {
    if (isPanning.current) { endPan(); return }
    if (useStore.getState().tool === 'laser') {
      if (isLaserActive.current && laserCurrent.current.length > 0) {
        laserPoints.current.push([...laserCurrent.current])
        laserCurrent.current = []
      }
      isLaserActive.current = false; scheduleLaserClear()
      return
    }
    endDraw()
  }, [endDraw])

  function cutSelection() {
    if (selectedElements.current.length === 0) return
    useStore.getState().setClipboard(selectedElements.current)
    const ids = selectedElements.current.map((el) => el.id)
    useStore.getState().removeElements(ids)
    selectedElements.current = []
    selectionRectRef.current = null; useStore.getState().setSelectionRect(null); useStore.getState().setTool('pen'); forceRender((n) => n + 1)
  }

  function copySelection() {
    if (selectedElements.current.length === 0) return
    useStore.getState().setClipboard(selectedElements.current.map((el) => ({ ...el })))
    selectedElements.current = []
    selectionRectRef.current = null; useStore.getState().setSelectionRect(null); useStore.getState().setTool('pen'); forceRender((n) => n + 1)
  }

  function clearSelection() {
    selectedElements.current = []
    selectionRectRef.current = null; useStore.getState().setSelectionRect(null); useStore.getState().setTool('pen'); forceRender((n) => n + 1); redraw()
  }

  return (
    <div ref={containerRef} className="canvas-container">
      {selectionRectRef.current && selectedElements.current.length > 0 && (() => {
        const sr = selectionRectRef.current!
        const z = useStore.getState().zoom
        return (
          <div
            className="selection-actions"
            style={{
              left: sr.x * z + useStore.getState().panX,
              top: sr.y * z + useStore.getState().panY - 40,
            }}
          >
            <button onClick={cutSelection}>Cut</button>
            <button onClick={copySelection}>Copy</button>
            <button onClick={clearSelection}>✕</button>
          </div>
        )
      })()}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="drawing-canvas"
        onMouseDown={hMDown}
        onMouseMove={hMMove}
        onMouseUp={hMUp}
        onMouseLeave={hMLeave}
        onTouchStart={hTStart}
        onTouchMove={hTMove}
        onTouchEnd={hTEnd}
      />
    </div>
  )
}

function penCursorUrl(theme: string): string {
  const color = theme === 'dark' ? '#fff' : '#000'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function toolCursor(tool: string): string {
  const theme = useStore.getState().theme
  switch (tool) {
    case 'pen': return `url("${penCursorUrl(theme)}") 2 20, crosshair`
    case 'eraser': return 'crosshair'
    case 'cursor': return 'default'
    default: return 'crosshair'
  }
}
