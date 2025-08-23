import { NoImageError, NoMarkerError } from './errors'
import { Overlay } from './overlay'
import { Pixels } from './pixels'
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
import { WorldPosition } from './world-position'

/**
 * Main class. Initializes everything.
 * Used to interact with wplace
 * */
export class WPlaceBot {
  /** WPlace colors. Update with updateColors() */
  public colors: Color[] = []

  /** Position of image to draw */
  public anchorWorldPosition?: WorldPosition

  /** Screen position of starting pixel */
  public anchorScreenPosition?: Position

  /** Estimated pixel size */
  public pixelSize = 1

  /** Used to wait for pixel data on marker set */
  protected markerPixelPositionResolvers: ((
    position: WorldPosition,
  ) => unknown)[] = []

  /** Used to wait for pixel data on marker set */
  protected markerPixelDataResolvers: ((position: PixelMetaData) => unknown)[] =
    []

  public maps = new Map<string, Pixels>()

  public widget = new Widget(this)

  public overlay = new Overlay(this)

  public get screenPosition(): Position {
    const [x,y] = document.querySelector<HTMLDivElement>('.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center')!.style.transform.slice(32,-29).split(', ').map(x=>Number.parseInt(x)) as [number,number]
    return {x,y}
  }

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
        const position = this.anchorWorldPosition!.clone()
        const pixels =
          (pos2.globalY - this.anchorWorldPosition!.globalY) *
          (pos2.globalX - this.anchorWorldPosition!.globalX)
        let counted = 0
        for (; position.globalY < pos2.globalY; position.y++) {
          for (; position.globalX < pos2.globalX; position.x++) {
            const dataPromise = new Promise<PixelMetaData>((resolve) => {
              this.markerPixelDataResolvers.push(resolve)
            })
            await this.clickMapAtPosition(
              position.toScreenPosition(
                this.anchorScreenPosition!,
                this.anchorWorldPosition!,
                this.pixelSize,
              ),
            )
            const data = await dataPromise
            if (data.paintedBy.id !== 0) users.add(data.paintedBy.id)
            counted++

            this.widget.status = `⌛ Found ${users.size} users. ETA: ${((600 * (pixels - counted)) / 60_000) | 0}m (${((counted / pixels) * 100) | 0}%)`
            await wait(500)
          }
          position.globalX = this.anchorWorldPosition!.globalX
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
    if (
      !this.image ||
      !this.anchorWorldPosition ||
      !this.anchorScreenPosition
    ) {
      localStorage.removeItem('wbot')
      return
    }
    localStorage.setItem(
      'wbot',
      JSON.stringify({
        image: this.image,
        startScreenPosition: this.anchorScreenPosition,
        startPosition: this.anchorWorldPosition,
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
          document.querySelector('.avatar.center-absolute.absolute') &&
          document.querySelector<HTMLDivElement>('.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center')
        ) {
          resolve()
          clearInterval(interval)
        }
      }, 500)
    })

    const positionPromise = new Promise<WorldPosition>((resolve) => {
        this.markerPixelPositionResolvers.push(resolve)
      })
    this.clickMapAtPosition(this.screenPosition);
    this.anchorWorldPosition = await positionPromise
    this.anchorScreenPosition = {...this.screenPosition}
    document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!.addEventListener('mousemove', () => {
      /** UPDATE IMAGES */
    })
    this.widget.element.classList.remove('hidden')
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
      this.anchorWorldPosition = await this.widget.runWithStatusAsync(
        'Place marker',
        async () =>
          new Promise<WorldPosition>((resolve) =>
            this.markerPixelPositionResolvers.push(resolve),
          ),
        undefined,
        '🖱️',
      )
      this.anchorScreenPosition = this.getMarkerScreenPosition()

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
        (markerScreenPosition2.x - this.anchorScreenPosition.x) /
        (markerPosition2.globalX - this.anchorWorldPosition.globalX)
      this.anchorScreenPosition.x -= this.pixelSize / 2
    })
  }

  /** Calculates everything we need to do. Very expensive task! */
  protected updateTasks() {
    return this.widget.runWithStatusAsync('Map reading', async () => {
      if (!this.anchorWorldPosition || !this.anchorScreenPosition)
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
        const position = this.anchorWorldPosition.clone()
        position.x += x
        position.y += y
        let map = maps.get(position.tileX + '/' + position.tileY)
        if (!map) {
          map = await Pixels.fromURL(
            this,
            `https://backend.wplace.live/files/s0/tiles/${position.tileX}/${position.tileY}.png`,
            this.colors,
          )
          maps.set(position.tileX + '/' + position.tileY, map)
        }
        const colorOnMap = map.pixels[position.y]![position.x]!
        if (color.buttonId !== colorOnMap.buttonId)
          this.tasks.push({
            ...position.toScreenPosition(
              this.anchorScreenPosition,
              this.anchorWorldPosition,
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
  public updateColors() {
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
    if (!this.image || !this.anchorWorldPosition) return
    this.anchorWorldPosition = undefined
    this.anchorScreenPosition = undefined
    this.pixelSize = 0
    this.image = undefined
    this.tasks.length = 0
    this.overlay.update()
    this.widget.updateText()
    this.widget.setDisabled('draw', true)
  }

  /** Move map */
  protected moveMap(delta: Position) {
    const canvas = document.querySelector('.maplibregl-canvas')!
    const rect = canvas.getBoundingClientRect()
    const startX = rect.left + rect.width / 2
    const startY = rect.top + rect.height / 2
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
    fire('mousemove', startX + delta.x, startY + delta.x)
    fire('mouseup', startX + delta.y, startY + delta.y)
  }
}
