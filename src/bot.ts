import { wait, withTimeout } from '@softsky/utils'

import { NoFavLocation } from './errors'
import { BotImage, DrawTask } from './image'
import { Color, Pixels } from './pixels'
import { BotStrategy, Widget } from './widget'
import { Position, WorldPosition } from './world-position'

const SAVE_VERSION = 1

/**
 * Main class. Initializes everything.
 * Used to interact with wplace
 * */
export class WPlaceBot {
  public widget = new Widget(this)

  /** WPlace colors. Update with updateColors() */
  public colors: Color[] = []

  /** Position of image to draw */
  public anchorWorldPosition?: WorldPosition

  /** Estimated pixel size */
  public pixelSize = 1

  /** Cache of parsed images of world map */
  public mapsCache = new Map<string, Pixels>()

  /** Anchor screen position of anchor world position */
  public get anchorScreenPosition(): Position {
    const $favLocation = document.querySelector<HTMLDivElement>(
      '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center',
    )
    if (!$favLocation) throw new NoFavLocation(this)
    const [x, y] = $favLocation.style.transform
      .slice(32, -29)
      .split(', ')
      .map((x) => Number.parseInt(x)) as [number, number]
    return { x, y }
  }

  /** Used to wait for pixel data on marker set */
  protected markerPixelPositionResolvers: ((
    position: WorldPosition,
  ) => unknown)[] = []

  /** Used to not run multiple estimation tasks at the same time */
  protected estimatingSize = false

  /** Used to defer save */
  protected saveTimeout?: ReturnType<typeof setTimeout>

  public constructor() {
    this.registerFetchInterceptor()
    void this.widget.run('Initializing', async () => {
      // Try to load save
      const json = localStorage.getItem('wbot')!
      let save: ReturnType<WPlaceBot['toJSON']> | undefined
      try {
        save = JSON.parse(json) as typeof save
        if (typeof save !== 'object' || save.version !== SAVE_VERSION)
          throw new Error('NOT VALID SAVE')
      } catch {
        localStorage.removeItem('wbot')
        save = undefined
      }

      if (save) {
        this.widget.x = save.widget.x
        this.widget.y = save.widget.y
        this.widget.strategy = save.widget.strategy
      }
      while (
        // Canvas
        !document.querySelector('.maplibregl-canvas') ||
        // Number of pixels
        !document.querySelector(
          '.btn.btn-primary.btn-lg.relative.z-30 canvas',
        ) ||
        // Avatar
        !document.querySelector('.avatar.center-absolute.absolute')
      )
        await wait(500)
      await wait(500) // Sometimes wplace UI becomes bugged if interacted too early
      await this.estimateSize()
      await this.updateColors()

      // Load images
      if (save)
        for (let index = 0; index < save.widget.images.length; index++) {
          const image = await BotImage.fromJSON(
            this,
            save.widget.images[index]!,
          )
          this.widget.images.push(image)
          image.update()
        }
      this.widget.update()

      const $canvas =
        document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!
      // Update images
      setInterval(() => {
        this.widget.updateImages()
      }, 50)
      // Require to reestimate size on wheel. Sadly.
      $canvas.addEventListener('wheel', () => {
        void this.estimateSize()
      })
      // Unblock buttons
      this.widget.setDisabled('draw', false)
      this.widget.setDisabled('add-image', false)
    })
  }

  /** Start drawing */
  public draw() {
    this.widget.status = ''
    const prevent = (event: MouseEvent) => {
      if (!event.shiftKey) event.stopPropagation()
    }
    // Stop mouse messing with drawing by capturing event
    globalThis.addEventListener('mousemove', prevent, true)
    return this.widget.run(
      'Drawing',
      async () => {
        // Clear maps cache to refetch pixels
        this.mapsCache.clear()
        this.widget.setDisabled('draw', true)
        this.save()
        await this.updateColors()
        for (let index = 0; index < this.widget.images.length; index++)
          await this.widget.images[index]!.updateTasks()
        const n = this.widget.images.reduce(
          (accumulator, x) => accumulator + x.tasks.length,
          0,
        )
        switch (this.widget.strategy) {
          case BotStrategy.ALL: {
            while (!document.querySelector('ol')) {
              let end = true
              for (
                let imageIndex = 0;
                imageIndex < this.widget.images.length;
                imageIndex++
              ) {
                const task = this.widget.images[imageIndex]!.tasks.shift()
                if (!task) continue
                await this.drawTask(task)
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
                imageIndex < this.widget.images.length;
                imageIndex++
              ) {
                const image = this.widget.images[imageIndex]!
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
              await this.drawTask(minImage.tasks.shift()!)
            }
            break
          }
          case BotStrategy.SEQUENTIAL: {
            for (
              let imageIndex = 0;
              imageIndex < this.widget.images.length;
              imageIndex++
            ) {
              const image = this.widget.images[imageIndex]!
              for (
                let task = image.tasks.shift();
                task && !document.querySelector('ol');
                task = image.tasks.shift()
              )
                await this.drawTask(task)
            }
          }
        }
        this.widget.updateImages()
        this.widget.update()
      },
      () => {
        globalThis.removeEventListener('mousemove', prevent, true)
        this.widget.setDisabled('draw', false)
      },
    )
  }

  /** Save data to localStorage */
  public save() {
    clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => {
      localStorage.setItem('wbot', JSON.stringify(this))
    }, 1000)
  }

  /** Serialize bot */
  public toJSON() {
    return {
      version: SAVE_VERSION,
      widget: this.widget.toJSON(),
    }
  }

  /** Read colors */
  public updateColors() {
    return this.widget.run('Colors update', async () => {
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

  /** Opens colors and makes them visible for selection */
  protected async openColors() {
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

  /** Click map at the screen position */
  protected async clickAndGetPixelWorldPosition(screenPosition: Position) {
    await this.waitForUnfocus()
    const positionPromise = withTimeout(
      () =>
        new Promise<WorldPosition>((resolve) => {
          this.markerPixelPositionResolvers.push(resolve)
        }),
      1000,
    )
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
    return positionPromise
  }

  /** Draw one task */
  protected async drawTask(task: DrawTask) {
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
    await wait(1)
  }

  /** Wait until window is unfocused */
  protected waitForUnfocus() {
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
      setTimeout(() => {
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
          return
        }
      }, 0)
      return response
    }
  }

  /** Estimate size and position of map */
  protected estimateSize() {
    if (this.estimatingSize) return
    this.anchorWorldPosition = undefined
    this.estimatingSize = true
    return this.widget.run(
      'Adjusting',
      async () => {
        await this.waitForUnfocus()
        await this.closeAll()
        const $star = document.querySelector(
          '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center',
        )
        // Click star or random position for new star
        this.anchorWorldPosition = await this.clickAndGetPixelWorldPosition(
          $star ? this.anchorScreenPosition : { x: 12, y: 12 },
        )
        // If no star, create one
        if (!$star) {
          // Click "Favorite"
          document
            .querySelector<HTMLButtonElement>('button.btn-soft:nth-child(2)')!
            .click()
          // Wait for favorite marker to appear
          while (
            !document.querySelector(
              '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center',
            )
          )
            await wait(100)
        }
        // Click second position to compute distance and pixel size
        const markerScreenPosition2 = {
          x: this.anchorScreenPosition.x + 10_000,
          y: this.anchorScreenPosition.y,
        }
        const markerPosition2 = await this.clickAndGetPixelWorldPosition(
          markerScreenPosition2,
        )
        this.pixelSize =
          (markerScreenPosition2.x - this.anchorScreenPosition.x) /
          (markerPosition2.globalX - this.anchorWorldPosition.globalX)
        this.widget.updateImages()
      },
      () => {
        this.estimatingSize = false
      },
    )
  }

  /** Closes all popups */
  protected async closeAll() {
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
}
