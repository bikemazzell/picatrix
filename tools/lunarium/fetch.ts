import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fromLocal, toLocal, type LocalDate } from '../../src/calendar/tz'

const YEARS = [2025, 2026, 2027]
const DIR = 'local/lunarium'
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
}

const SECTION_MONTHS: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
}

const SECTION =
  /<h2 class="h5 mt-4">([A-Za-z]+) (\d{4})<\/h2>|<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>/g
const CELL = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) ([A-Za-z]{3}), (\d{1,2}):(\d{2})$/

interface Row {
  start: string
  end: string
}

async function download(year: number): Promise<void> {
  const path = `${DIR}/${year}.html`
  if (existsSync(path)) {
    console.log(`${year}: using cached ${year}.html`)
    return
  }
  const res = await fetch(`https://lunarium.co.uk/calendars/void-of-course/${year}/`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`)
  writeFileSync(path, await res.text())
  console.log(`${year}: downloaded`)
}

function parseCell(cell: string, pageYear: number, sectionMonth: number): Date {
  const match = CELL.exec(cell.trim())
  if (!match) throw new Error(`unparsable cell: ${JSON.stringify(cell)}`)
  const month = MONTHS[match[3]]
  if (!month) throw new Error(`unknown month in cell: ${JSON.stringify(cell)}`)
  let year = pageYear
  if (month === 1 && sectionMonth === 12) year += 1
  else if (month === 12 && sectionMonth === 1) year -= 1
  const date: LocalDate = { y: year, m: month, d: Number(match[2]) }
  const t = fromLocal(date, Number(match[4]), Number(match[5]), 'Europe/London')
  const weekday = toLocal(t, 'Europe/London').weekday
  const expected = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday - 1]
  if (expected !== match[1]) {
    throw new Error(`weekday mismatch in cell ${JSON.stringify(cell)}: local weekday ${weekday}`)
  }
  return t
}

function parseYear(year: number): Row[] {
  const html = readFileSync(`${DIR}/${year}.html`, 'utf8')
  const rows: Row[] = []
  let sectionMonth = 0
  let sectionYear = year
  for (const match of html.matchAll(SECTION)) {
    if (match[1]) {
      sectionMonth = SECTION_MONTHS[match[1]] ?? 0
      sectionYear = Number(match[2])
      if (sectionMonth === 0 || sectionYear !== year) {
        throw new Error(`unexpected section header: ${match[0]}`)
      }
      continue
    }
    if (sectionMonth === 0) throw new Error('table row before any month header')
    const start = parseCell(match[3], year, sectionMonth)
    const end = parseCell(match[4], year, sectionMonth)
    if (end <= start) throw new Error(`end not after start: ${match[3]} / ${match[4]}`)
    const previous = rows[rows.length - 1]
    if (previous && start.toISOString() <= previous.end) {
      throw new Error(`overlapping row after ${previous.end}`)
    }
    rows.push({ start: start.toISOString(), end: end.toISOString() })
  }
  return rows
}

async function main(): Promise<void> {
  mkdirSync(DIR, { recursive: true })
  for (const year of YEARS) {
    await download(year)
    const rows = parseYear(year)
    if (rows.length === 0) throw new Error(`${year}: no periods parsed`)
    writeFileSync(`${DIR}/${year}.json`, `${JSON.stringify(rows, null, 2)}\n`)
    console.log(`${year}: ${rows.length} periods, ${rows[0].start} .. ${rows[rows.length - 1].end}`)
  }
  const table = JSON.parse(readFileSync(`${DIR}/2026.json`, 'utf8')) as Row[]
  const expected = table.find(
    row => row.start === '2026-11-22T07:38:00.000Z' && row.end === '2026-11-22T10:09:00.000Z',
  )
  if (!expected) throw new Error('2026 expectation (2026-11-22T07:38Z..10:09Z) not found')
  console.log('2026 expectation found: 2026-11-22T07:38Z .. 2026-11-22T10:09Z')
}

await main()
