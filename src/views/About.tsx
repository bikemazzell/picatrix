import { version } from '../../package.json'

const ELEMENTS = [
  { id: 'fire', label: 'Fire' },
  { id: 'earth', label: 'Earth' },
  { id: 'air', label: 'Air' },
  { id: 'water', label: 'Water' },
  { id: 'void', label: 'Void' },
] as const

export function About() {
  return (
    <div class="about-view">
      <h1>About</h1>
      <section class="panel">
        <h2>Picatrix Lunar Almanac</h2>
        <p>Version {version}</p>
        <p>Released under the MIT License.</p>
        <p>The ephemeris covers 1900-01-01 through 2100-12-31.</p>
        <p>Only the time zone setting matters: the almanac never uses your location.</p>
      </section>
      <section class="panel">
        <h2>Element colors</h2>
        <ul class="element-key">
          {ELEMENTS.map(({ id, label }) => (
            <li key={id}>
              <span class="key-swatch" style={{ background: `var(--${id})` }} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </section>
      <section class="panel">
        <h2>Credits</h2>
        <p>
          Made by <a href="https://github.com/bikemazzell">@bikemazzell</a>. Source code on{' '}
          <a href="https://github.com/bikemazzell/picatrix">GitHub</a>.
        </p>
        <p>
          Texts are paraphrases adapted from Picatrix (Ghāyat al-Ḥakīm), translated by Dan Attrell
          and David Porreca (Penn State Press, 2019).
        </p>
      </section>
    </div>
  )
}
