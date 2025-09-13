import { WPlaceBot } from './bot'
// @ts-ignore
import css from './style.css' with { type: 'text' }

const style = document.createElement('style')
style.textContent = css as string
document.head.append(style)

// @ts-ignore
globalThis.wbot = new WPlaceBot()
