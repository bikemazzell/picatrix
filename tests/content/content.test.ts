import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { allContentIds } from '../../src/content/ids'
import { getContent } from '../../src/content/load'
import { ASPECT_NAMES, MANSION_NAMES, PLANET_NAMES, SIGN_NAMES } from '../../src/content/names'

function contentFiles(): string[] {
  return readdirSync('content', { recursive: true, encoding: 'utf8' }).filter(file =>
    file.endsWith('.md'),
  )
}

describe('content ids and files', () => {
  it('lists ids without duplicates', () => {
    const ids = allContentIds()
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every id a file', () => {
    for (const id of allContentIds()) {
      expect(existsSync(`content/${id}.md`)).toBe(true)
    }
  })

  it('gives every file an id', () => {
    const ids = new Set(allContentIds())
    for (const file of contentFiles()) {
      expect(ids.has(file.replace(/\.md$/, ''))).toBe(true)
    }
  })
})

describe('mansion entries', () => {
  const ids = Array.from({ length: 28 }, (_, i) => `mansion/${String(i + 1).padStart(2, '0')}`)

  it('has all four sections in every mansion', () => {
    for (const id of ids) {
      const entry = getContent(id)
      expect(entry.sections).toBeDefined()
      expect(entry.sections!.essence.length).toBeGreaterThan(0)
      expect(entry.sections!.goodFor.length).toBeGreaterThan(0)
      expect(entry.sections!.notGoodFor.length).toBeGreaterThan(0)
      expect(entry.sections!.talisman.length).toBeGreaterThan(0)
      expect(entry.source.length).toBeGreaterThan(0)
    }
  })

  it('cites Book I chapter 4 and Book IV chapter 9 in every mansion source', () => {
    for (const id of ids) {
      const entry = getContent(id)
      expect(entry.source).toMatch(/Book I chapter 4/)
      expect(entry.source).toMatch(/Book IV chapter 9/)
    }
  })

  it('titles the first and last mansion', () => {
    expect(getContent('mansion/01').title).toBe('Al-Sharatain')
    expect(getContent('mansion/28').title).toBe('Batn al-Hut')
  })
})

describe('non-mansion entries', () => {
  it('has a non-empty body and source', () => {
    for (const id of allContentIds()) {
      if (id.startsWith('mansion/')) continue
      const entry = getContent(id)
      expect(entry.body.trim().length).toBeGreaterThan(0)
      expect(entry.source.trim().length).toBeGreaterThan(0)
    }
  })

  it('titles the signs', () => {
    expect(getContent('sign/pisces').title).toBe('Pisces')
    expect(getContent('sign/aries').title).toBe('Aries')
  })
})

describe('loader', () => {
  it('throws on an unknown id', () => {
    expect(() => getContent('nope')).toThrow()
  })
})

describe('file hygiene', () => {
  it('contains no placeholder text', () => {
    for (const file of contentFiles()) {
      const raw = readFileSync(`content/${file}`, 'utf8').toLowerCase()
      expect(raw.includes('text to come')).toBe(false)
      expect(raw.includes('placeholder')).toBe(false)
    }
  })
})

describe('names', () => {
  it('lists the signs in order', () => {
    expect(SIGN_NAMES).toHaveLength(12)
    expect(SIGN_NAMES[0]).toBe('Aries')
    expect(SIGN_NAMES[11]).toBe('Pisces')
  })

  it('lists the mansions in order', () => {
    expect(MANSION_NAMES).toHaveLength(28)
    expect(MANSION_NAMES[0]).toBe('Al-Sharatain')
    expect(MANSION_NAMES[27]).toBe('Batn al-Hut')
  })

  it('names every planet and aspect angle', () => {
    expect(PLANET_NAMES.Mars).toBe('Mars')
    expect(ASPECT_NAMES[120]).toBe('Trine')
    expect(ASPECT_NAMES[0]).toBe('Conjunction')
  })
})

describe('front matter grammar', () => {
  const BROKEN = 'content/zz-broken.md'
  const FRESH_LOADER: string = '../../src/content/load.ts?grammar'

  async function importFreshLoader(): Promise<void> {
    vi.resetModules()
    await expect(import(FRESH_LOADER)).rejects.toThrow(
      'zz-broken: front matter must be exactly two key lines',
    )
  }

  afterEach(() => {
    rmSync(BROKEN, { force: true })
  })

  it('rejects a file whose front matter misses a key', async () => {
    writeFileSync(BROKEN, 'title: Only a Title\n\nA body with no source line.\n')
    await importFreshLoader()
  })

  it('rejects a file whose front matter adds a third line', async () => {
    writeFileSync(BROKEN, 'title: T\nsource: S\nextra: nope\n\nA body with a third key.\n')
    await importFreshLoader()
  })

  it('keeps a colon inside a value, splitting on the first colon only', async () => {
    const probe = 'content/zz-colon.md'
    const colonLoader: string = '../../src/content/load.ts?colon'
    writeFileSync(
      probe,
      'title: T\nsource: Picatrix (adapted), Book I: note\n\nA body.\n',
    )
    try {
      vi.resetModules()
      const mod = await import(colonLoader)
      expect(mod.getContent('zz-colon').source).toBe('Picatrix (adapted), Book I: note')
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

describe('entry bodies', () => {
  it('drops HTML comments, such as the void generator header, from every body', () => {
    for (const id of allContentIds()) {
      const entry = getContent(id)
      const text = [entry.body, ...Object.values(entry.sections ?? {})].join('\n')
      expect(text, id).not.toMatch(/<!--|-->/)
    }
  })

  it('keeps the void prose after the generator header', () => {
    expect(getContent('void/90-mars').body).toMatch(/^The square is one of the two worst aspects/)
  })
})
