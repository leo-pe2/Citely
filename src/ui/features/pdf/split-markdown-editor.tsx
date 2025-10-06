import React from 'react'

type SplitMarkdownEditorProps = {
  projectId: string
  fileName: string
}

// Simple markdown-to-HTML renderer
function renderMarkdown(md: string): string {
  if (!md || md.trim() === '') {
    return '<p class="text-gray-400 italic">Start writing to see the preview...</p>'
  }

  let html = md
  
  // Escape HTML to prevent XSS (except for what we'll intentionally add)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // Headers (must be at start of line)
  html = html.replace(/^### (.+)$/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gim, '<h1>$1</h1>')
  
  // Bold (before italic to handle ** before *)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Process lists line by line
  const lines = html.split('\n')
  const processed: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isUnordered = /^- (.+)$/.test(line)
    const isOrdered = /^\d+\. (.+)$/.test(line)
    
    if (isUnordered || isOrdered) {
      const newListType = isUnordered ? 'ul' : 'ol'
      if (!inList) {
        processed.push(`<${newListType}>`)
        inList = true
        listType = newListType
      } else if (listType !== newListType) {
        processed.push(`</${listType}>`)
        processed.push(`<${newListType}>`)
        listType = newListType
      }
      
      const content = isUnordered 
        ? line.replace(/^- (.+)$/, '$1')
        : line.replace(/^\d+\. (.+)$/, '$1')
      processed.push(`<li>${content}</li>`)
    } else {
      if (inList) {
        processed.push(`</${listType}>`)
        inList = false
        listType = null
      }
      processed.push(line)
    }
  }
  
  // Close any open list
  if (inList && listType) {
    processed.push(`</${listType}>`)
  }
  
  html = processed.join('\n')
  
  // Paragraphs: split by double newlines
  const blocks = html.split('\n\n')
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim()
    // Don't wrap if already a block element
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<li')) {
      return trimmed
    }
    // Wrap in paragraph
    return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
  })
  
  return formattedBlocks.join('')
}

export default function SplitMarkdownEditor({ projectId, fileName }: SplitMarkdownEditorProps) {
  const [content, setContent] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [currentFormat, setCurrentFormat] = React.useState<string>('p')
  const [isBold, setIsBold] = React.useState<boolean>(false)
  const [isItalic, setIsItalic] = React.useState<boolean>(false)
  const hasLoadedRef = React.useRef<boolean>(false)
  const saveDebounceRef = React.useRef<number | null>(null)
  const lastSavedContentRef = React.useRef<string>('')
  const editorRef = React.useRef<HTMLDivElement | null>(null)
  const formatUpdateRafRef = React.useRef<number | null>(null)

  // Derive markdown filename from PDF filename
  const markdownFileName = React.useMemo(() => {
    const baseName = fileName.replace(/\.pdf$/i, '')
    return `${baseName}.md`
  }, [fileName])

  // Load markdown content on mount
  React.useEffect(() => {
    let mounted = true
    setIsLoading(true)
    ;(async () => {
      try {
        const api = (window as any).api
        const saved: string | undefined = await api?.projects?.markdown?.get?.(projectId, markdownFileName)
        if (!mounted) return
        if (typeof saved === 'string' && saved) {
          console.log('[Markdown] loaded content length=', saved.length)
          // Check if it's HTML or markdown
          const isHtml = saved.trim().startsWith('<')
          setContent(isHtml ? saved : saved)
          lastSavedContentRef.current = saved
        } else {
          console.log('[Markdown] no saved content, starting empty')
          setContent('')
          lastSavedContentRef.current = ''
        }
        hasLoadedRef.current = true
        setIsLoading(false)
      } catch (e) {
        console.warn('[Markdown] load failed', e)
        setContent('')
        lastSavedContentRef.current = ''
        hasLoadedRef.current = true
        setIsLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [projectId, markdownFileName])

  // Debounce-save content whenever it changes
  React.useEffect(() => {
    if (!hasLoadedRef.current) return
    const api = (window as any).api
    if (!api?.projects?.markdown?.set) return
    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current)
    const id = window.setTimeout(() => {
      try {
        console.log('[Markdown] debounce-save content length=', content.length)
        api.projects.markdown.set(projectId, markdownFileName, content)
        lastSavedContentRef.current = content
      } catch (e) {
        console.warn('[Markdown] debounce-save failed', e)
      }
    }, 300)
    saveDebounceRef.current = id
    return () => {
      if (id) window.clearTimeout(id)
    }
  }, [projectId, markdownFileName, content])

  // Flush unsaved changes on unmount
  React.useEffect(() => {
    return () => {
      if (!hasLoadedRef.current) return
      if (content !== lastSavedContentRef.current) {
        try {
          console.log('[Markdown] unmount flush save')
          const api = (window as any).api
          api?.projects?.markdown?.set?.(projectId, markdownFileName, content)
        } catch {}
      }
    }
  }, [projectId, markdownFileName, content])

  // Handle markdown formatting commands
  React.useEffect(() => {
    function handleMarkdownInsert(e: Event) {
      const customEvent = e as CustomEvent<{ type: string }>
      const { type } = customEvent.detail
      const editor = editorRef.current
      if (!editor) return

      editor.focus()

      // Helper function to check if we're in a heading
      const checkContext = () => {
        const selection = window.getSelection()
        if (!selection || !selection.anchorNode) return { inHeading: false }
        
        let inHeading = false
        let node: Node | null = selection.anchorNode
        
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            const tagName = element.tagName.toLowerCase()
            if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
              inHeading = true
            }
          }
          node = node.parentNode
        }
        
        return { inHeading }
      }

      switch (type) {
        case 'bold':
          {
            const { inHeading } = checkContext()
            // Don't allow bold in headings
            if (!inHeading) {
              document.execCommand('bold', false)
            }
          }
          break
        case 'italic':
          document.execCommand('italic', false)
          break
        case 'p':
          document.execCommand('formatBlock', false, '<p>')
          break
        case 'h1':
          document.execCommand('formatBlock', false, '<h1>')
          break
        case 'h2':
          document.execCommand('formatBlock', false, '<h2>')
          break
        case 'h3':
          document.execCommand('formatBlock', false, '<h3>')
          break
        case 'list':
          {
            const { inHeading } = checkContext()
            // Don't allow formatting headings as lists
            if (!inHeading) {
              document.execCommand('insertUnorderedList', false)
            }
          }
          break
        case 'link':
          {
            const { inHeading } = checkContext()
            // Don't allow formatting headings as links
            if (!inHeading) {
              const url = prompt('Enter URL:')
              if (url) {
                document.execCommand('createLink', false, url)
              }
            }
          }
          break
        default:
          return
      }

      // Update format state after command execution
      setTimeout(() => {
        try {
          let hasBold = document.queryCommandState('bold')
          const hasItalic = document.queryCommandState('italic')
          
          // Trigger full format update
          const selection = window.getSelection()
          if (selection && selection.anchorNode) {
            let foundFormat = 'p'
            let inHeading = false
            let node: Node | null = selection.anchorNode
            while (node && node !== editorRef.current) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement
                const tagName = element.tagName.toLowerCase()
                if (foundFormat === 'p') {
                  if (tagName === 'h1') {
                    foundFormat = 'h1'
                    inHeading = true
                  } else if (tagName === 'h2') {
                    foundFormat = 'h2'
                    inHeading = true
                  } else if (tagName === 'h3') {
                    foundFormat = 'h3'
                    inHeading = true
                  }
                }
              }
              node = node.parentNode
            }
            
            // Don't show bold as active for headings (they are inherently bold)
            if (inHeading) {
              hasBold = false
            }
            
            setCurrentFormat(foundFormat)
            setIsBold(hasBold)
            setIsItalic(hasItalic)
            window.dispatchEvent(new CustomEvent('editor-format-change', { 
              detail: { format: foundFormat, bold: hasBold, italic: hasItalic } 
            }))
          }
        } catch {}
      }, 0)
    }

    window.addEventListener('markdown-insert', handleMarkdownInsert)
    return () => window.removeEventListener('markdown-insert', handleMarkdownInsert)
  }, [])

  // Detect current format at cursor position
  const updateCurrentFormat = React.useCallback(() => {
    try {
      const selection = window.getSelection()
      if (!selection || !selection.anchorNode) {
        setCurrentFormat('p')
        setIsBold(false)
        setIsItalic(false)
        window.dispatchEvent(new CustomEvent('editor-format-change', { 
          detail: { format: 'p', bold: false, italic: false } 
        }))
        return
      }

      // Use document.queryCommandState for accurate bold/italic detection
      let hasBold = document.queryCommandState('bold')
      const hasItalic = document.queryCommandState('italic')

      let foundFormat = 'p'
      let inHeading = false
      let node: Node | null = selection.anchorNode

      // Find the block-level format
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement
          const tagName = element.tagName.toLowerCase()
          
          // Check for block formats (only set once, first match wins)
          if (foundFormat === 'p') {
            if (tagName === 'h1') {
              foundFormat = 'h1'
              inHeading = true
            } else if (tagName === 'h2') {
              foundFormat = 'h2'
              inHeading = true
            } else if (tagName === 'h3') {
              foundFormat = 'h3'
              inHeading = true
            }
          }
        }
        node = node.parentNode
      }

      // Don't show bold as active for headings (they are inherently bold)
      if (inHeading) {
        hasBold = false
      }

      setCurrentFormat(foundFormat)
      setIsBold(hasBold)
      setIsItalic(hasItalic)
      
      window.dispatchEvent(new CustomEvent('editor-format-change', { 
        detail: { format: foundFormat, bold: hasBold, italic: hasItalic } 
      }))
    } catch (e) {
      console.warn('[Markdown] updateCurrentFormat error', e)
    }
  }, [])

  const requestFormatUpdate = React.useCallback(() => {
    if (formatUpdateRafRef.current !== null) {
      window.cancelAnimationFrame(formatUpdateRafRef.current)
    }
    formatUpdateRafRef.current = window.requestAnimationFrame(() => {
      formatUpdateRafRef.current = null
      updateCurrentFormat()
    })
  }, [updateCurrentFormat])

  // Update content from contentEditable
  const handleInput = React.useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const htmlContent = e.currentTarget.innerHTML
    setContent(htmlContent)
    // Update format after typing
    requestFormatUpdate()
  }, [requestFormatUpdate])

  // Always paste as plain text matching editor formatting (strip external styles/HTML)
  const handlePaste = React.useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    try {
      e.preventDefault()
      const data = e.clipboardData
      let text = data.getData('text/plain')
      if (!text) {
        const html = data.getData('text/html')
        if (html) {
          const tmp = document.createElement('div')
          tmp.innerHTML = html
          text = tmp.textContent || tmp.innerText || ''
        }
      }
      if (!text) return
      // Normalize newlines
      text = text.replace(/\r\n?/g, '\n')
      // If cursor is inside a list item, keep the paste within this bullet only
      let inListItem = false
      try {
        const sel = window.getSelection()
        let node: Node | null = sel?.anchorNode || null
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = (node as HTMLElement).tagName.toLowerCase()
            if (tag === 'li') { inListItem = true; break }
          }
          node = node.parentNode
        }
      } catch {}
      if (inListItem) {
        // Collapse all line breaks to spaces so we don't create multiple bullets
        text = text.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
      }
      // Insert as plain text to avoid pasted styles
      const ok = document.execCommand('insertText', false, text)
      if (!ok) {
        // Fallback manual insertion
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          range.deleteContents()
          const node = document.createTextNode(text)
          range.insertNode(node)
          range.setStartAfter(node)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
    } catch {}
    // Update format after paste
    requestFormatUpdate()
  }, [requestFormatUpdate])

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return

    const editor = editorRef.current
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || !selection.anchorNode) return

    let node: Node | null = selection.anchorNode
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase()
        if (tag === 'li') {
          return
        }
      }
      node = node.parentNode
    }

    e.preventDefault()

    const inserted = document.execCommand('insertLineBreak')
    if (!inserted) {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const br = document.createElement('br')
      range.insertNode(br)
      range.setStartAfter(br)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      if (editorRef.current) {
        setContent(editorRef.current.innerHTML)
      }
    }

    requestFormatUpdate()
  }, [requestFormatUpdate])

  const handleFocus = React.useCallback(() => {
    requestFormatUpdate()
  }, [requestFormatUpdate])

  const handleMouseUp = React.useCallback(() => {
    requestFormatUpdate()
  }, [requestFormatUpdate])

  // Listen for selection/cursor changes
  React.useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const handleSelectionChange = () => {
      requestFormatUpdate()
    }

    const handleKeyUp = () => {
      requestFormatUpdate()
    }

    const handleClick = () => {
      requestFormatUpdate()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    editor.addEventListener('keyup', handleKeyUp)
    editor.addEventListener('click', handleClick)
    editor.addEventListener('mouseup', handleMouseUp)
    editor.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      editor.removeEventListener('keyup', handleKeyUp)
      editor.removeEventListener('click', handleClick)
      editor.removeEventListener('mouseup', handleMouseUp)
      editor.removeEventListener('focus', handleFocus)
      if (formatUpdateRafRef.current !== null) {
        window.cancelAnimationFrame(formatUpdateRafRef.current)
        formatUpdateRafRef.current = null
      }
    }
  }, [requestFormatUpdate, handleMouseUp, handleFocus])

  // Set initial content on editor when loaded
  React.useEffect(() => {
    if (editorRef.current && content && !isLoading) {
      const isHtml = content.trim().startsWith('<')
      editorRef.current.innerHTML = isHtml ? content : renderMarkdown(content)
    }
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
        Loading document...
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-white">
      <div 
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className="w-full min-h-full p-8 text-[15px] leading-relaxed text-gray-900 outline-none prose prose-sm max-w-none markdown-preview"
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseUp={handleMouseUp}
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
        data-placeholder="Start writing your notes..."
      />
    </div>
  )
}
