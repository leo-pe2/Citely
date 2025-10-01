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

function normalizeLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim())
}

function buildBulletLines(content: string): string[] {
  const lines = normalizeLines(content)
  const hasContent = lines.some((line) => line.length > 0)
  if (!hasContent) return ['-']
  const [first, ...rest] = lines
  const firstLine = first.length > 0 ? `- ${first}` : '-'
  const remainder = rest.map((line) => (line.length > 0 ? `  ${line}` : '  '))
  return [firstLine, ...remainder]
}

function buildCommentLines(comment: string): string[] {
  const lines = normalizeLines(comment)
  if (lines.length === 0) return []
  const [first, ...rest] = lines
  const formatted: string[] = []
  formatted.push(`  Comment: ${first}`)
  rest.forEach((line) => {
    formatted.push(line.length > 0 ? `  ${line}` : '  ')
  })
  return formatted
}

export function exportHighlightsAsMarkdown({ highlights, fileName }: { highlights: ExportHighlight[]; fileName: string }): ExportResult {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    throw new Error('No highlights available to export')
  }

  const ordered = orderHighlights(highlights)
  const baseName = sanitizeFileBase(fileName)

  const sections: Record<string, { pageNumber?: number; entries: string[][] }> = {}
  let screenshotCount = 0

  ordered.forEach((highlight) => {
    const pageNumber = resolvePageNumber(highlight)
    const pageKey = typeof pageNumber === 'number' ? String(pageNumber) : 'unassigned'
    if (!sections[pageKey]) {
      sections[pageKey] = { pageNumber, entries: [] }
    }
    const section = sections[pageKey]
    const commentText = highlight?.comment?.text ? String(highlight.comment.text).trim() : ''
    const commentLines = commentText.length > 0 ? buildCommentLines(commentText) : []

    if (highlight.kind === 'screenshot' && highlight?.screenshot?.dataUrl) {
      screenshotCount += 1
      const lines: string[] = ['- Screenshot']
      lines.push(`  ![Screenshot ${screenshotCount}](${highlight.screenshot.dataUrl})`)
      if (commentLines.length > 0) {
        lines.push(...commentLines)
      }
      section.entries.push(lines)
      return
    }

    const textContent = highlight?.content?.text ? String(highlight.content.text).trim() : ''
    const lines = buildBulletLines(textContent)
    if (commentLines.length > 0) {
      lines.push('  ')
      lines.push(...commentLines)
    }
    section.entries.push(lines)
  })

  const pageKeys = Object.keys(sections).sort((a, b) => {
    const pageA = a === 'unassigned' ? Number.POSITIVE_INFINITY : parseInt(a, 10)
    const pageB = b === 'unassigned' ? Number.POSITIVE_INFINITY : parseInt(b, 10)
    return pageA - pageB
  })

  const chunks: string[] = []
  pageKeys.forEach((key, idx) => {
    const section = sections[key]
    if (idx > 0) {
      chunks.push('')
    }
    const heading = typeof section.pageNumber === 'number' ? `**Page ${section.pageNumber}**` : '**Page —**'
    chunks.push(heading)
    if (section.entries.length > 0) {
      chunks.push('')
      section.entries.forEach((entry, entryIdx) => {
        chunks.push(entry.join('\n'))
        if (entryIdx < section.entries.length - 1) {
          chunks.push('')
        }
      })
    }
  })

  const output = chunks.join('\n')
  const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' })
  const downloadName = `annotations_${baseName}.md`
  createDownload(blob, downloadName)
  return { ok: true }
}
