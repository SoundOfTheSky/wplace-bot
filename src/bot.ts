import { wait } from '@softsky/utils'

import { BotImage, DrawTask } from './image'
import { Pixels } from './pixels'
import { loadSave } from './save'
// @ts-ignore
import css from './style.css' with { type: 'text' }
import { BotStrategy, Widget } from './widget'
import {
  addFavoriteLocation,
  extractScreenPositionFromStar,
  FAVORITE_LOCATIONS,
  FAVORITE_LOCATIONS_POSITIONS,
  Position,
  WorldPosition,
} from './world-position'

export type Me = {
  allianceId: number
  allianceRole: string
  banned: false
  charges: { cooldownMs: number; count: number; max: number }
  country: string
  discord: string
  discordId: string
  droplets: number
  equippedFlag: number
  experiments: unknown
  extraColorsBitmap: number
  favoriteLocations: {
    id: number
    name: string
    latitude: number
    longitude: number
  }[]
  flagsBitmap: string
  id: number
  isCustomer: boolean
  level: number
  maxFavoriteLocations: number
  name: string
  needsPhoneVerification: boolean
  picture: string
  pixelsPainted: number
  showLastPixel: boolean
  suspensionReason: string
  timeoutUntil: string
}

const SAVE_VERSION = 2

/**
 * Main class. Initializes everything.
 * Used to interact with wplace
 * */
export class WPlaceBot {
  /** Colors that can be bought */
  public unavailableColors = new Set<number>()

  /** Cache of parsed images of world map */
  public mapsCache = new Map<string, Pixels>()

  /** Data about account */
  public me?: Me

  /** Cached stars elements */
  public $stars: HTMLDivElement[] = []

  /** Strategy how to distribute draw calls between images */
  public strategy = BotStrategy.SEQUENTIAL

  /** Images on canvas */
  public images: BotImage[] = []

  public widget = new Widget(this)

  /** Used to wait for pixel data on marker set */
  protected markerPixelPositionResolvers: ((
    position: WorldPosition,
  ) => unknown)[] = []

  /** Last color drawn */
  protected lastColor?: number

  public constructor() {
    // Try to load save
    const save = loadSave()

    // Preinit save data before page has loaded
    if (save) {
      for (let index = 0; index < save.images.length; index++) {
        const image = save.images[index]!
        addFavoriteLocation({
          x: image.position[0] - 1000,
          y: image.position[1] - 1000,
        })
        addFavoriteLocation({
          x: image.position[0] + 1000,
          y: image.position[1] + 1000,
        })
      }
      this.strategy = save.strategy
    }

    this.registerFetchInterceptor()

    // Embed styles
    const style = document.createElement('style')
    style.textContent = (css as string).replace(
      'FAKE_FAVORITE_LOCATIONS',
      FAVORITE_LOCATIONS.length.toString(),
    )
    document.head.append(style)

    void this.widget.run('Initializing', async () => {
      // Waiting for all of website to load
      await this.waitForElement('login', '.avatar.center-absolute.absolute')
      await this.waitForElement(
        'pixel count',
        '.btn.btn-primary.btn-lg.relative.z-30 canvas',
      )
      const $canvasContainer = await this.waitForElement(
        'canvas',
        '.maplibregl-canvas-container',
      )
      new MutationObserver((mutations: MutationRecord[]) => {
        // If elements were removed, update stars
        for (let index = 0; index < mutations.length; index++)
          if (mutations[index]!.removedNodes.length !== 0) {
            this.updateStars()
            break
          }
        this.updateImages()
      }).observe($canvasContainer, {
        attributes: true,
        childList: true,
        subtree: true,
      })
      this.updateStars()
      await wait(500) // Sometimes wplace UI becomes bugged if interacted too early
      await this.updateColors()

      // Load images
      if (save)
        for (let index = 0; index < save.images.length; index++) {
          const image = await BotImage.fromJSON(this, save.images[index]!)
          this.images.push(image)
          image.update()
        }
      await this.readMap()
      this.updateTasks()
      // Unblock buttons
      this.widget.setDisabled('draw', false)
      this.widget.setDisabled('add-image', false)
      // this.widget.setDisabled('pumpkin-hunt', false)
    })
  }

  /** Start drawing */
  public draw() {
    this.widget.setDisabled('draw', true)
    this.widget.status = ''
    // Clear maps cache to refetch pixels
    this.mapsCache.clear()
    const $canvas =
      document.querySelector<HTMLDivElement>('.maplibregl-canvas')!
    const prevent = (event: MouseEvent | WheelEvent) => {
      if (!event.shiftKey) event.stopPropagation()
    }
    return this.widget.run(
      'Drawing',
      async () => {
        await this.widget.run('Initializing draw', () =>
          Promise.all([this.updateColors(), this.readMap()]),
        )
        // Stop mouse messing with drawing by capturing event
        globalThis.addEventListener('mousemove', prevent, true)
        $canvas.addEventListener('wheel', prevent, true)
        this.updateTasks()
        let n = 0
        for (let index = 0; index < this.images.length; index++)
          n += this.images[index]!.tasks.length
        switch (this.strategy) {
          case BotStrategy.ALL: {
            while (!document.querySelector('ol')) {
              let end = true
              for (
                let imageIndex = 0;
                imageIndex < this.images.length;
                imageIndex++
              ) {
                const task = this.images[imageIndex]!.tasks.shift()
                if (!task) continue
                this.drawTask(task)
                await wait(1)
                end = false
              }
              if (end) break
            }
            break
          }
          case BotStrategy.PERCENTAGE: {
            for (
              let taskIndex = 0;
              taskIndex < n && !document.querySelector('ol');
              taskIndex++
            ) {
              let minPercent = 1
              let minImage!: BotImage
              for (
                let imageIndex = 0;
                imageIndex < this.images.length;
                imageIndex++
              ) {
                const image = this.images[imageIndex]!
                const percent =
                  1 -
                  image.tasks.length /
                    (image.pixels.pixels.length *
                      image.pixels.pixels[0]!.length)
                if (percent < minPercent) {
                  minPercent = percent
                  minImage = image
                }
              }
              this.drawTask(minImage.tasks.shift()!)
              await wait(1)
            }
            break
          }
          case BotStrategy.SEQUENTIAL: {
            for (
              let imageIndex = 0;
              imageIndex < this.images.length;
              imageIndex++
            ) {
              const image = this.images[imageIndex]!
              for (
                let task = image.tasks.shift();
                task && !document.querySelector('ol');
                task = image.tasks.shift()
              ) {
                this.drawTask(task)
                await wait(1)
              }
            }
          }
        }
        this.widget.update()
      },
      () => {
        globalThis.removeEventListener('mousemove', prevent, true)
        $canvas.removeEventListener('wheel', prevent, true)
        this.widget.setDisabled('draw', false)
      },
    )
  }

  /** Serialize bot */
  public toJSON() {
    return {
      version: SAVE_VERSION,
      images: this.images.map((x) => x.toJSON()),
      strategy: this.strategy,
    }
  }

  /** Read colors */
  public async updateColors() {
    await this.openColors()
    this.unavailableColors.clear()
    for (const $button of document.querySelectorAll<HTMLButtonElement>(
      'button.btn.relative.w-full',
    ))
      if ($button.children.length !== 0)
        this.unavailableColors.add(
          Math.abs(Number.parseInt($button.id.slice(6))),
        )
    this.updateImageColors()
  }

  /** Move map */
  public moveMap(delta: Position) {
    const canvas = document.querySelector('.maplibregl-canvas')!
    const startX = window.innerWidth / 2
    const startY = window.innerHeight / 2
    const endX = startX - delta.x
    const endY = startY - delta.y
    function fire(type: string, x: number, y: number) {
      canvas.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          buttons: 1,
        }),
      )
    }
    fire('mousedown', startX, startY)
    fire('mousemove', endX, endY)
    fire('mouseup', endX, endY)
  }

  /** Read and cache the map */
  public readMap() {
    this.mapsCache.clear()
    const imagesToDownload = new Set<string>()
    for (let index = 0; index < this.images.length; index++) {
      const image = this.images[index]!
      const { tileX: tileXEnd, tileY: tileYEnd } = new WorldPosition(
        this,
        image.position.globalX + image.pixels.pixels[0]!.length,
        image.position.globalY + image.pixels.pixels.length,
      )
      for (let tileX = image.position.tileX; tileX <= tileXEnd; tileX++)
        for (let tileY = image.position.tileY; tileY <= tileYEnd; tileY++)
          imagesToDownload.add(`${tileX}/${tileY}`)
    }
    let done = 0
    return this.widget.run(`Reading map [0/${imagesToDownload.size}]`, () =>
      Promise.all(
        [...imagesToDownload].map(async (x) => {
          this.mapsCache.set(
            x,
            await Pixels.fromJSON(this, {
              url: `https://backend.wplace.live/files/s0/tiles/${x}.png`,
              exactColor: true,
            }),
          )
          this.widget.status = `⌛ Reading map [${++done}/${imagesToDownload.size}]`
        }),
      ),
    )
  }

  /** Wait until window is unfocused */
  public waitForUnfocus() {
    return this.widget.run(
      'UNFOCUS WINDOW',
      () =>
        new Promise<void>((resolve) => {
          if (!document.hasFocus()) resolve()
          window.addEventListener(
            'blur',
            () => {
              setTimeout(resolve, 1)
            },
            {
              once: true,
            },
          )
        }),
      undefined,
      '🖱️',
    )
  }

  /** Find anchor data for screen postition */
  public findAnchorsForScreen(position: Position) {
    let anchorIndex = 0
    let minI2 = 1
    let min1 = Infinity
    let min2 = Infinity
    for (let index = 0; index < this.$stars.length; index++) {
      const { x, y } = extractScreenPositionFromStar(this.$stars[index]!)
      if (x < position.x && y < position.y) {
        const delta = position.x - x + (position.y - y)
        if (delta < min1) {
          min1 = delta
          anchorIndex = index
        }
      } else if (x > position.x && y > position.y) {
        const delta = x - position.x + (y - position.y)
        if (delta < min2) {
          min2 = delta
          minI2 = index
        }
      }
    }
    const anchorScreenPosition = extractScreenPositionFromStar(
      this.$stars[anchorIndex]!,
    )
    const anchorWorldPosition = FAVORITE_LOCATIONS_POSITIONS[anchorIndex]!
    return {
      anchorScreenPosition,
      anchorWorldPosition,
      pixelSize:
        (extractScreenPositionFromStar(this.$stars[minI2]!).x -
          anchorScreenPosition.x) /
        (FAVORITE_LOCATIONS_POSITIONS[minI2]!.x - anchorWorldPosition.x),
    }
  }

  /** Opens colors and makes them visible for selection */
  protected async openColors() {
    this.lastColor = undefined
    // Click close marker
    document
      .querySelector<HTMLButtonElement>('.flex.gap-2.px-3 > .btn-circle')
      ?.click()
    await wait(1)
    // Click "Paint"
    document
      .querySelector<HTMLButtonElement>('.btn.btn-primary.btn-lg.relative.z-30')
      ?.click()
    await wait(1)
    // Click Unfold colors if folded
    const unfoldColors =
      document.querySelector<HTMLButtonElement>('button.bottom-0')
    if (
      unfoldColors?.innerHTML ===
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5"><path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z"></path></svg><!---->'
    ) {
      unfoldColors.click()
      await wait(1)
    }
  }

  /** Draw one task */
  protected drawTask(task: DrawTask) {
    if (this.lastColor !== task.color) {
      ;(
        document.getElementById('color-' + task.color) as HTMLButtonElement
      ).click()
      this.lastColor = task.color
    }
    const halfPixel = task.position.pixelSize / 2
    const position = task.position.toScreenPosition()
    document.documentElement.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: position.x + halfPixel,
        clientY: position.y + halfPixel,
        shiftKey: true,
      }),
    )
    document.documentElement.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        which: 32,
        bubbles: true,
        cancelable: true,
      }),
    )
    document.documentElement.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        which: 32,
        bubbles: true,
        cancelable: true,
      }),
    )
  }

  /** Start listening to fetch requests */
  protected registerFetchInterceptor() {
    const originalFetch = globalThis.fetch
    const pixelRegExp =
      /https:\/\/backend.wplace.live\/s\d+\/pixel\/(-?\d+)\/(-?\d+)\?x=(-?\d+)&y=(-?\d+)/
    // @ts-ignore
    globalThis.fetch = async (request, options) => {
      const response = await originalFetch(request, options)
      const cloned = response.clone()
      let url = ''
      if (typeof request == 'string') url = request
      else if (request instanceof Request) url = request.url
      else if (request instanceof URL) url = request.href
      if (response.url === 'https://backend.wplace.live/me') {
        this.me = (await cloned.json()) as Me
        this.me.favoriteLocations.unshift(...FAVORITE_LOCATIONS)
        this.me.maxFavoriteLocations = Infinity
        response.json = () => Promise.resolve(this.me)
      }
      const pixelMatch = pixelRegExp.exec(url)
      if (pixelMatch) {
        for (
          let index = 0;
          index < this.markerPixelPositionResolvers.length;
          index++
        )
          this.markerPixelPositionResolvers[index]!(
            new WorldPosition(
              this,
              +pixelMatch[1]!,
              +pixelMatch[2]!,
              +pixelMatch[3]!,
              +pixelMatch[4]!,
            ),
          )
        this.markerPixelPositionResolvers.length = 0
      }
      return response
    }
  }

  /** Closes all popups */
  public async closeAll() {
    for (const button of document.querySelectorAll('button')) {
      if (
        button.innerHTML === '✕' ||
        button.innerHTML ===
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"></path></svg><!---->`
      ) {
        button.click()
        await wait(1)
      }
    }
  }

  /** Wait for element to show up in document */
  protected waitForElement<T extends Element>(
    name: string,
    selector: string,
  ): Promise<T> {
    return this.widget.run(`Waiting for ${name}`, () => {
      return new Promise<T>((resolve) => {
        // If element already exists, resolve immediately
        const existing = document.querySelector<T>(selector)
        if (existing) {
          resolve(existing)
          return
        }
        // Watch for new elements
        const observer = new MutationObserver(() => {
          const element = document.querySelector<T>(selector)
          if (element) {
            observer.disconnect()
            resolve(element)
          }
        })
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        })
      })
    })
  }

  /** Simply update $stars property */
  protected updateStars() {
    this.$stars = [
      ...document.querySelectorAll<HTMLDivElement>(
        '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center',
      ),
    ].slice(0, FAVORITE_LOCATIONS.length)
  }

  /** Update images position and contents */
  protected updateImages() {
    for (let index = 0; index < this.images.length; index++)
      this.images[index]!.update()
  }

  /** Update tasks of all images */
  protected updateTasks() {
    for (let index = 0; index < this.images.length; index++)
      this.images[index]!.updateTasks()
  }

  /** Update colors of all images */
  protected updateImageColors() {
    for (let index = 0; index < this.images.length; index++)
      this.images[index]!.updateColors()
  }
}

// @ts-ignore
globalThis.wbot = new WPlaceBot()
