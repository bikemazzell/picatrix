import { useEffect } from 'preact/hooks'
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
        .map(lines =>
          lines[0].startsWith('- ') ? (
            <ul>
              {lines.map((line, i) => (
                <li key={i}>{line.replace(/^- /, '')}</li>
              ))}
            </ul>
          ) : (
            <p key={lines.join(' ')}>{lines.join(' ')}</p>
          ),
        )}
    </>
  )
}

export function Sheet({ contentId, onClose }: { contentId: string; onClose: () => void }) {
  const entry = getContent(contentId)
  const sections = entry.sections
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={entry.title}
        class="sheet"
        onClick={event => event.stopPropagation()}
      >
        <header class="sheet-header">
          <h2>{entry.title}</h2>
          <button type="button" onClick={onClose}>
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
