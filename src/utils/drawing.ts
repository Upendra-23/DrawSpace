import type { Point, ShapeType, DrawingElement, TextElement } from '../types'

export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55
}

export function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  strokeWidth: number,
  opacity: number = 1,
) {
  if (points.length < 2) return

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2
    const yc = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc)
  }

  if (points.length > 1) {
    const last = points[points.length - 1]
    ctx.lineTo(last.x, last.y)
  }

  ctx.stroke()
  ctx.restore()
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.abs(end.x - start.x)
  const h = Math.abs(end.y - start.y)

  ctx.beginPath()

  switch (shapeType) {
    case 'rectangle': {
      const r = Math.min(12, Math.min(w, h) * 0.15)
      ctx.roundRect(x, y, w, h, r)
      ctx.stroke()
      break
    }

    case 'circle':
      const cx = (start.x + end.x) / 2
      const cy = (start.y + end.y) / 2
      const rx = w / 2
      const ry = h / 2
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      break

    case 'line':
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      break

    case 'arrow':
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()

      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const headLen = 15 + strokeWidth * 2
      drawArrowhead(ctx, end.x, end.y, angle, headLen, color)
      break

    case 'triangle':
      ctx.moveTo(end.x, end.y)
      ctx.lineTo(start.x, end.y)
      ctx.lineTo((start.x + end.x) / 2, start.y)
      ctx.closePath()
      ctx.stroke()
      break
  }

  ctx.restore()
}

export function formatCanvasFontFamily(fontFamily: string): string {
  return fontFamily.split(',').map(f => {
    f = f.trim()
    const clean = f.replace(/['"]/g, '')
    if (/\s/.test(clean)) return `"${clean}"`
    return clean
  }).join(', ')
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
  fontFamily: string,
  opacity: number = 1,
) {
  if (!text) return
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.2
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  ctx.font = `${fontSize}px ${formatCanvasFontFamily(fontFamily)}`
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight)
  }
  ctx.restore()
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  color: string,
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(
    x - length * Math.cos(angle - Math.PI / 6),
    y - length * Math.sin(angle - Math.PI / 6),
  )
  ctx.lineTo(
    x - length * Math.cos(angle + Math.PI / 6),
    y - length * Math.sin(angle + Math.PI / 6),
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function dist(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function isPointNearElement(point: Point, el: DrawingElement, threshold: number): boolean {
  switch (el.type) {
    case 'path':
      for (const p of el.points) {
        if (dist(point, p) < threshold) return true
      }
      return false

    case 'text': {
      const lines = el.text.split('\n')
      const lineHeight = el.fontSize * 1.2
      const w = estimateTextWidth(el.text, el.fontSize)
      return (
        point.x >= el.x - threshold &&
        point.y >= el.y - threshold &&
        point.x <= el.x + w + threshold &&
        point.y <= el.y + lines.length * lineHeight + threshold
      )
    }

    case 'shape': {
      const x1 = Math.min(el.startPoint.x, el.endPoint.x)
      const y1 = Math.min(el.startPoint.y, el.endPoint.y)
      const x2 = Math.max(el.startPoint.x, el.endPoint.x)
      const y2 = Math.max(el.startPoint.y, el.endPoint.y)
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2

      switch (el.shapeType) {
        case 'rectangle':
          return (
            pointToSegmentDist(point, { x: x1, y: y1 }, { x: x2, y: y1 }) < threshold ||
            pointToSegmentDist(point, { x: x2, y: y1 }, { x: x2, y: y2 }) < threshold ||
            pointToSegmentDist(point, { x: x2, y: y2 }, { x: x1, y: y2 }) < threshold ||
            pointToSegmentDist(point, { x: x1, y: y2 }, { x: x1, y: y1 }) < threshold
          )
        case 'circle': {
          const rx = (x2 - x1) / 2
          const ry = (y2 - y1) / 2
          if (rx === 0 || ry === 0) return false
          const d = ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2
          return Math.abs(Math.sqrt(d) - 1) * Math.min(rx, ry) < threshold
        }
        case 'line':
        case 'arrow':
          return pointToSegmentDist(point, el.startPoint, el.endPoint) < threshold
        case 'triangle':
          const t1 = { x: el.endPoint.x, y: el.endPoint.y }
          const t2 = { x: el.startPoint.x, y: el.endPoint.y }
          const t3 = { x: (el.startPoint.x + el.endPoint.x) / 2, y: el.startPoint.y }
          return (
            pointToSegmentDist(point, t1, t2) < threshold ||
            pointToSegmentDist(point, t2, t3) < threshold ||
            pointToSegmentDist(point, t3, t1) < threshold
          )
        default:
          return false
      }
    }

    default:
      return false
  }
}

export function getTextBounds(el: TextElement): { x: number; y: number; width: number; height: number } {
  const lines = el.text.split('\n')
  const lineHeight = el.fontSize * 1.2
  return {
    x: el.x,
    y: el.y,
    width: estimateTextWidth(el.text, el.fontSize),
    height: lines.length * lineHeight,
  }
}

type Rect = { x: number; y: number; width: number; height: number }

export function isElementInRect(el: DrawingElement, rect: Rect): boolean {
  const r = rect

  switch (el.type) {
    case 'path':
      for (const p of el.points) {
        if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) {
          return true
        }
      }
      return false

    case 'shape': {
      const ex = Math.min(el.startPoint.x, el.endPoint.x)
      const ey = Math.min(el.startPoint.y, el.endPoint.y)
      const ew = Math.abs(el.endPoint.x - el.startPoint.x)
      const eh = Math.abs(el.endPoint.y - el.startPoint.y)
      return !(ex + ew < r.x || ex > r.x + r.width || ey + eh < r.y || ey > r.y + r.height)
    }

    case 'text': {
      const tb = getTextBounds(el)
      return !(tb.x + tb.width < r.x || tb.x > r.x + r.width || tb.y + tb.height < r.y || tb.y > r.y + r.height)
    }

    default:
      return false
  }
}
