/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { WPlaceBot } from './bot'

export function loadSave() {
  const json = localStorage.getItem('wbot')!
  let save: ReturnType<WPlaceBot['toJSON']> | undefined
  try {
    save = JSON.parse(json)
    if (typeof save !== 'object') throw new Error('NOT VALID SAVE')
    if (save.version === 1) {
      const _save = save as any
      save.images = _save.widget.images
      save.strategy = _save.widget.strategy
      delete _save.widget
    }
  } catch {
    localStorage.removeItem('wbot')
    save = undefined
  }
  return save
}

let saveTimeout: ReturnType<typeof setTimeout> | undefined
export function save(bot: WPlaceBot, immediate = false) {
  clearTimeout(saveTimeout)
  if (immediate) localStorage.setItem('wbot', JSON.stringify(bot))
  else
    saveTimeout = setTimeout(() => {
      localStorage.setItem('wbot', JSON.stringify(bot))
    }, 1000)
}
