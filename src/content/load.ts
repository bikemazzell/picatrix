export interface ContentEntry {
  id: string
  title: string
  source: string
  body: string
  sections?: {
    essence: string
    goodFor: string
    notGoodFor: string
    talisman: string
  }
}

const MANSION_SECTIONS = ['Essence', 'Good For', 'Not Good For', 'Talisman'] as const

const files = import.meta.glob('/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const entries = new Map<string, ContentEntry>()

for (const [path, raw] of Object.entries(files)) {
  const id = path.slice('/content/'.length, -'.md'.length)
  entries.set(id, parseEntry(id, raw))
}

function parseFrontMatter(
  id: string,
  raw: string,
): { title: string; source: string; body: string } {
  const lines = raw.split('\n')
  const blank = lines.indexOf('')
  const head = blank === -1 ? lines : lines.slice(0, blank)
  const body = (blank === -1 ? [] : lines.slice(blank + 1)).join('\n').trim()
  const pairs = head.map(line => {
    const colon = line.indexOf(':')
    return colon === -1 ? null : [line.slice(0, colon), line.slice(colon + 1).trim()]
  })
  if (head.length !== 2 || pairs.some(pair => pair === null)) {
    throw new Error(`${id}: front matter must be exactly two key lines`)
  }
  const map = new Map(pairs as [string, string][])
  const title = map.get('title') ?? ''
  const source = map.get('source') ?? ''
  if (map.size !== 2 || !title || !source) {
    throw new Error(`${id}: front matter must hold one title and one source, each with a value`)
  }
  return { title, source, body }
}

function parseEntry(id: string, raw: string): ContentEntry {
  const { title, source, body } = parseFrontMatter(id, raw)
  const entry: ContentEntry = { id, title, source, body }
  if (id.startsWith('mansion/')) entry.sections = parseMansionSections(id, body)
  return entry
}

function parseMansionSections(
  id: string,
  body: string,
): NonNullable<ContentEntry['sections']> {
  const found = new Map<string, string>()
  for (const part of body.split(/^## /m).slice(1)) {
    const newline = part.indexOf('\n')
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim()
    found.set(heading, (newline === -1 ? '' : part.slice(newline + 1)).trim())
  }
  const sections = {} as Record<(typeof MANSION_SECTIONS)[number], string>
  for (const heading of MANSION_SECTIONS) {
    const text = found.get(heading)
    if (!text) throw new Error(`${id}: missing ## ${heading} section`)
    sections[heading] = text
  }
  return {
    essence: sections.Essence,
    goodFor: sections['Good For'],
    notGoodFor: sections['Not Good For'],
    talisman: sections.Talisman,
  }
}

export function getContent(id: string): ContentEntry {
  const entry = entries.get(id)
  if (!entry) throw new Error(`unknown content id: ${id}`)
  return entry
}
