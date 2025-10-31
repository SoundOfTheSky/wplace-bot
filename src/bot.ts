import { wait, withTimeout } from '@softsky/utils'

import { BotImage, DrawTask } from './image'
import { Pixels } from './pixels'
import { BotStrategy, Widget } from './widget'
import { Position, WorldPosition } from './world-position'

const SAVE_VERSION = 1

/**
 * Main class. Initializes everything.
 * Used to interact with wplace
 * */
export class WPlaceBot {
  public widget = new Widget(this)

  /** Colors that can be bought */
  public unavailableColors = new Set<number>()

  /** Estimated pixel size */
  public pixelSize = 1

  /** Cache of parsed images of world map */
  public mapsCache = new Map<string, Pixels>()

  /** World positions of anchors */
  public anchorsWorldPosition = new Array(2) as WorldPosition[]

  /** Screen positions of anchors*/
  public anchorsScreenPosition = new Array(2) as Position[]

  /** Used to wait for pixel data on marker set */
  protected markerPixelPositionResolvers: ((
    position: WorldPosition,
  ) => unknown)[] = []

  /** Used to defer save */
  protected saveTimeout?: ReturnType<typeof setTimeout>

  /** Last color drawn */
  protected lastColor?: number

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

      // Preinit save
      if (save) {
        this.widget.x = save.widget.x
        this.widget.y = save.widget.y
        this.widget.strategy = save.widget.strategy
      }

      await this.waitForElement('login', '.avatar.center-absolute.absolute')
      await this.waitForElement(
        'pixel count',
        '.btn.btn-primary.btn-lg.relative.z-30 canvas',
      )
      const $canvasContainer = await this.waitForElement(
        'canvas',
        '.maplibregl-canvas-container',
      )
      new MutationObserver(this.onAnchorsMutation.bind(this)).observe(
        $canvasContainer,
        {
          attributes: true,
          attributeFilter: ['style'],
          subtree: true,
          childList: true,
        },
      )
      await wait(500) // Sometimes wplace UI becomes bugged if interacted too early
      await this.loadAnchors()
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
      await this.readMap()
      this.widget.updateTasks()
      // Unblock buttons
      this.widget.setDisabled('draw', false)
      this.widget.setDisabled('add-image', false)
      this.widget.setDisabled('pumpkin-hunt', false)
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
          Promise.all([
            this.updateColors(),
            this.readMap(),
            (async () => {
              while (this.pixelSize < 3) {
                $canvas.dispatchEvent(
                  new WheelEvent('wheel', {
                    deltaY: -1000,
                    bubbles: true,
                    cancelable: true,
                    clientX: window.innerWidth / 2,
                    clientY: window.innerWidth / 2,
                  }),
                )
                await wait(200)
              }
            })(),
          ]),
        )
        // Stop mouse messing with drawing by capturing event
        globalThis.addEventListener('mousemove', prevent, true)
        $canvas.addEventListener('wheel', prevent, true)
        this.widget.updateTasks()
        let n = 0
        for (let index = 0; index < this.widget.images.length; index++)
          n += this.widget.images[index]!.tasks.length
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
              this.drawTask(minImage.tasks.shift()!)
              await wait(1)
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
  public async updateColors() {
    await this.openColors()
    for (const $button of document.querySelectorAll<HTMLButtonElement>(
      'button.btn.relative.w-full',
    ))
      if ($button.children.length !== 0)
        this.unavailableColors.add(
          Math.abs(Number.parseInt($button.id.slice(6))),
        )
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
    for (let index = 0; index < this.widget.images.length; index++) {
      const image = this.widget.images[index]!
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
  protected drawTask(task: DrawTask) {
    if (this.lastColor !== task.color) {
      ;(
        document.getElementById('color-' + task.color) as HTMLButtonElement
      ).click()
      this.lastColor = task.color
    }
    const position = task.position.toScreenPosition()
    document.documentElement.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: position.x,
        clientY: position.y,
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

  /** Start listening to fetch requests */
  protected registerFetchInterceptor() {
    const originalFetch = globalThis.fetch
    const pixelRegExp =
      /https:\/\/backend.wplace.live\/s\d+\/pixel\/(\d+)\/(\d+)\?x=(\d+)&y=(\d+)/
    // @ts-ignore
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
  protected loadAnchors() {
    return this.widget.run('Loading positions', async () => {
      await this.waitForUnfocus()
      await this.closeAll()
      const stars = this.getStars()
      const $canvas =
        document.querySelector<HTMLDivElement>('.maplibregl-canvas')!
      for (let index = 0; index < 2; index++) {
        let star = stars[index]
        // Select star's position or create one to put star into
        const position = star
          ? star[1]
          : index === 0
            ? { x: -20_000, y: -20_000 }
            : { x: 20_000, y: 20_000 }
        try {
          this.anchorsWorldPosition[index] =
            await this.clickAndGetPixelWorldPosition(position)
        } catch (error) {
          // Probably an error with zoom. Try to zoom in and retry.
          if (document.querySelector('ol')) {
            $canvas.dispatchEvent(
              new WheelEvent('wheel', {
                deltaY: -1000,
                bubbles: true,
                cancelable: true,
                clientX: window.innerWidth / 2,
                clientY: window.innerWidth / 2,
              }),
            )
            index--
            await wait(1000)
            continue
          } else throw error
        }

        // Check if distance is too small to serve as an anchor
        // Rerun this loop with star removed to create new star
        if (
          index === 1 &&
          this.anchorsWorldPosition[1]!.globalX -
            this.anchorsWorldPosition[0]!.globalX <
            500
        ) {
          index--
          stars[1] = undefined
          continue
        }

        // Add star if none found
        if (!star) {
          // Click "Favorite"
          document
            .querySelector<HTMLButtonElement>('button.btn-soft:nth-child(2)')!
            .click()
          // Wait for star marker to appear
          while (!star) {
            star = this.getStars()[index]
            await wait(100)
          }
        }
      }
      this.onAnchorsMutation()
    })
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

  /** Handle anchors changes */
  protected onAnchorsMutation() {
    const stars = this.getStars()
    const p1 = this.anchorsWorldPosition[0]
    const p2 = this.anchorsWorldPosition[1]
    if (!stars[0] || !stars[1] || !p1 || !p2) return
    const worldDistance = p2.globalX - p1.globalX
    this.anchorsScreenPosition[0] = stars[0][1]
    this.anchorsScreenPosition[1] = stars[1][1]
    const s1 = this.anchorsScreenPosition[0]
    const s2 = this.anchorsScreenPosition[1]
    this.pixelSize = (s2.x - s1.x) / worldDistance
    this.widget.updateImages()
  }

  /** Extracts screen position of star */
  protected extractScreenPositionFromStar($star: HTMLDivElement) {
    const [x, y] = $star.style.transform
      .slice(32, -29)
      .split(', ')
      .map((x) => Number.parseInt(x)) as [number, number]
    return { x, y }
  }

  /** Get stars that can be used as anchors */
  protected getStars(): [
    [HTMLElement, Position] | undefined,
    [HTMLElement, Position] | undefined,
  ] {
    let minX = Infinity
    let maxX = 0
    let min: [HTMLElement, Position] | undefined
    let max: [HTMLElement, Position] | undefined
    for (const $star of document.querySelectorAll<HTMLDivElement>(
      '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center',
    )) {
      const pos = this.extractScreenPositionFromStar($star)
      if (pos.x < minX) {
        minX = pos.x
        min = [$star, pos]
      } else if (pos.x > maxX) {
        maxX = pos.x
        max = [$star, pos]
      }
    }
    return [min, max]
  }
}
