import { useEffect, useState } from 'preact/hooks'
import { Nav } from './views/Nav'

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

function Placeholder({ route }: { route: Route }) {
  switch (route.view) {
    case 'day':
      return <h1>Day {route.date}</h1>
    case 'month':
      return <h1>Month {route.month}</h1>
    case 'settings':
      return <h1>Settings</h1>
    case 'about':
      return <h1>About</h1>
    case 'now':
      return <h1>Now</h1>
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
      <main>
        <Placeholder route={route} />
      </main>
    </>
  )
}
