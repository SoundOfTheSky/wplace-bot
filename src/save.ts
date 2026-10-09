/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { WPlaceBot } from './bot'
import { BotImage, ImageStrategy, UnownedColorStrategy } from './image'

const DB_NAME = 'wbot'
const STORE_NAME = 'saves'
const KEY_NAME = 'wbot'
const DB_VERSION = 1
export const SAVE_VERSION = 4

const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => {
    resolve(request.result)
  }
  request.onerror = () => {
    reject(request.error)
  }
})

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await dbPromise
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => {
      resolve(request.result as T | undefined)
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(value, key)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve()
    }
    tx.onerror = () => {
      reject(tx.error)
    }
  })
}

export function DELETE_ALL_DATA() {
  indexedDB.deleteDatabase(DB_NAME)
}

/** Loads a save and returns JSON */
export async function loadSave() {
  try {
    await migrateSaveFromLS()
    const raw = await idbGet<ReturnType<WPlaceBot['toJSON']> | null>(KEY_NAME)
    if (typeof raw !== 'object' || raw === null) return
    return migrate(raw)
  } catch {
    return
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | undefined
/** Make save. Actually makes save only after 1 second */
export async function save(bot: WPlaceBot, immediate = false) {
  clearTimeout(saveTimeout)
  if (immediate) await idbSet(KEY_NAME, await bot.toJSON())
  else
    await new Promise<void>((resolve) => {
      saveTimeout = setTimeout(async () => {
        await idbSet(KEY_NAME, await bot.toJSON())
        resolve()
      }, 1000)
    })
}

/** Migrates save from local storage */
async function migrateSaveFromLS() {
  let legacyKey = ''
  for (let index = 0; index < localStorage.length; index++) {
    legacyKey = localStorage.key(index)!
    if (legacyKey.endsWith(KEY_NAME)) break
  }
  if (legacyKey.endsWith(KEY_NAME)) {
    const json = localStorage.getItem(legacyKey)
    if (json) {
      try {
        const parsed = JSON.parse(json)
        if (typeof parsed === 'object') await idbSet(KEY_NAME, parsed)
      } catch {
        // ignore corrupt legacy data
      }
    }
    localStorage.removeItem(legacyKey)
  }
}

/** How to migrate save data for images */
export function migrateImage(old: any): Awaited<ReturnType<BotImage['toJSON']>> {
  const img = structuredClone(old)
  if (!img.version) {
    return {
      url: img.url || '',
      width: img.width || 0,
      brightness: img.brightness || 1,
      position: img.position || { globalX: 0, globalY: 0 },
      strategy: img.strategy || ImageStrategy.SPIRAL_TO_CENTER,
      opacity: img.opacity || 0.5,
      drawColorsInOrder: img.drawColorsInOrder || true,
      colors: img.colors || [],
      disabledColors: img.disabledColors || [0],
      lock: img.lock || false,
      disabled: img.disabled || false,
      name: img.name || `Unnamed image`,
      unownedColorStrategy: img.unownedColorStrategy || UnownedColorStrategy.BUY,
      version: SAVE_VERSION,
    }
  }

  if (img.version === 2) {
    const { url, width, brightness } = old.pixels
    return migrateImage({
      url,
      width,
      brightness,
      position: img.position || { globalX: 0, globalY: 0 },
      strategy: img.strategy || ImageStrategy.SPIRAL_TO_CENTER,
      opacity: img.opacity || 0.5,
      drawColorsInOrder: img.drawColorsInOrder || true,
      colors: img.colors || [],
      disabledColors: img.disabledColors || [0],
      lock: img.lock || false,
      disabled: img.disabled || false,
      name: img.name || `Unnamed image`,
      unownedColorStrategy: img.unownedColorStrategy || UnownedColorStrategy.BUY,
      version: 3,
    })
  }

  if (img.version === 3) {
    if (!img.drawTransparentPixels && !img.disabledColors.includes(0)) {
      img.disabledColors.push(0)
      delete img.drawTransparentPixels
    }
    img.version = 4
    return migrateImage(img)
  }

  return img
}

/** How to migrate save data */
export function migrate(old: any): Awaited<ReturnType<WPlaceBot['toJSON']>> {
  if (!old.version || old.version < SAVE_VERSION) {
    return {
      version: SAVE_VERSION,
      images: old.images.map(migrateImage),
      strategy: old.strategy,
      title: 'WPlace-bot',
    }
  }
  return old
}
