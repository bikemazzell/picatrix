import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const swPath = join(distDir, 'sw.js')

if (!existsSync(swPath)) {
  console.error(`precache check failed: ${swPath} not found; run npm run build first`)
  process.exit(1)
}

const sw = readFileSync(swPath, 'utf8')
const urls = [...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1])
const precached = new Set(urls.map((url) => url.replace(/^\//, '').replace(/^picatrix\//, '')))

const missing: string[] = []
if (!precached.has('index.html')) missing.push('index.html')

const assetsDir = join(distDir, 'assets')
const chunks = existsSync(assetsDir)
  ? readdirSync(assetsDir, { recursive: true })
      .map((entry) => entry.toString())
      .filter((entry) => /\.(js|css)$/.test(entry))
  : []
for (const chunk of chunks) {
  if (!precached.has(`assets/${chunk}`)) missing.push(`assets/${chunk}`)
}

const strayTexts = urls.filter((url) => /^\/?(picatrix\/)?content\/.*\.md$/.test(url))
if (strayTexts.length > 0) {
  console.error('precache check failed: content texts must be inlined into JS chunks, found as separate URLs:')
  for (const url of strayTexts) console.error(`  ${url}`)
  process.exit(1)
}

if (missing.length > 0) {
  console.error(`precache check failed: ${missing.length} of ${chunks.length + 1} required entries missing from dist/sw.js:`)
  for (const entry of missing) console.error(`  ${entry}`)
  process.exit(1)
}

console.log(`precache check passed: ${urls.length} precache entries, index.html plus ${chunks.length} hashed chunks present`)
