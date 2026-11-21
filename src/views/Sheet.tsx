import { useEffect, useRef } from 'preact/hooks'
import { getContent } from '../content/load'
import type { ContentEntry } from '../content/load'

type Sections = NonNullable<ContentEntry['sections']>

const SECTION_HEADINGS: ReadonlyArray<[keyof Sections, string]> = [
  ['essence', 'Essence'],
  ['goodFor', 'Good For'],
  ['notGoodFor', 'Not Good For'],
  ['talisman', 'Talisman'],
]

function Blocks({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .map(block => block.split('\n'))
        .map((lines, index) =>
          lines[0].startsWith('- ') ? (
            <ul key={index}>
              {lines.map((line, i) => (
                <li key={i}>{line.replace(/^- /, '')}</li>
              ))}
            </ul>
          ) : (
            <p key={index}>{lines.join(' ')}</p>
          ),
        )}
    </>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

function keepFocusInside(event: KeyboardEvent, sheet: HTMLElement | null): void {
  if (sheet === null) return
  const focusable = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const leaving = event.shiftKey
    ? active === first || active === sheet || !sheet.contains(active)
    : active === last || !sheet.contains(active)
  if (!leaving) return
  event.preventDefault()
  const target = event.shiftKey ? last : first
  target.focus()
}

export function Sheet({ contentId, onClose }: { contentId: string; onClose: () => void }) {
  const entry = getContent(contentId)
  const sections = entry.sections
  const sheetRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previouslyFocused !== null) previouslyFocused.focus()
    }
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') keepFocusInside(event, sheetRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={entry.title}
        class="sheet"
        onClick={event => event.stopPropagation()}
      >
        <header class="sheet-header">
          <h2>{entry.title}</h2>
          <button type="button" class="pill" onClick={onClose}>
            Close
          </button>
        </header>
        <p class="source">{entry.source}</p>
        {sections
          ? SECTION_HEADINGS.map(([key, heading]) => (
              <div class="sheet-section" key={key}>
                <h3>{heading}</h3>
                <Blocks text={sections[key]} />
              </div>
            ))
          : <Blocks text={entry.body} />}
      </section>
    </div>
  )
}
