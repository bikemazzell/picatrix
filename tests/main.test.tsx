import { render } from 'preact'
import { afterEach, expect, test, vi } from 'vitest'

function mountHost(): HTMLElement {
  const host = document.createElement('div')
  host.id = 'app'
  document.body.appendChild(host)
  return host
}

async function boot() {
  vi.resetModules()
  await import('../src/main')
}

afterEach(() => {
  const host = document.getElementById('app')
  if (host) {
    render(null, host)
    host.remove()
  }
  window.localStorage.clear()
  location.hash = ''
  document.documentElement.style.removeProperty('--text-scale')
  document.documentElement.removeAttribute('data-theme')
})

test('boot applies the saved text scale and theme without visiting Settings', async () => {
  window.localStorage.setItem(
    'picatrix.settings',
    JSON.stringify({
      timeZone: null,
      clock: '12h',
      textScale: 1.3,
      features: {
        phase: true,
        sign: true,
        void: true,
        mansion: true,
        mercury: true,
      },
      theme: 'dark',
    }),
  )
  location.hash = '#/now'
  mountHost()
  await boot()
  expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.3')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('boot with empty storage falls back to defaults', async () => {
  location.hash = '#/now'
  mountHost()
  await boot()
  expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1')
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
})
