export type ThemeType = 'light' | 'dark'

export type ToolType = 'pen' | 'shapes' | 'laser' | 'eraser' | 'select' | 'cursor'

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle'

export interface Point {
  x: number
  y: number
}

export interface PathElement {
  id: string
  type: 'path'
  points: Point[]
  color: string
  strokeWidth: number
}

export interface ShapeElement {
  id: string
  type: 'shape'
  shapeType: ShapeType
  startPoint: Point
  endPoint: Point
  color: string
  strokeWidth: number
}

export interface LaserElement {
  id: string
  type: 'laser'
  points: Point[]
  color: string
  strokeWidth: number
  createdAt: number
}

export type DrawingElement = PathElement | ShapeElement | LaserElement
