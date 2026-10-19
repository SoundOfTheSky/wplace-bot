import { wait } from '@softsky/utils'
import type { WPlaceBot } from './bot'
import { IDB } from './idb'
import { BotImage, type Template } from './image'
import { BotStrategy } from './widget'
import { addFavoriteLocation, latToPos, lngToPos } from './world-position'

export const SAVE_VERSION = 5
const WPLACE_IDB_VERSION = 4
const WPLACE_TEMPLATE_LS_KEY = 'template-overlays'
const LS_KEY = 'tamplate-overlays' // Weird name for a bit of obfuscation
const IDB_KEY = 'wplace-templates'

export class SaveSystem {
  public idb = IDB.open<{ images: Blob }>(IDB_KEY, WPLACE_IDB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(IDB_KEY)) db.createObjectStore(IDB_KEY)
  })
  public localStorageSetItem = localStorage.setItem.bind(localStorage)
  protected saveTimeout: ReturnType<typeof setTimeout> | undefined

  public constructor(protected bot: WPlaceBot) {
    localStorage.setItem = (key, value) => {
      if (key === WPLACE_TEMPLATE_LS_KEY) void this.load()
      return this.localStorageSetItem(key, value)
    }
  }

  public async deleteAllData() {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(WPLACE_TEMPLATE_LS_KEY)
    await IDB.delete(IDB_KEY)
  }

  /** Make save. Actually makes save only after 1 second */
  public async save(immediate?: boolean) {
    clearTimeout(this.saveTimeout)
    const saveImmediate = async () => {
      const idb = await this.idb
      const data = await this.bot.toJSON(true)
      await Promise.all(data.images.map((x) => idb.put('images', x.url as Blob, x.template.id)))
      this.localStorageSetItem(
        WPLACE_TEMPLATE_LS_KEY,
        JSON.stringify(data.images.map((x) => x.template)),
      )
      this.localStorageSetItem(
        LS_KEY,
        JSON.stringify(
          data.images.map((x) => {
            const copy = structuredClone(x) as Partial<(typeof data.images)[0]>
            delete copy.url
            delete copy.template
            return copy
          }),
        ),
      )
    }

    // Debounce
    if (immediate) await saveImmediate()
    else
      await new Promise<void>((resolve, reject) => {
        this.saveTimeout = setTimeout(async () => {
          try {
            await saveImmediate()
            resolve()
          } catch (error) {
            reject(error)
          }
        }, 1000)
      })
  }

  public async load(isInitial?: boolean) {
    let templates: Template[]
    try {
      templates = JSON.parse(localStorage.getItem(WPLACE_TEMPLATE_LS_KEY) ?? '[]')
    } catch {
      templates = []
    }
    let save: Awaited<ReturnType<WPlaceBot['toJSON']>>
    try {
      save = JSON.parse(localStorage.getItem(LS_KEY) ?? '{')
    } catch {
      save = {
        images: [],
        strategy: BotStrategy.SEQUENTIAL,
        title: 'WPlaceBot',
        version: SAVE_VERSION,
      }
    }

    // We need to add these before wplace loads for injector to work
    if (isInitial) {
      for (let index = 0; index < save.images.length; index++) {
        const image = save.images[index]
        addFavoriteLocation({
          x: lngToPos(image.template.bounds.west) - 1000,
          y: latToPos(image.template.bounds.north) - 1000,
        })
        addFavoriteLocation({
          x: lngToPos(image.template.bounds.east) + 1000,
          y: latToPos(image.template.bounds.south) + 1000,
        })
      }
    }

    this.bot.title = save.title
    this.bot.strategy = save.strategy

    const imagesSave = new Map<string, (typeof save.images)[0]>()
    for (let index = 0; index < this.bot.images.length; index++) this.bot.images[index].destroy()
    for (let index = 0; index < save.images.length; index++)
      imagesSave.set(save.images[index].id, save.images[index])

    const idb = await this.idb
    await this.bot.waitForElement('.avatar.center-absolute.absolute')
    await this.bot.waitForElement('.btn.btn-primary.btn-lg.relative.z-30')
    await this.bot.waitForElement('.maplibregl-canvas-container')
    await wait(500)
    this.bot.updateStars()
    for (let index = 0; index < templates.length; index++) {
      const template = templates[index]
      const blob = (await idb.get('images', template.id)) as Blob
      await BotImage.fromJSON(this.bot, {
        ...imagesSave.get(template.id),
        url: blob,
        template,
        version: SAVE_VERSION,
      })
    }

    this.bot.widget.update()
  }
}
