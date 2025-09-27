export type ExportHighlight = {
  id?: string | null
  kind?: string | null
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
    } | null
    rects?: Array<{
      pageNumber?: number | null
    }> | null
  } | null
  screenshot?: {
    dataUrl?: string | null
    cssWidth?: number | null
    cssHeight?: number | null
    devicePixelRatio?: number | null
    pageNumber?: number | null
  } | null
};

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
    }))
    .sort((a, b) => (a.page === b.page ? a.index - b.index : a.page - b.page))
    .map((item) => item.highlight)
}
