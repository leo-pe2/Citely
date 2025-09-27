import React from 'react'
import { Document, Page, Text, View, Image as PdfImage, StyleSheet, pdf } from '@react-pdf/renderer'
import { orderHighlights, resolvePageNumber, type ExportHighlight } from './types'

const CONTENT_WIDTH_PT = 595.28 - 48 // A4 width minus horizontal padding (24 * 2)
const PX_TO_PT = 72 / 96

const styles = StyleSheet.create({
  page: { padding: 24 },
  header: { fontSize: 14, marginBottom: 12 },
  subheader: { fontSize: 10, color: '#666', marginBottom: 12 },
  pageSection: { marginBottom: 16 },
  pageHeader: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  item: { marginBottom: 14, alignItems: 'flex-start' },
  textBlock: { fontSize: 11, lineHeight: 1.35 },
  comment: { marginTop: 6, marginLeft: 12, fontSize: 11, lineHeight: 1.35 },
})

type Size = { width: number; height: number }

type ExportResult = {
  ok: true
}

function sanitizeFileBase(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '').trim()
  return base.length > 0 ? base : 'document'
}

function getHighlightId(highlight: ExportHighlight, fallbackIndex: number): string {
  const id = highlight.id
  return id && id.length > 0 ? id : `highlight_${fallbackIndex}`
}

function getImageNaturalSize(dataUrl: string): Promise<Size | null> {
  return new Promise((resolve) => {
    try {
      const img = new window.Image()
      img.addEventListener('load', () => {
        const width = img.naturalWidth || img.width
        const height = img.naturalHeight || img.height
        resolve(width > 0 && height > 0 ? { width, height } : null)
      })
      img.addEventListener('error', () => resolve(null))
      img.src = dataUrl
    } catch {
      resolve(null)
    }
  })
}

type KeyedHighlight = {
  key: string
  highlight: ExportHighlight
}

type GroupedHighlights = Array<{
  groupKey: string
  pageNumber?: number
  items: KeyedHighlight[]
}>

function buildPageGroups(entries: KeyedHighlight[]): GroupedHighlights {
  const grouped: Record<string, { pageNumber?: number; items: KeyedHighlight[] }> = {}
  entries.forEach((entry) => {
    const page = resolvePageNumber(entry.highlight)
    const key = typeof page === 'number' ? String(page) : 'unassigned'
    if (!grouped[key]) {
      grouped[key] = { pageNumber: page, items: [] }
    }
    grouped[key].items.push(entry)
  })
  return Object.entries(grouped)
    .map(([groupKey, value]) => ({ groupKey, pageNumber: value.pageNumber, items: value.items }))
    .sort((a, b) => {
      const pageA = typeof a.pageNumber === 'number' ? a.pageNumber : Number.POSITIVE_INFINITY
      const pageB = typeof b.pageNumber === 'number' ? b.pageNumber : Number.POSITIVE_INFINITY
      return pageA - pageB
    })
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

export async function exportHighlightsAsPdf({ highlights, fileName }: { highlights: ExportHighlight[]; fileName: string }): Promise<ExportResult> {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    throw new Error('No highlights available to export')
  }

  const ordered = orderHighlights(highlights)
  const keyedHighlights: KeyedHighlight[] = ordered.map((highlight, index) => ({
    highlight,
    key: getHighlightId(highlight, index),
  }))
  const measured = new Map<string, Size | null>()

  await Promise.all(
    keyedHighlights.map(async (entry) => {
      if (entry.highlight.kind === 'screenshot' && entry.highlight?.screenshot?.dataUrl) {
        const size = await getImageNaturalSize(entry.highlight.screenshot.dataUrl)
        measured.set(entry.key, size)
      }
    })
  )

  const groups = buildPageGroups(keyedHighlights)
  const now = new Date()
  const baseName = sanitizeFileBase(fileName)

  const documentNode = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Highlights Export — {fileName}</Text>
        <Text style={styles.subheader}>{now.toLocaleString()}</Text>
        {groups.map((group) => {
          const headerText = typeof group.pageNumber === 'number' ? `Page ${group.pageNumber}` : 'Unassigned'
          return (
            <View key={group.groupKey} style={styles.pageSection} wrap>
              <Text style={styles.pageHeader}>{headerText}</Text>
              {group.items.map((entry) => {
                const { highlight, key } = entry
                if (highlight.kind === 'screenshot' && highlight?.screenshot?.dataUrl) {
                  const screenshot = highlight.screenshot
                  const dataUrl = screenshot?.dataUrl
                  if (!dataUrl) return null
                  const cssWidth = typeof screenshot?.cssWidth === 'number' ? screenshot.cssWidth : undefined
                  const cssHeight = typeof screenshot?.cssHeight === 'number' ? screenshot.cssHeight : undefined
                  const dpr = typeof screenshot?.devicePixelRatio === 'number' && screenshot.devicePixelRatio > 0 ? screenshot.devicePixelRatio : 1
                  let widthPt: number | undefined
                  let heightPt: number | undefined
                  if (typeof cssWidth === 'number' && typeof cssHeight === 'number' && cssWidth > 0 && cssHeight > 0) {
                    widthPt = cssWidth * PX_TO_PT
                    heightPt = cssHeight * PX_TO_PT
                  } else {
                    const measuredSize = measured.get(key)
                    if (measuredSize) {
                      widthPt = (measuredSize.width / dpr) * PX_TO_PT
                      heightPt = (measuredSize.height / dpr) * PX_TO_PT
                    }
                  }
                  if (widthPt && heightPt) {
                    const maxWidth = Math.min(widthPt, CONTENT_WIDTH_PT)
                    const scaledHeight = (heightPt * maxWidth) / widthPt
                    return (
                      <View key={`${group.groupKey}_${key}`} style={styles.item} wrap={false}>
                        <PdfImage
                          src={dataUrl}
                          style={{
                            width: maxWidth,
                            height: scaledHeight,
                            minWidth: maxWidth,
                            maxWidth: maxWidth,
                            minHeight: scaledHeight,
                            maxHeight: scaledHeight,
                            alignSelf: 'flex-start',
                            objectFit: 'scale-down',
                          }}
                        />
                        {highlight?.comment?.text ? (
                          <Text style={styles.comment}>• {highlight.comment.text}</Text>
                        ) : null}
                      </View>
                    )
                  }
                  const fallbackWidth = Math.min(320 * PX_TO_PT, CONTENT_WIDTH_PT)
                  return (
                    <View key={`${group.groupKey}_${key}`} style={styles.item} wrap={false}>
                      <PdfImage
                        src={dataUrl}
                        style={{
                          width: fallbackWidth,
                          minWidth: fallbackWidth,
                          maxWidth: fallbackWidth,
                          alignSelf: 'flex-start',
                          objectFit: 'scale-down',
                        }}
                      />
                      {highlight?.comment?.text ? <Text style={styles.comment}>• {highlight.comment.text}</Text> : null}
                    </View>
                  )
                }

                const text = highlight?.content?.text ? String(highlight.content.text).trim() : ''
                const comment = highlight?.comment?.text ? String(highlight.comment.text).trim() : ''
                return (
                  <View key={`${group.groupKey}_${key}`} style={styles.item} wrap>
                    <Text style={styles.textBlock}>{text.length > 0 ? `- ${text}` : '-'}</Text>
                    {comment.length > 0 ? <Text style={styles.comment}>• {comment}</Text> : null}
                  </View>
                )
              })}
            </View>
          )
        })}
      </Page>
    </Document>
  )

  const blob = await pdf(documentNode).toBlob()
  createDownload(blob, `${baseName} - highlights.pdf`)
  return { ok: true }
}
