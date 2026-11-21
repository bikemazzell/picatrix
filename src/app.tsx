import { useEffect, useState } from 'preact/hooks'
import { About } from './views/About'
import { Day } from './views/Day'
import { Month } from './views/Month'
import { Nav } from './views/Nav'
import { Now } from './views/Now'
import { SettingsView } from './views/SettingsView'

export type Route =
  | { view: 'now' }
  | { view: 'day'; date: string }
  | { view: 'month'; month: string }
  | { view: 'settings' }
  | { view: 'about' }

const DAY = /^\/day\/(\d{4}-\d{2}-\d{2})$/
const MONTH = /^\/month\/(\d{4}-\d{2})$/

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const day = DAY.exec(path)
  if (day) return { view: 'day', date: day[1] }
  const month = MONTH.exec(path)
  if (month) return { view: 'month', month: month[1] }
  if (path === '/settings') return { view: 'settings' }
  if (path === '/about') return { view: 'about' }
  return { view: 'now' }
}

function View({ route }: { route: Route }) {
  switch (route.view) {
    case 'day':
      return <Day date={route.date} />
    case 'month':
      return <Month month={route.month} />
    case 'settings':
      return <SettingsView />
    case 'about':
      return <About />
    case 'now':
      return <Now />
  }
}

export function App() {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return (
    <>
      <Nav view={route.view} />
      <main class={`view-${route.view}`}>
        <View route={route} />
      </main>
    </>
  )
}
