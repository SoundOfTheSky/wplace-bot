import { NoImageError, NoMarkerError } from './errors'
import { Overlay } from './overlay'
import { Pixels } from './pixels'
import { WorldPosition } from './position'
import {
  DrawTask,
  PixelMetaData,
  Position,
  Save,
  Color,
  Strategy,
} from './types'
import { SPACE_EVENT, strategyPositionIterator, wait } from './utilities'
import { Widget } from './widget'

/**
 * Main class. Initializes everything.
 * Used to interact with wplace
 * */
export class WPlaceBot {
  /** Pixels left to draw */
  public tasks: DrawTask[] = []

  /** WPlace colors. Update with updateColors() */
  public colors: Color[] = []

  /** Image pixels */
  public image?: Pixels

  /** Position of image to draw */
  public startPosition?: WorldPosition

  /** Screen position of starting pixel */
  public startScreenPosition?: Position

  /** Estimated pixel size */
  public pixelSize = 64

  /** How to draw */
  public strategy: Strategy = Strategy.RANDOM

  /** Used to wait for pixel data on marker set */
  protected markerPixelPositionResolvers: ((
    position: WorldPosition,
  ) => unknown)[] = []

  /** Used to wait for pixel data on marker set */
  protected markerPixelDataResolvers: ((position: PixelMetaData) => unknown)[] =
    []

  public widget = new Widget(this)

  public overlay = new Overlay(this)

  public constructor() {
    this.registerFetchInterceptor()
    void this.init()
  }

  /** Handles selectImage button press */
  public async selectImage() {
    this.widget.status = ''
    return this.widget.runWithStatusAsync(
      'Selecting image',
      async () => {
        this.widget.setDisabled('select-image', true)
        await this.updateColors()
        this.image = await Pixels.fromSelectImage(
          this,
          this.colors,
          this.widget.element.querySelector<HTMLInputElement>('.scale')!
            .valueAsNumber,
        )
        await this.updatePositionsWithMarker()
        await this.updateTasks()
        await this.updateColors() // To try to save position
        this.overlay.update()
        this.widget.updateText()
        this.widget.setDisabled('draw', false)
        this.save()
      },
      () => {
        this.widget.setDisabled('select-image', false)
      },
    )
  }

  /** Handles selectImage button press */
  public async countUsers() {
    this.widget.status = ''
    const users = new Set<number>()
    return this.widget.runWithStatusAsync(
      'Counting users',
      async () => {
        this.widget.setDisabled('count-users', true)
        this.widget.setDisabled('draw', true)
        this.widget.setDisabled('select-image', true)
        await this.updatePositionsWithMarker()
        const pos2 = await this.widget.runWithStatusAsync(
          'Place bottom-right corner',
          async () =>
            new Promise<WorldPosition>((resolve) =>
              this.markerPixelPositionResolvers.push(resolve),
            ),
          undefined,
          '🖱️',
        )
        const position = this.startPosition!.clone()
        const pixels =
          (pos2.globalY - this.startPosition!.globalY) *
          (pos2.globalX - this.startPosition!.globalX)
        let counted = 0
        for (; position.globalY < pos2.globalY; position.y++) {
          for (; position.globalX < pos2.globalX; position.x++) {
            const dataPromise = new Promise<PixelMetaData>((resolve) => {
              this.markerPixelDataResolvers.push(resolve)
            })
            await this.clickMapAtPosition(
              position.toScreenPosition(
                this.startScreenPosition!,
                this.startPosition!,
                this.pixelSize,
              ),
            )
            const data = await dataPromise
            if (data.paintedBy.id !== 0) users.add(data.paintedBy.id)
            counted++

            this.widget.status = `⌛ Found ${users.size} users. ETA: ${((600 * (pixels - counted)) / 60_000) | 0}m (${((counted / pixels) * 100) | 0}%)`
            await wait(500)
          }
          position.globalX = this.startPosition!.globalX
        }
      },
      () => {
        this.widget.status = `✅ Found ${users.size} users`
        this.widget.setDisabled('count-users', false)
        this.widget.setDisabled('draw', false)
        this.widget.setDisabled('select-image', false)
      },
    )
  }

  /** Start drawing */
  public draw() {
    this.widget.status = ''
    const prevent = (event: MouseEvent) => {
      if (!event.shiftKey) event.stopPropagation()
    }
    globalThis.addEventListener('mousemove', prevent, true)
    return this.widget.runWithStatusAsync(
      'Drawing',
      async () => {
        this.widget.setDisabled('draw', true)
        await this.updateColors()
        await this.updateTasks()
        while (this.tasks.length > 0 && !document.querySelector('ol')) {
          const task = this.tasks.shift()!
          ;(document.getElementById(task.buttonId) as HTMLButtonElement).click()
          document.documentElement.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              clientX: task.x,
              clientY: task.y,
              shiftKey: true,
            }),
          )
          document.documentElement.dispatchEvent(
            new KeyboardEvent('keydown', SPACE_EVENT),
          )
          document.documentElement.dispatchEvent(
            new KeyboardEvent('keyup', SPACE_EVENT),
          )
          await wait(1)
        }
        this.widget.updateText()
        this.save()
      },
      () => {
        globalThis.removeEventListener('mousemove', prevent, true)
        this.widget.setDisabled('draw', false)
      },
    )
  }

  /** Save data to localStorage */
  public save() {
    if (!this.image || !this.startPosition || !this.startScreenPosition) {
      localStorage.removeItem('wbot')
      return
    }
    localStorage.setItem(
      'wbot',
      JSON.stringify({
        image: this.image,
        startScreenPosition: this.startScreenPosition,
        startPosition: this.startPosition,
        pixelSize: this.pixelSize,
        widgetX: this.widget.x,
        widgetY: this.widget.y,
        overlayOpacity: this.overlay.opacity,
        scale: this.image.scale,
        strategy: this.strategy,
        location: localStorage.getItem('location'),
      }),
    )
  }

  /** Load data and init listeners*/
  public async init() {
    const json = localStorage.getItem('wbot')!
    let save: Save | undefined
    try {
      save = JSON.parse(json) as Save
    } catch {
      localStorage.removeItem('wbot')
    }
    // Restore map location. Because sometimes it just breaks
    if (save?.location?.[0] === '{')
      localStorage.setItem('location', save.location)
    // Wait for website to load
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (
          document.querySelector<HTMLCanvasElement>('.maplibregl-canvas') &&
          document.querySelector(
            '.btn.btn-primary.btn-lg.relative.z-30 canvas',
          ) &&
          document.querySelector('.avatar.center-absolute.absolute')
        ) {
          resolve()
          clearInterval(interval)
        }
      }, 500)
    })
    let moving = false
    const canvas =
      document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!
    canvas.addEventListener('wheel', () => {
      if (this.image) this.onMove()
    })
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) moving = true
    })
    canvas.addEventListener('mouseup', (event) => {
      if (event.button === 0) moving = false
    })
    canvas.addEventListener('mousemove', () => {
      if (moving) this.onMove()
    })
    this.widget.element.classList.remove('hidden')
    if (!save) return
    try {
      this.startPosition = new WorldPosition(...save.startPosition)
      this.startScreenPosition = save.startScreenPosition
      this.pixelSize = save.pixelSize
      this.strategy = save.strategy
      await this.updateColors()
      this.image = await Pixels.fromURL(save.image, this.colors, save.scale)
      this.widget.element.querySelector<HTMLInputElement>(
        '.scale',
      )!.valueAsNumber = save.scale
      this.overlay.opacity = save.overlayOpacity
      this.widget.element.querySelector<HTMLInputElement>(
        '.opacity',
      )!.valueAsNumber = save.overlayOpacity
      await this.updateTasks()
      this.widget.updateText()
      this.widget.updateColorsToBuy()
      this.overlay.update()
      this.widget.setDisabled('draw', false)
    } catch {
      localStorage.removeItem('wbot')
    }
  }

  /** Opens colors and makes them visible for selection */
  public async openColors() {
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

  /** Estimates map position, pixels and aligns overlay */
  protected updatePositionsWithMarker() {
    return this.widget.runWithStatusAsync('Aligning', async () => {
      // Close colors for easy marker placement
      document
        .querySelector<HTMLButtonElement>(
          '.flex.items-center .btn.btn-circle.btn-sm:nth-child(3)',
        )
        ?.click()
      // Wait for user to place marker
      this.startPosition = await this.widget.runWithStatusAsync(
        'Place marker',
        async () =>
          new Promise<WorldPosition>((resolve) =>
            this.markerPixelPositionResolvers.push(resolve),
          ),
        undefined,
        '🖱️',
      )
      this.startScreenPosition = this.getMarkerScreenPosition()

      // Point 2
      const markerPosition2Promise = new Promise<WorldPosition>((resolve) => {
        this.markerPixelPositionResolvers.push(resolve)
      })
      await this.clickMapAtPosition({
        x: window.innerWidth - 1,
        y: window.innerHeight - 1,
      })
      const markerPosition2 = await markerPosition2Promise
      const markerScreenPosition2 = this.getMarkerScreenPosition()
      // Point 1 again
      this.pixelSize =
        (markerScreenPosition2.x - this.startScreenPosition.x) /
        (markerPosition2.globalX - this.startPosition.globalX)
      this.startScreenPosition.x -= this.pixelSize / 2
    })
  }

  /** Calculates everything we need to do. Very expensive task! */
  protected updateTasks() {
    return this.widget.runWithStatusAsync('Map reading', async () => {
      if (!this.startPosition || !this.startScreenPosition)
        throw new NoMarkerError(this)
      if (!this.image) throw new NoImageError(this)
      this.tasks = []
      const maps = new Map<string, Pixels>()
      for (const { x, y } of strategyPositionIterator(
        this.image.pixels.length,
        this.image.pixels[0]!.length,
        this.strategy,
      )) {
        const color = this.image.pixels[y]![x]!
        const position = this.startPosition.clone()
        position.x += x
        position.y += y
        let map = maps.get(position.tileX + '/' + position.tileY)
        if (!map) {
          map = await Pixels.fromURL(
            `https://backend.wplace.live/files/s0/tiles/${position.tileX}/${position.tileY}.png`,
            this.colors,
          )
          maps.set(position.tileX + '/' + position.tileY, map)
        }
        const colorOnMap = map.pixels[position.y]![position.x]!
        if (color.buttonId !== colorOnMap.buttonId)
          this.tasks.push({
            ...position.toScreenPosition(
              this.startScreenPosition,
              this.startPosition,
              this.pixelSize,
            ),
            buttonId: color.buttonId,
          })
      }
    })
  }

  /** Click map at the screen position */
  protected async clickMapAtPosition(screenPosition: Position) {
    await this.waitForUnfocus()
    document
      .querySelector<HTMLCanvasElement>('.maplibregl-canvas')!
      .dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: screenPosition.x,
          clientY: screenPosition.y,
          button: 0,
        }),
      )
    await wait(1)
  }

  /** Read colors */
  protected updateColors() {
    return this.widget.runWithStatusAsync('Colors update', async () => {
      await this.openColors()
      this.colors = (
        [
          ...document.querySelectorAll('button.btn.relative.w-full'),
        ] as HTMLButtonElement[]
      ).map((button, index, array) => {
        if (index === array.length - 1)
          return {
            r: 255,
            g: 255,
            b: 255,
            a: 0,
            available: true,
            buttonId: button.id,
          } satisfies Color
        const rgb = button.style.background
          .slice(4, -1)
          .split(', ')
          .map((x) => +x)
        return {
          r: rgb[0]!,
          g: rgb[1]!,
          b: rgb[2]!,
          a: 255,
          available: button.children.length === 0,
          buttonId: button.id,
        } satisfies Color
      })
    })
  }

  /** Wait until window is unfocused */
  protected waitForUnfocus() {
    return this.widget.runWithStatusAsync(
      'Unfocus window!',
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

  /** Start listening to fetch requests */
  protected registerFetchInterceptor() {
    const originalFetch = globalThis.fetch
    const pixelRegExp =
      /https:\/\/backend.wplace.live\/s\d+\/pixel\/(\d+)\/(\d+)\?x=(\d+)&y=(\d+)/
    globalThis.fetch = async (...arguments_) => {
      const response = await originalFetch(...arguments_)
      const url =
        typeof arguments_[0] === 'string'
          ? arguments_[0]
          : (arguments_[0] as Request).url
      const responseClone = response.clone()
      setTimeout(async () => {
        const pixelMatch = pixelRegExp.exec(url)
        if (pixelMatch) {
          for (
            let index = 0;
            index < this.markerPixelPositionResolvers.length;
            index++
          )
            this.markerPixelPositionResolvers[index]!(
              new WorldPosition(
                +pixelMatch[1]!,
                +pixelMatch[2]!,
                +pixelMatch[3]!,
                +pixelMatch[4]!,
              ),
            )
          this.markerPixelPositionResolvers.length = 0

          const data = (await responseClone.json()) as PixelMetaData
          for (
            let index = 0;
            index < this.markerPixelDataResolvers.length;
            index++
          )
            this.markerPixelDataResolvers[index]!(data)
          this.markerPixelDataResolvers.length = 0
          return
        }
      }, 0)
      return response
    }
  }

  /** Get position of marker on screen */
  protected getMarkerScreenPosition() {
    const marker = document.querySelector<HTMLDivElement>(
      '.maplibregl-marker.z-20',
    )
    if (!marker) throw new NoMarkerError(this)
    const rect = marker.getBoundingClientRect()
    return {
      x: rect.width / 2 + rect.left,
      y: rect.bottom - 7,
    }
  }

  /** Clear data on move */
  protected onMove() {
    if (!this.image || !this.startPosition) return
    this.startPosition = undefined
    this.startScreenPosition = undefined
    this.pixelSize = 0
    this.image = undefined
    this.tasks.length = 0
    this.overlay.update()
    this.widget.updateText()
    this.widget.setDisabled('draw', true)
  }
}
