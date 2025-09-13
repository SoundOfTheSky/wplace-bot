import { Base } from './base'
import { WPlaceBot } from './bot'
import html from './image.html' with { type: 'text' }
import { Pixels } from './pixels'
import { Position, WorldPosition } from './world-position'

export type DrawTask = {
  position: WorldPosition
  buttonId: string
  mapColor: string
}

export enum ImageStrategy {
  RANDOM = 'RANDOM',
  DOWN = 'DOWN',
  UP = 'UP',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  SPIRAL_FROM_CENTER = 'SPIRAL_FROM_CENTER',
  SPIRAL_TO_CENTER = 'SPIRAL_TO_CENTER',
}

export class BotImage extends Base {
  public static async fromJSON(
    bot: WPlaceBot,
    data: ReturnType<BotImage['toJSON']>,
  ) {
    return new BotImage(
      bot,
      WorldPosition.fromJSON(bot, data.position),
      await Pixels.fromJSON(bot, data.pixels),
      data.strategy,
      data.opacity,
      data.drawTransparentPixels,
      data.lock,
    )
  }

  public readonly element = document.createElement('div')

  /** Pixels left to draw */
  public tasks: DrawTask[] = []

  /** Moving/resizing image */
  protected moveInfo?: {
    globalX?: number
    globalY?: number
    width?: number
    height?: number
    clientX: number
    clientY: number
  }

  protected readonly $wrapper!: HTMLDivElement
  protected readonly $settings!: HTMLDivElement
  protected readonly $strategy!: HTMLSelectElement
  protected readonly $topbar!: HTMLDivElement
  protected readonly $lock!: HTMLButtonElement
  protected readonly $opacity!: HTMLInputElement
  protected readonly $brightness!: HTMLInputElement
  protected readonly $drawTransparent!: HTMLInputElement
  protected readonly $resetSize!: HTMLButtonElement
  protected readonly $resetSizeSpan!: HTMLSpanElement
  protected readonly $progressLine!: HTMLDivElement
  protected readonly $progressText!: HTMLSpanElement
  protected readonly $canvas!: HTMLCanvasElement
  protected readonly $colors!: HTMLDivElement
  protected readonly $export!: HTMLDivElement

  public constructor(
    protected bot: WPlaceBot,
    /** Top-left corner of image */
    public position: WorldPosition,
    /** Parsed imageto draw */
    public pixels: Pixels,
    /** Order of pixels to draw */
    public strategy = ImageStrategy.RANDOM,
    /** Opacity of overlay */
    public opacity = 50,
    /** Should we erase pixels there transparency should be */
    public drawTransparentPixels = false,
    /** Stop accidental image edit */
    public lock = false,
  ) {
    super()
    this.element.innerHTML = html as unknown as string
    this.element.classList.add('wimage')
    document.body.append(this.element)

    this.populateElementsWithSelector(this.element, {
      $wrapper: '.wrapper',
      $strategy: '.strategy',
      $opacity: '.opacity',
      $settings: '.wsettings',
      $lock: '.lock',
      $topbar: '.wtopbar',
      $brightness: '.brightness',
      $drawTransparent: '.draw-transparent',
      $resetSize: '.reset-size',
      $progressLine: '.progress div',
      $progressText: '.progress span',
      $colors: '.colors',
      $export: '.export',
    })
    this.$resetSizeSpan =
      this.$resetSize.querySelector<HTMLSpanElement>('span')!
    this.$canvas = this.pixels.canvas
    this.$wrapper.prepend(this.pixels.canvas)

    // Strategy
    this.registerEvent(this.$strategy, 'change', () => {
      this.strategy = this.$strategy.value as ImageStrategy
      this.bot.save()
    })

    // Opacity
    this.registerEvent(this.$opacity, 'input', () => {
      this.opacity = this.$opacity.valueAsNumber
      this.update()
      this.bot.save()
    })

    // Brightness
    let timeout: ReturnType<typeof setTimeout> | undefined

    this.registerEvent(this.$brightness, 'change', () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        this.pixels.brightness = this.$brightness.valueAsNumber
        this.pixels.update()
        this.updateColorsToBuy()
        this.update()
        this.bot.save()
      }, 1000)
    })

    // Reset
    this.registerEvent(this.$resetSize, 'click', () => {
      this.pixels.width = this.pixels.image.naturalWidth
      this.pixels.update()
      this.updateColorsToBuy()
      this.update()
      this.bot.save()
    })

    // drawTransparent
    this.registerEvent(this.$drawTransparent, 'click', () => {
      this.drawTransparentPixels = this.$drawTransparent.checked
      this.bot.save()
    })

    // click-through
    this.registerEvent(this.$lock, 'click', () => {
      this.lock = !this.lock
      this.update()
      this.bot.save()
    })

    // Export
    this.registerEvent(this.$export, 'click', this.export.bind(this))

    // Move
    this.registerEvent(this.$topbar, 'mousedown', this.moveStart.bind(this))
    this.registerEvent(this.$canvas, 'mousedown', this.moveStart.bind(this))
    this.registerEvent(document, 'mouseup', this.moveStop.bind(this))
    this.registerEvent(document, 'mousemove', this.move.bind(this))

    // Resize
    for (const $resize of this.element.querySelectorAll<HTMLDivElement>(
      '.resize',
    ))
      this.registerEvent($resize, 'mousedown', this.resizeStart.bind(this))
    this.update()
    this.updateColorsToBuy()
  }

  public toJSON() {
    return {
      pixels: this.pixels.toJSON(),
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels,
      lock: this.lock,
    }
  }

  /** Calculates everything we need to do. Very expensive task! */
  public async updateTasks() {
    this.tasks.length = 0
    const position = this.position.clone()
    for (const { x, y } of this.strategyPositionIterator()) {
      const color = this.pixels.pixels[y]![x]!
      position.globalX = this.position.globalX + x
      position.globalY = this.position.globalY + y
      const mapColor = await position.getMapColor()
      if (
        color !== mapColor &&
        (this.drawTransparentPixels || color !== 'color-0')
      )
        this.tasks.push({
          position: position.clone(),
          buttonId: color,
          mapColor,
        })
    }
    this.update()
    this.bot.widget.update()
  }

  /** Update image (NOT PIXELS) */
  public update() {
    const halfPixel = this.bot.pixelSize / 2
    try {
      // Might throw if no anchor. Then we just hide all images
      const { x, y } = this.position.toScreenPosition()
      this.element.style.transform = `translate(${x - halfPixel}px, ${y - halfPixel}px)`
      this.element.style.width = `${this.bot.pixelSize * this.pixels.width}px`
      this.$canvas.style.opacity = `${this.opacity}%`
      this.element.classList.remove('hidden')
    } catch {
      this.element.classList.add('hidden')
    }

    this.$resetSizeSpan.textContent = this.pixels.width.toString()
    this.$brightness.valueAsNumber = this.pixels.brightness
    this.$strategy.value = this.strategy
    this.$opacity.valueAsNumber = this.opacity
    this.$drawTransparent.checked = this.drawTransparentPixels
    const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0]!.length
    const doneTasks = maxTasks - this.tasks.length
    const percent = ((doneTasks / maxTasks) * 100) | 0
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${(this.tasks.length / 120) | 0}h`
    this.$progressLine.style.transform = `scaleX(${percent}%)`
    this.$wrapper.classList[this.lock ? 'add' : 'remove']('no-pointer-events')
    this.$lock.textContent = this.lock ? '🔒' : '🔓'
  }

  /** Removes image. Don't forget to remove from array inside widget. */
  public destroy() {
    super.destroy()
    this.element.remove()
  }

  /** Create iterator that generates positions based on strategy */
  protected *strategyPositionIterator(): Generator<Position> {
    const width = this.pixels.pixels[0]!.length
    const height = this.pixels.pixels.length
    switch (this.strategy) {
      case ImageStrategy.DOWN: {
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) yield { x, y }
        break
      }
      case ImageStrategy.UP: {
        for (let y = height - 1; y >= 0; y--)
          for (let x = 0; x < width; x++) yield { x, y }
        break
      }
      case ImageStrategy.LEFT: {
        for (let x = 0; x < width; x++)
          for (let y = 0; y < height; y++) yield { x, y }
        break
      }
      case ImageStrategy.RIGHT: {
        for (let x = width - 1; x >= 0; x--)
          for (let y = 0; y < height; y++) yield { x, y }
        break
      }
      case ImageStrategy.RANDOM: {
        const positions: Position[] = []
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) positions.push({ x, y })
        for (let index = positions.length - 1; index >= 0; index--) {
          const index_ = Math.floor(Math.random() * (index + 1))
          const temporary = positions[index]!
          positions[index] = positions[index_]!
          positions[index_] = temporary
        }
        yield* positions
        break
      }

      case ImageStrategy.SPIRAL_FROM_CENTER:
      case ImageStrategy.SPIRAL_TO_CENTER: {
        const visited = new Set<string>()
        const total = width * height
        let x = Math.floor(width / 2)
        let y = Math.floor(height / 2)
        const directories = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ]
        let directionIndex = 0
        let steps = 1
        const inBounds = (x: number, y: number) =>
          x >= 0 && x < width && y >= 0 && y < height
        const emit = function* () {
          let count = 0
          while (count < total) {
            for (let twice = 0; twice < 2; twice++) {
              for (let index = 0; index < steps; index++) {
                if (inBounds(x, y)) {
                  const key = `${x},${y}`
                  if (!visited.has(key)) {
                    visited.add(key)
                    yield { x, y }
                    count++
                    if (count >= total) return
                  }
                }
                x += directories[directionIndex]![0]!
                y += directories[directionIndex]![1]!
              }
              directionIndex = (directionIndex + 1) % 4
            }
            steps++
          }
        }

        if (this.strategy === ImageStrategy.SPIRAL_FROM_CENTER) yield* emit()
        else {
          const collected = [...emit()]
          for (let index = collected.length - 1; index >= 0; index--)
            yield collected[index]!
        }
        break
      }
    }
  }

  protected moveStart(event: MouseEvent) {
    if (!this.lock)
      this.moveInfo = {
        globalX: this.position.globalX,
        globalY: this.position.globalY,
        clientX: event.clientX,
        clientY: event.clientY,
      }
  }

  protected moveStop() {
    this.moveInfo = undefined
  }

  /** Resize/move image */
  protected move(event: MouseEvent) {
    if (!this.moveInfo) return
    const deltaX = Math.round(
      (event.clientX - this.moveInfo.clientX) / this.bot.pixelSize,
    )
    const deltaY = Math.round(
      (event.clientY - this.moveInfo.clientY) / this.bot.pixelSize,
    )
    if (this.moveInfo.globalX !== undefined) {
      this.position.globalX = deltaX + this.moveInfo.globalX
      if (this.moveInfo.width !== undefined)
        this.pixels.width = Math.max(1, this.moveInfo.width - deltaX)
    } else if (this.moveInfo.width !== undefined)
      this.pixels.width = Math.max(1, deltaX + this.moveInfo.width)
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY
      if (this.moveInfo.height !== undefined)
        this.pixels.height = Math.max(1, this.moveInfo.height - deltaY)
    } else if (this.moveInfo.height !== undefined)
      this.pixels.height = Math.max(1, deltaY + this.moveInfo.height)
    if (
      this.moveInfo.width !== undefined ||
      this.moveInfo.height !== undefined
    ) {
      this.pixels.update()
      this.updateColorsToBuy()
    }
    this.update()
    this.bot.save()
  }

  /** Resize start */
  protected resizeStart(event: MouseEvent) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY,
    }
    const $resize = event.target! as HTMLDivElement
    if ($resize.classList.contains('n')) {
      this.moveInfo.height = this.pixels.height
      this.moveInfo.globalY = this.position.globalY
    }
    if ($resize.classList.contains('e')) this.moveInfo.width = this.pixels.width
    if ($resize.classList.contains('s'))
      this.moveInfo.height = this.pixels.height
    if ($resize.classList.contains('w')) {
      this.moveInfo.width = this.pixels.width
      this.moveInfo.globalX = this.position.globalX
    }
  }

  /** Draw colors to buy */
  protected updateColorsToBuy() {
    if (this.pixels.colorsToBuy.length === 0) {
      this.$colors.innerHTML = 'You have all colors!'
      return
    }
    let sum = 0
    for (let index = 0; index < this.pixels.colorsToBuy.length; index++)
      sum += this.pixels.colorsToBuy[index]![1]
    this.$colors.innerHTML = ''
    for (let index = 0; index < this.pixels.colorsToBuy.length; index++) {
      const [color, amount] = this.pixels.colorsToBuy[index]!
      const $button = document.createElement('button')
      this.$colors.append($button)
      $button.style.backgroundColor = `oklab(${color.color[0] * 100}% ${color.color[1]} ${color.color[2]})`
      $button.style.width = (amount / sum) * 100 + '%'
      // Do not use register event cause it will be disposed automatically
      $button.addEventListener('click', async () => {
        await this.bot.updateColors()
        document.getElementById(color.buttonId)?.click()
      })
    }
  }

  /** export image */
  protected export() {
    const a = document.createElement('a')
    document.body.append(a)
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(this.toJSON())], { type: 'application/json' }),
    )
    a.download = `${this.pixels.width}x${this.pixels.height}.wbot`
    a.click()
    URL.revokeObjectURL(a.href)
    a.href = this.pixels.canvas.toDataURL('image/webp', 1)
    a.download = `${this.pixels.width}x${this.pixels.height}.webp`
    a.click()
    URL.revokeObjectURL(a.href)
    a.remove()
  }
}
