/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { WPlaceBot } from './bot'
import { SID } from './obfuscator'

export function loadSave() {
  let key = ''
  for (let index = 0; index < localStorage.length; index++) {
    key = localStorage.key(index)!
    if (key.endsWith('wbot')) break
  }
  if (!key.endsWith('wbot')) key = SID + 'wbot'
  const json = localStorage.getItem(key)!
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
    localStorage.removeItem(key)
    localStorage.setItem(SID + 'wbot', JSON.stringify(save))
  } catch {
    save = undefined
  }
  return save
}

let saveTimeout: ReturnType<typeof setTimeout> | undefined
export function save(bot: WPlaceBot, immediate = false) {
  clearTimeout(saveTimeout)
  if (immediate) localStorage.setItem(SID + 'wbot', JSON.stringify(bot))
  else
    saveTimeout = setTimeout(() => {
      localStorage.setItem(SID + 'wbot', JSON.stringify(bot))
    }, 1000)
}
