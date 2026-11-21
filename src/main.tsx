import { render } from 'preact'
import { App } from './app'
import { applyPresentation, loadSettings } from './settings'
import './styles.css'

applyPresentation(loadSettings())
render(<App />, document.getElementById('app') as HTMLElement)
