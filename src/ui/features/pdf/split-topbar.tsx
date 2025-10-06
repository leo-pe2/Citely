import React from 'react'
import xIcon from '../../assets/x.svg'
import exportIcon from '../../assets/export.svg'
import listIcon from '../../assets/list.svg'
import italicIcon from '../../assets/italic.svg'

type SplitTopbarProps = {
  pageTab: 'annotate' | 'writing'
  onChangePageTab: (tab: 'annotate' | 'writing') => void
  searchQuery: string
  onChangeSearchQuery: (value: string) => void
  editorFormat: string
  editorBold: boolean
  editorItalic: boolean
  onExportHighlights: () => void
  onExportWriting: () => void
  onClose: () => void
}

export default function SplitTopbar({
  pageTab,
  onChangePageTab,
  searchQuery,
  onChangeSearchQuery,
  editorFormat,
  editorBold,
  editorItalic,
  onExportHighlights,
  onExportWriting,
  onClose,
}: SplitTopbarProps) {
  const controlBase = 'h-7 px-2 inline-flex items-center justify-center rounded text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200'
  const controlActive = 'bg-gray-200 text-gray-900 shadow-inner'
  const controlInactive = 'text-gray-600 hover:bg-gray-100'

  return (
    <div className="relative flex items-center pl-6 pr-4 py-4 border-b border-gray-200">
      <div className="flex items-center gap-2 min-w-0">
        <nav className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
          <button
            className={`px-2.5 py-1.5 text-sm rounded-[5px] ${pageTab === 'annotate' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => onChangePageTab('annotate')}
          >
            Annotate
          </button>
          <button
            className={`px-2.5 py-1.5 text-sm rounded-[5px] ${pageTab === 'writing' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => onChangePageTab('writing')}
          >
            Writing
          </button>
        </nav>
      </div>
      {pageTab === 'annotate' && (
        <div className="absolute left-1/2 -translate-x-1/2 px-4 w-full max-w-md pointer-events-none z-40">
          <div className="relative pointer-events-auto flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="w-full h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white placeholder:text-gray-400 placeholder:text-center focus:placeholder-transparent focus:outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="Search annotations or comments"
                value={searchQuery}
                onChange={(e) => onChangeSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  className="absolute right-1.5 top-1.5 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100"
                  onClick={() => onChangeSearchQuery('')}
                  title="Clear"
                >
                  <img src={xIcon} alt="" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="relative">
              <button
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
                onClick={onExportHighlights}
                aria-label="Export highlights"
                title="Export"
              >
                <img src={exportIcon} alt="" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      {pageTab === 'writing' && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-40">
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              className={`${controlBase} ${editorFormat === 'p' ? controlActive : controlInactive}`}
              title="Normal Text"
              aria-pressed={editorFormat === 'p'}
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'p' } }))}
            >
              P
            </button>
            <button
              className={`${controlBase} font-semibold ${editorBold ? controlActive : controlInactive}`}
              title="Bold"
              aria-pressed={editorBold}
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'bold' } }))}
            >
              B
            </button>
            <button
              className={`${controlBase} ${editorItalic ? controlActive : controlInactive}`}
              title="Italic"
              aria-pressed={editorItalic}
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'italic' } }))}
            >
              <img src={italicIcon} alt="" className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <button
              className={`${controlBase} font-semibold ${editorFormat === 'h1' ? controlActive : controlInactive}`}
              title="Heading 1"
              aria-pressed={editorFormat === 'h1'}
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'h1' } }))}
            >
              H1
            </button>
            <button
              className={`${controlBase} font-semibold ${editorFormat === 'h2' ? controlActive : controlInactive}`}
              title="Heading 2"
              aria-pressed={editorFormat === 'h2'}
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'h2' } }))}
            >
              H2
            </button>
            <button
              className={`${controlBase} font-semibold ${editorFormat === 'h3' ? controlActive : controlInactive}`}
              title="Heading 3"
              aria-pressed={editorFormat === 'h3'}
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'h3' } }))}
            >
              H3
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <button
              className={`${controlBase} ${controlInactive}`}
              title="Bullet List"
              onClick={() => window.dispatchEvent(new CustomEvent('markdown-insert', { detail: { type: 'list' } }))}
            >
              <img src={listIcon} alt="" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3 min-w-0">
        {pageTab === 'writing' && (
          <button
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
            onClick={onExportWriting}
            aria-label="Export notes"
            title="Export"
          >
            <img src={exportIcon} alt="" className="h-4 w-4" />
          </button>
        )}
        <button
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
          onClick={onClose}
          aria-label="Close split view"
          title="Close"
        >
          <img src={xIcon} alt="" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
