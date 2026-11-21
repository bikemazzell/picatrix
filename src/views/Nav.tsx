import { toLocal } from '../calendar/tz'
import type { Route } from '../app'

function todayYMD(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const t = toLocal(new Date(), tz)
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
}

export function Nav({ view }: { view: Route['view'] }) {
  const today = todayYMD()
  const links: ReadonlyArray<{ view: Route['view']; href: string; label: string }> = [
    { view: 'now', href: '#/now', label: 'Now' },
    { view: 'day', href: `#/day/${today}`, label: 'Day' },
    { view: 'month', href: `#/month/${today.slice(0, 7)}`, label: 'Month' },
    { view: 'settings', href: '#/settings', label: 'Settings' },
    { view: 'about', href: '#/about', label: 'About' },
  ]
  return (
    <nav class="nav">
      {links.map(link => (
        <a
          key={link.view}
          href={link.href}
          class={view === link.view ? 'active' : undefined}
          aria-current={view === link.view ? 'page' : undefined}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}
