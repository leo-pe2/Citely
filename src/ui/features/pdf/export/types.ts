export type ExportHighlight = {
  id?: string | null
  kind?: string | null
  pageRelativeY?: number | null
  content?: {
    text?: string | null
  } | null
  comment?: {
    text?: string | null
  } | null
  position?: {
    pageNumber?: number | null
    boundingRect?: {
      pageNumber?: number | null
      height?: number | null
      top?: number | null
      y1?: number | null
    } | null
    rects?: Array<{
      pageNumber?: number | null
      height?: number | null
      top?: number | null
      y1?: number | null
    }> | null
  } | null
  screenshot?: {
    dataUrl?: string | null
    cssWidth?: number | null
    cssHeight?: number | null
    devicePixelRatio?: number | null
    pageNumber?: number | null
    pageRelativeY?: number | null
  } | null
};

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

type RectLike = {
  height?: number | null
  top?: number | null
  y1?: number | null
}

function extractNormalizedTop(rect: RectLike | null | undefined): number | undefined {
  if (!rect) return undefined
  const rawTop = isNumber(rect.y1) ? rect.y1 : isNumber(rect.top) ? rect.top : undefined
  if (!isNumber(rawTop)) return undefined
  const baseHeight = isNumber(rect.height) && rect.height > 0 ? rect.height : undefined
  if (baseHeight) {
    const ratio = rawTop / baseHeight
    if (Number.isFinite(ratio)) {
      return clamp01(ratio)
    }
  }
  if (rawTop >= 0 && rawTop <= 1) {
    return clamp01(rawTop)
  }
  return undefined
}

function collectPositionTops(position: ExportHighlight['position']): number[] {
  if (!position) return []
  const values: number[] = []
  const bounding = extractNormalizedTop(position.boundingRect)
  if (isNumber(bounding)) values.push(bounding)
  if (Array.isArray(position.rects)) {
    for (const rect of position.rects) {
      const val = extractNormalizedTop(rect)
      if (isNumber(val)) values.push(val)
    }
  }
  return values
}

export function resolvePageVerticalPosition(highlight: ExportHighlight | null | undefined): number | undefined {
  if (!highlight) return undefined
  if (isNumber(highlight.pageRelativeY)) {
    return clamp01(highlight.pageRelativeY)
  }
  if (highlight?.screenshot && isNumber(highlight.screenshot.pageRelativeY)) {
    return clamp01(highlight.screenshot.pageRelativeY)
  }
  const values = collectPositionTops(highlight?.position ?? null)
  if (values.length === 0) return undefined
  return clamp01(Math.min(...values))
}

export function resolvePageNumber(highlight: ExportHighlight | null | undefined): number | undefined {
  if (!highlight) return undefined
  if (highlight.kind === 'screenshot' && typeof highlight?.screenshot?.pageNumber === 'number') {
    return highlight.screenshot.pageNumber ?? undefined
  }
  const explicit = highlight?.position?.pageNumber
  if (typeof explicit === 'number') return explicit
  const rectPage = highlight?.position?.boundingRect?.pageNumber
  if (typeof rectPage === 'number') return rectPage
  const rects = highlight?.position?.rects
  if (Array.isArray(rects)) {
    for (const rect of rects) {
      if (rect && typeof rect.pageNumber === 'number') return rect.pageNumber
    }
  }
  return undefined
}

export function orderHighlights(highlights: ExportHighlight[]): ExportHighlight[] {
  return highlights
    .map((highlight, index) => ({
      highlight,
      index,
      page: resolvePageNumber(highlight) ?? Number.POSITIVE_INFINITY,
      vertical: resolvePageVerticalPosition(highlight) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page
      if (a.vertical !== b.vertical) return a.vertical - b.vertical
      return a.index - b.index
    })
    .map((item) => item.highlight)
}
