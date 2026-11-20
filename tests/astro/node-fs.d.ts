declare module 'node:fs' {
  export function readdirSync(path: string): string[]
  export function readFileSync(path: string, encoding: string): string
  export function existsSync(path: string): boolean
}
