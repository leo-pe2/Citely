import { orderHighlights, resolvePageNumber, type ExportHighlight } from './types'

type ExportResult = {
  ok: true
}

function sanitizeFileBase(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '').trim()
  return base.length > 0 ? base : 'document'
}

function createDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportHighlightsAsMarkdown({ highlights, fileName }: { highlights: ExportHighlight[]; fileName: string }): ExportResult {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    throw new Error('No highlights available to export')
  }

  const ordered = orderHighlights(highlights)
  const now = new Date()
  const baseName = sanitizeFileBase(fileName)

  const sections: Record<string, { pageLabel: string; entries: string[] }> = {}

  ordered.forEach((highlight, index) => {
    const pageNumber = resolvePageNumber(highlight)
    const pageKey = typeof pageNumber === 'number' ? String(pageNumber) : 'unassigned'
    if (!sections[pageKey]) {
      sections[pageKey] = {
        pageLabel: typeof pageNumber === 'number' ? `Page ${pageNumber}` : 'Unassigned',
        entries: [],
      }
    }
    const section = sections[pageKey]
    const commentText = highlight?.comment?.text ? String(highlight.comment.text).trim() : ''

    if (highlight.kind === 'screenshot' && highlight?.screenshot?.dataUrl) {
      const imageLabel = `Screenshot ${index + 1}`
      section.entries.push(`![${imageLabel}](${highlight.screenshot.dataUrl})`)
      if (commentText.length > 0) {
        section.entries.push(`> ${commentText}`)
      }
      section.entries.push('')
      return
    }

    const textContent = highlight?.content?.text ? String(highlight.content.text).trim() : ''
    const bullet = textContent.length > 0 ? `- ${textContent}` : '-'
    section.entries.push(bullet)
    if (commentText.length > 0) {
      section.entries.push(`  - _Comment:_ ${commentText}`)
    }
  })

  const pageKeys = Object.keys(sections).sort((a, b) => {
    const pageA = a === 'unassigned' ? Number.POSITIVE_INFINITY : parseInt(a, 10)
    const pageB = b === 'unassigned' ? Number.POSITIVE_INFINITY : parseInt(b, 10)
    return pageA - pageB
  })

  const chunks: string[] = []
  chunks.push(`# Highlights — ${fileName}`)
  chunks.push('')
  chunks.push(`_Exported ${now.toLocaleString()}_`)
  chunks.push('')

  pageKeys.forEach((key, idx) => {
    const section = sections[key]
    const headingPrefix = idx === 0 ? '' : '\n'
    chunks.push(`${headingPrefix}## ${section.pageLabel}`)
    chunks.push('')
    chunks.push(...section.entries)
  })

  const output = chunks.join('\n')
  const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' })
  createDownload(blob, `${baseName} - highlights.md`)
  return { ok: true }
}
