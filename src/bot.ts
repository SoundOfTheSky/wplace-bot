import { formatNumber, wait } from '@softsky/utils'
import { BotImage } from './image'
import { SAVE_VERSION, SaveSystem } from './save'
// @ts-ignore
import css from './style.css' with { type: 'text' }
import { isColorAvailable } from './utils'
import { BotStrategy, Widget } from './widget'
import { ImageProcessingWorker } from './worker-client'
import {
  extractScreenPositionFromStar,
  FAVORITE_LOCATIONS,
  FAVORITE_LOCATIONS_POSITIONS,
  type Position,
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

/**
 * Main class. Initializes everything.
 * Used to interact with wplace
 * */
export class WPlaceBot {
  public constructor() {
    this.widget
      .run('Initializing', async () => {
        this.registerFetchInterceptor()

        // Embed styles
        const style = document.createElement('style')
        style.textContent = css as string
        document.head.append(style)

        await this.save.load(true)

        // Watching for stars change to move overlays
        new MutationObserver((mutations: MutationRecord[]) => {
          // If elements were removed, update stars
          for (let index = 0; index < mutations.length; index++)
            if (mutations[index]!.removedNodes.length !== 0) {
              this.updateStars()
              break
            }
          for (let index = 0; index < this.images.length; index++) this.images[index]!.updateUI()
        }).observe(document.querySelector('.maplibregl-canvas-container')!, {
          attributes: true,
          childList: true,
          subtree: true,
        })

        await wait(500) // Sometimes wplace UI becomes bugged if interacted too early

        // Unblock buttons
        this.widget.setDisabled('draw', false)
        this.widget.setDisabled('auto-draw', false)
        this.widget.setDisabled('add-image', false)
      })
      .catch(async (error) => {
        if (
          window.confirm(
            "WPlace-bot couldn't load!\nDo you want to DELETE ALL DATA to fix it?\n\nERROR: " +
              error,
          )
        ) {
          try {
            await this.save.deleteAllData()
          } finally {
            document.location.reload()
          }
        }
      })
  }

  /** Title in widget */
  public title = ''

  /** Data about account */
  public me!: Me

  /** Cached stars elements */
  public $stars: HTMLDivElement[] = []

  /** Strategy how to distribute draw calls between images */
  public strategy = BotStrategy.SEQUENTIAL

  /** Images on canvas */
  public images: BotImage[] = []

  /** Autodraw interval */
  public autoDrawInterval?: ReturnType<typeof setInterval>

  public widget = new Widget(this)

  public save = new SaveSystem(this)

  public worker = new ImageProcessingWorker()

  /** Last color drawn */
  protected lastColor?: number

  public isColorAvailable(color: number) {
    return isColorAvailable(this.me.extraColorsBitmap, color)
  }

  public refetchMe() {
    return fetch('https://backend.wplace.live/me', {
      credentials: 'include',
    })
      .then((x) => x.json())
      .then((x) => {
        return (this.me = x as Me)
      })
  }

  /** Start drawing */
  public draw(): Promise<void> {
    this.widget.setDisabled('draw', true)
    this.widget.status = ''
    // Clear maps cache to refetch pixels
    const $canvas = document.querySelector<HTMLDivElement>('.maplibregl-canvas')!
    const prevent = (event: MouseEvent | WheelEvent) => {
      if (!event.shiftKey) event.stopPropagation()
    }
    return this.widget.run(
      'Drawing',
      async () => {
        const firstImage = this.images[0]
        if (!firstImage) return

        // Stop mouse messing with drawing by capturing event
        globalThis.addEventListener('mousemove', prevent, true)
        $canvas.addEventListener('wheel', prevent, true)

        /**
         * Run async:
         * - Zoom
         * - Load
         *   - Fetch me
         *   - Clear cache
         *     - Updating pixels
         */
        await Promise.all([
          Promise.all([this.refetchMe(), this.worker.clearMapCache()]).then(async () => {
            for (let index = 0; index < this.images.length; index++)
              await this.images[index]!.updatePixels()
          }),
          this.zoomIn(4, $canvas),
        ])

        const initialCharges = Math.floor(this.me!.charges.count)
        let charges = initialCharges

        // Calculate tasks and colors to buy
        let tasksLength = 0
        const colorsToBuyMap = new Map<number, { color: number; amount: number }>()
        for (let index = 0; index < this.images.length; index++) {
          const image = this.images[index]!
          if (image.disabled) continue
          tasksLength += image.tasksX.length
          if (image.autoBuyColors) {
            for (let index = 0; index < image.colors.length; index++) {
              const color = image.colors[index]!
              if (image.disabledColors.has(color) || !this.isColorAvailable(color)) continue
              const amount = image.colorsCount[color]
              if (!colorsToBuyMap.has(color))
                colorsToBuyMap.set(color, {
                  color: color,
                  amount,
                })
              else colorsToBuyMap.get(color)!.amount += amount
            }
          }
        }
        const colorToBuy = [...colorsToBuyMap.values()].sort((a, b) => b.amount - a.amount)[0]
          ?.color
        if (this.me!.droplets >= 2000 && colorToBuy !== undefined) {
          document.getElementById('color-' + colorToBuy)?.click()
          await wait(500)
          document
            .querySelector<HTMLButtonElement>('.modal-box .flex.w-max.flex-col button')
            ?.click()
          await wait(1000)
          await this.closeAll()
          await wait(500)
          // Retry after color bought
          return this.draw()
        }
        const indexes = new Map<BotImage, number>()

        const drawTask = async (image: BotImage) => {
          let index = indexes.get(image)
          if (index === undefined) indexes.set(image, (index = 0))
          if (index === image.tasksX.length) return false
          indexes.set(image, index + 1)
          const worldPosition = new WorldPosition(this, image.tasksX[index]!, image.tasksY[index]!)
          const color =
            image.pixels[
              (worldPosition.globalY - image.position.globalY) * image.width +
                (worldPosition.globalX - image.position.globalX)
            ]

          if (this.lastColor !== color) {
            ;(document.getElementById('color-' + color) as HTMLButtonElement).click()
            this.lastColor = color
          }
          const halfPixel = worldPosition.pixelSize / 2
          const position = worldPosition.toScreenPosition()
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
          charges--
          await wait(1)
          return true
        }

        switch (this.strategy) {
          case BotStrategy.ALL: {
            while (charges > 0) {
              let end = true
              for (let imageIndex = 0; imageIndex < this.images.length; imageIndex++) {
                const image = this.images[imageIndex]!
                if (image.disabled) continue
                if (await drawTask(image)) end = false
              }
              if (end) break
            }
            break
          }
          case BotStrategy.PERCENTAGE: {
            for (let taskIndex = 0; taskIndex < tasksLength && charges > 0; taskIndex++) {
              let minPercent = 1
              let minImage: BotImage | undefined
              for (let imageIndex = 0; imageIndex < this.images.length; imageIndex++) {
                const image = this.images[imageIndex]!
                if (image.disabled) continue
                const percent = 1 - image.tasksX.length / (image.width * image.height)
                if (percent < minPercent) {
                  minPercent = percent
                  minImage = image
                }
              }
              if (minImage) await drawTask(minImage)
            }
            break
          }
          case BotStrategy.SEQUENTIAL: {
            for (let imageIndex = 0; imageIndex < this.images.length; imageIndex++) {
              const image = this.images[imageIndex]!
              if (image.disabled) continue
              for (let i = 0; i < image.tasksX.length && charges > 0; i++) await drawTask(image)
            }
          }
        }

        // Trim tasks from already done
        for (const [image, value] of indexes) {
          image.tasksX = image.tasksX.subarray(value)
          image.tasksY = image.tasksY.subarray(value)
        }
        this.me!.charges.count = 0
        this.widget.update()
      },
      () => {
        globalThis.removeEventListener('mousemove', prevent, true)
        $canvas.removeEventListener('wheel', prevent, true)
        this.widget.setDisabled('draw', false)
      },
    )
  }

  public autoDraw() {
    if (this.autoDrawInterval) {
      this.widget.$autoDraw.innerText = 'Auto-Draw'
      clearInterval(this.autoDrawInterval)
      this.autoDrawInterval = undefined
      return false
    }
    this.widget.$autoDraw.innerText = 'Auto-Draw is starting...'
    let errorCount = 0
    let drawTime = 0
    this.autoDrawInterval = setInterval(async () => {
      const deltaTime = drawTime - Date.now()
      if (deltaTime > 0)
        this.widget.$autoDraw.innerText = `Auto-Draw in (${formatNumber(deltaTime, 60000)})!`
      else {
        drawTime = Date.now() + (this.me?.charges.max ?? 100) * 0.9 * 30000
        try {
          await this.draw()
          // Click draw
          document
            .querySelector<HTMLButtonElement>('.paint-actions > *:nth-child(2) button')
            ?.click()
          errorCount = 0
        } catch {
          errorCount++
          if (errorCount === 4) throw new Error('Error')
        }
      }
    }, 1000)
    return true
  }

  /** Serialize bot */
  public async toJSON(exportToBlob?: boolean) {
    return {
      version: SAVE_VERSION,
      images: await Promise.all(this.images.map((x) => x.toJSON(exportToBlob))),
      strategy: this.strategy,
      title: this.title,
    }
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

  /** Find anchor data for screen postition */
  public findAnchorsForScreen(position: Position) {
    let anchorIndex = 0
    let minI2 = 1
    let min1 = Infinity
    let min2 = Infinity
    for (let index = 0; index < this.$stars.length; index++) {
      const { x, y } = extractScreenPositionFromStar(this.$stars[index])
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
    const anchorScreenPosition = extractScreenPositionFromStar(this.$stars[anchorIndex])
    const anchorWorldPosition = FAVORITE_LOCATIONS_POSITIONS[anchorIndex]!
    return {
      anchorScreenPosition,
      anchorWorldPosition,
      pixelSize:
        (extractScreenPositionFromStar(this.$stars[minI2]).x - anchorScreenPosition.x) /
        (FAVORITE_LOCATIONS_POSITIONS[minI2]!.x - anchorWorldPosition.x),
    }
  }

  /** Close drawing on focus to not consume space */
  public fixSpaceInInput(input: HTMLInputElement) {
    input.addEventListener('focus', () => this.closeAll())
  }

  /** Opens colors and makes them visible for selection */
  public async openColors() {
    this.lastColor = undefined
    // Click close marker
    document.querySelector<HTMLButtonElement>('.flex.gap-2.px-3 > .btn-circle')?.click()
    await wait(1)
    // Click "Paint"
    document.querySelector<HTMLButtonElement>('.btn.btn-primary.btn-lg.relative.z-30')?.click()
    await wait(1)
    // Click Unfold colors if folded
    const unfoldColors = document.querySelector<HTMLButtonElement>('button.bottom-0')
    if (
      unfoldColors?.innerHTML ===
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5"><path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z"></path></svg><!---->'
    ) {
      unfoldColors.click()
      await wait(1)
    }
    await this.waitForElement<HTMLButtonElement>('button.btn.relative.w-full')
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
  public waitForElement<T extends Element>(selector: string): Promise<T> {
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
  }

  /** Simply update $stars property */
  public updateStars() {
    this.$stars = [
      ...document.querySelectorAll<HTMLDivElement>(
        ".maplibregl-marker[aria-label='WBOT_FAVORITE']",
      ),
    ].slice(0, FAVORITE_LOCATIONS.length)
  }

  /** Zoom in canvas */
  protected async zoomIn(
    zoom: number,
    canvas = document.querySelector<HTMLDivElement>('.maplibregl-canvas')!,
  ) {
    const position = this.images[0]!.position
    if (position.pixelSize >= zoom) return
    const event = new WheelEvent('wheel', {
      deltaY: -10,
      clientX: canvas.clientWidth / 2,
      clientY: canvas.clientHeight / 2,
      bubbles: true,
      shiftKey: true,
    })
    return new Promise<void>((resolve) => {
      function scroll() {
        if (position.pixelSize >= zoom) resolve()
        else requestAnimationFrame(scroll)
        canvas.dispatchEvent(event)
      }
      scroll()
    })
  }

  /** Start listening to fetch requests */
  protected registerFetchInterceptor() {
    const originalFetch = globalThis.fetch
    // @ts-ignore
    globalThis.fetch = async (request, options) => {
      const response = await originalFetch(request, options)
      const cloned = response.clone()
      if (response.url === 'https://backend.wplace.live/me') {
        this.me = (await cloned.json()) as Me
        this.me.favoriteLocations.unshift(...FAVORITE_LOCATIONS)
        this.me.maxFavoriteLocations = Infinity
        response.json = () => Promise.resolve(this.me)
      }
      return response
    }
  }
}

// @ts-ignore
globalThis.wbot = new WPlaceBot()
