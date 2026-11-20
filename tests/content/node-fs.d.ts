declare module 'node:fs' {
  export function readdirSync(path: string, options: { recursive: true }): string[]
  export function writeFileSync(path: string, data: string): void
  export function rmSync(path: string, options?: { force?: boolean }): void
}
