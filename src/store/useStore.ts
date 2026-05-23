import { create } from 'zustand'
import type { ToolType, ShapeType, DrawingElement, Point, ThemeType } from '../types'

interface DrawingState {
  tool: ToolType
  shapeType: ShapeType
  color: string
  bgColor: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
  zoom: number
  panX: number
  panY: number
  theme: ThemeType
  elements: DrawingElement[]
  history: DrawingElement[][]
  historyIndex: number
  clipboard: DrawingElement[]
  pasteWorldPos: Point
  selectionRect: { x: number; y: number; width: number; height: number } | null
  setTool: (tool: ToolType) => void
  setShapeType: (shapeType: ShapeType) => void
  setColor: (color: string) => void
  setBgColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  setTheme: (theme: ThemeType) => void
  toggleTheme: () => void
  addElement: (element: DrawingElement) => void
  addElements: (elements: DrawingElement[]) => void
  updateElement: (id: string, updater: (el: DrawingElement) => DrawingElement) => void
  replaceElement: (id: string, updater: (el: DrawingElement) => DrawingElement) => void
  removeElements: (ids: string[]) => void
  clearCanvas: () => void
  undo: () => void
  redo: () => void
  setClipboard: (elements: DrawingElement[]) => void
  setPasteWorldPos: (pos: Point) => void
  setSelectionRect: (rect: { x: number; y: number; width: number; height: number } | null) => void
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export const useStore = create<DrawingState>((set) => ({
  tool: 'pen',
  shapeType: 'rectangle',
  color: '#ffffff',
  bgColor: '#0d0d1a',
  strokeWidth: 3,
  fontSize: 24,
  fontFamily: "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive",
  zoom: 1,
  panX: 0,
  panY: 0,
  theme: 'dark',
  elements: [],
  history: [],
  historyIndex: -1,
  clipboard: [],
  pasteWorldPos: { x: 0, y: 0 },
  selectionRect: null,

  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setColor: (color) => set({ color }),
  setBgColor: (bgColor) => set({ bgColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setZoom: (zoom) => set({ zoom: clamp(zoom, 0.1, 10) }),
  setPan: (panX, panY) => set({ panX, panY }),
  setTheme: (theme) => set((state) => {
    if (theme === state.theme) return state
    const oldDefault = theme === 'dark' ? '#000000' : '#ffffff'
    const newDefault = theme === 'dark' ? '#ffffff' : '#000000'
    const remap = (c: string) => c === oldDefault ? newDefault : c
    const mapEl = (e: DrawingElement) => ({ ...e, color: remap(e.color) })
    return {
      theme,
      color: newDefault,
      bgColor: theme === 'dark' ? '#0d0d1a' : '#ffffff',
      elements: state.elements.map(mapEl),
      history: state.history.map((arr) => arr.map(mapEl)),
    }
  }),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light'
    const oldDefault = state.theme === 'dark' ? '#ffffff' : '#000000'
    const newDefault = newTheme === 'dark' ? '#ffffff' : '#000000'
    const remap = (c: string) => c === oldDefault ? newDefault : c
    const mapEl = (e: DrawingElement) => ({ ...e, color: remap(e.color) })
    return {
      theme: newTheme,
      color: newDefault,
      bgColor: newTheme === 'dark' ? '#0d0d1a' : '#ffffff',
      elements: state.elements.map(mapEl),
      history: state.history.map((arr) => arr.map(mapEl)),
    }
  }),

  addElement: (element) => set((state) => {
    const newElements = [...state.elements, element]
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push(newElements)
    return { elements: newElements, history, historyIndex: history.length - 1 }
  }),

  addElements: (elements) => set((state) => {
    const newElements = [...state.elements, ...elements]
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push(newElements)
    return { elements: newElements, history, historyIndex: history.length - 1 }
  }),

  setClipboard: (clipboard) => set({ clipboard }),
  setPasteWorldPos: (pasteWorldPos) => set({ pasteWorldPos }),
  setSelectionRect: (selectionRect) => set({ selectionRect }),

  updateElement: (id, updater) => set((state) => {
    const idx = state.elements.findIndex((e) => e.id === id)
    if (idx === -1) return state
    const newElements = state.elements.map((e, i) => i === idx ? updater(e) : e)
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push(newElements)
    return { elements: newElements, history, historyIndex: history.length - 1 }
  }),

  replaceElement: (id, updater) => set((state) => {
    const idx = state.elements.findIndex((e) => e.id === id)
    if (idx === -1) return state
    const newElements = state.elements.map((e, i) => i === idx ? updater(e) : e)
    return { elements: newElements }
  }),

  removeElements: (ids) => set((state) => {
    const newElements = state.elements.filter((e) => !ids.includes(e.id))
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push(newElements)
    return { elements: newElements, history, historyIndex: history.length - 1 }
  }),

  clearCanvas: () => set((state) => {
    if (state.elements.length === 0) return state
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push([])
    return { elements: [], history, historyIndex: history.length - 1 }
  }),

  undo: () => set((state) => {
    if (state.historyIndex < 0) return state
    const newIdx = state.historyIndex - 1
    return { elements: newIdx >= 0 ? [...state.history[newIdx]] : [], historyIndex: newIdx }
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state
    const newIdx = state.historyIndex + 1
    return { elements: [...state.history[newIdx]], historyIndex: newIdx }
  }),
}))
