import {
  promisifyEventSource,
  removeFromArray,
  type RequiredKey,
} from '@softsky/utils'

import { Base } from './base'
import { WPlaceBot } from './bot'
import { COLORS, COLORS_RGB, colorToCSS } from './colors'
// @ts-ignore
import html from './image.html' with { type: 'text' }
import {
  addClass,
  containsClass,
  obfucsateHTML,
  querySelectorAll,
  removeClass,
  toggleClass,
} from './obfuscator'
import { save, SAVE_VERSION } from './save'
import { workerPixels } from './worker-client'
import { WorldPosition } from './world-position'

export type DrawTask = {
  position: WorldPosition
  color: number
}

export type ImageColorSetting = {
  color: number
  disabled?: boolean
}

export type PixelColorStat = {
  color: number
  amount: number
  realColor: number
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

export enum UnownedColorStrategy {
  BUY = 'BUY',
  SKIP = 'SKIP',
  SUBSTITUTE = 'SUBSTITUTE',
}

export class BotImage extends Base {
  public static async fromJSON(
    bot: WPlaceBot,
    data: RequiredKey<Partial<Awaited<ReturnType<BotImage['toJSON']>>>, 'url'>,
    progress?: (p: number) => void,
  ) {
    const image = new Image()
    image.src = data.url.startsWith('http')
      ? await fetch(data.url, { cache: 'no-store' })
          .then((x) => x.blob())
          .then((x) => URL.createObjectURL(x))
      : data.url
    await promisifyEventSource(image, ['load'], ['error'])

    const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
    const botImage = new BotImage(
      bot,
      data.position ? WorldPosition.fromJSON(bot, data.position) : undefined,
      canvas,
      data.width,
      data.brightness,
      data.strategy,
      data.opacity,
      data.drawTransparentPixels,
      data.drawColorsInOrder,
      data.colors,
      new Set(data.disabledColors),
      data.lock,
      data.disabled,
      data.name,
      data.unownedColorStrategy,
    )
    await botImage.updatePixels(progress)
    return botImage
  }

  public pixels = new Uint8Array(0)
  public readonly resolution: number
  public colorsStat = new Map<number, PixelColorStat>()

  public get height() {
    return (this.width / this.resolution) | 0
  }
  public set height(value: number) {
    this.width = (value * this.resolution) | 0
  }

  /** Pixels to draw */
  public tasks = new Uint32Array(0)

  /** Moving/resizing image */
  protected moveInfo?: {
    globalX?: number
    globalY?: number
    width?: number
    height?: number
    clientX: number
    clientY: number
  }

  protected imageData: Uint8ClampedArray

  public readonly element = document.createElement('div')
  public readonly $canvas!: HTMLCanvasElement
  protected readonly context
  protected readonly $brightness!: HTMLInputElement
  protected readonly $colors!: HTMLDivElement
  protected readonly $delete!: HTMLButtonElement
  protected readonly $drawColorsInOrder!: HTMLInputElement
  protected readonly $drawTransparent!: HTMLInputElement
  protected readonly $export!: HTMLDivElement
  protected readonly $lock!: HTMLButtonElement
  protected readonly $opacity!: HTMLInputElement
  protected readonly $progressLine!: HTMLDivElement
  protected readonly $progressText!: HTMLSpanElement
  protected readonly $resetSize!: HTMLButtonElement
  protected readonly $resetSizeSpan!: HTMLSpanElement
  protected readonly $settings!: HTMLDivElement
  protected readonly $strategy!: HTMLSelectElement
  protected readonly $topbar!: HTMLDivElement
  protected readonly $wrapper!: HTMLDivElement
  protected readonly $name!: HTMLInputElement
  protected readonly $unownedColorStrategyLabel!: HTMLLabelElement
  protected readonly $unownedColorStrategy!: HTMLSelectElement
  protected readonly $openSettings!: HTMLButtonElement
  protected readonly $dialog!: HTMLDialogElement

  public constructor(
    protected bot: WPlaceBot,
    /** Top-left corner of image */
    public position = WorldPosition.fromScreenPosition(bot, {
      x: 256,
      y: 32,
    }),
    /** Source image */
    public readonly image: OffscreenCanvas,
    /** Width of drawn image */
    public width = image.width,
    /** Brightness of image */
    public brightness = 0,
    /** Order of pixels to draw */
    public strategy = ImageStrategy.SPIRAL_TO_CENTER,
    /** Opacity of overlay */
    public opacity = 50,
    /** Should we erase pixels there transparency should be */
    public drawTransparentPixels = false,
    /** Should bot draw colors in order */
    public drawColorsInOrder = true,
    /** Colors order */
    public colors: number[] = [],
    /** Colors not to draw */
    public disabledColors = new Set<number>(),
    /** Stop accidental image edit */
    public lock = false,
    /** Disable this image from drawing and from counting toward totals */
    public disabled = false,
    /** Name of image */
    public name = `${image.width}x${image.height}`,
    /** What to do with colors that user does not own */
    public unownedColorStrategy = UnownedColorStrategy.BUY,
  ) {
    super()
    this.bot.images.push(this)
    this.resolution = image.width / image.height
    this.imageData = this.image
      .getContext('2d')!
      .getImageData(0, 0, image.width, image.height).data

    this.element.innerHTML = obfucsateHTML(html)
    addClass(this.element, 'image')
    document.body.append(this.element)

    this.populateElementsWithSelector(this.element, {
      $brightness: '.brightness',
      $colors: '.colors',
      $delete: '.delete',
      $drawColorsInOrder: '.draw-colors-in-order',
      $drawTransparent: '.draw-transparent',
      $export: '.export',
      $lock: '.lock',
      $opacity: '.opacity',
      $progressLine: '.progress div',
      $progressText: '.progress span',
      $resetSize: '.reset-size',
      $settings: '.form',
      $strategy: '.strategy',
      $topbar: '.topbar',
      $wrapper: '.wrapper',
      $name: '.name',
      $unownedColorStrategyLabel: '.unowned-color-strategy',
      $openSettings: '.open-settings',
      $dialog: 'dialog',
      $canvas: 'canvas',
    })
    this.context = this.$canvas.getContext('2d')!
    this.$unownedColorStrategy =
      this.$unownedColorStrategyLabel.querySelector<HTMLSelectElement>(
        'select',
      )!
    this.$resetSizeSpan =
      this.$resetSize.querySelector<HTMLSpanElement>('span')!

    this.$openSettings.addEventListener('click', () => {
      this.$dialog.showModal()
    })
    // Close on backdrop click
    this.$dialog.addEventListener('click', (event) => {
      if (event.target === this.$dialog) this.$dialog.close()
    })
    // Unowned color strategy
    this.$unownedColorStrategy.addEventListener('change', () => {
      this.unownedColorStrategy = this.$unownedColorStrategy
        .value as UnownedColorStrategy
      this.updateColors()
      void save(this.bot)
    })

    // Strategy
    this.$strategy.addEventListener('change', () => {
      this.strategy = this.$strategy.value as ImageStrategy
      void save(this.bot)
    })

    // Opacity
    this.$opacity.addEventListener('input', () => {
      this.opacity = this.$opacity.valueAsNumber
      this.$opacity.style.setProperty('--val', this.opacity + '%')
      this.updateUI()
      void save(this.bot)
    })
    this.$opacity.style.setProperty('--val', this.opacity + '%')

    let timeout: ReturnType<typeof setTimeout> | undefined

    this.$brightness.addEventListener('change', () => {
      clearTimeout(timeout)
      timeout = setTimeout(async () => {
        this.brightness = this.$brightness.valueAsNumber
        await this.updatePixels()
        await save(this.bot)
      }, 1000)
    })

    // Reset
    this.$resetSize.addEventListener('click', async () => {
      this.width = this.image.width
      await this.updatePixels()
      await save(this.bot)
    })

    // drawTransparent
    this.$drawTransparent.addEventListener('click', () => {
      this.drawTransparentPixels = this.$drawTransparent.checked
      void save(this.bot)
    })

    // drawColorsInOrder
    this.$drawColorsInOrder.addEventListener('click', () => {
      this.drawColorsInOrder = this.$drawColorsInOrder.checked
      this.updateColors()
      void save(this.bot)
    })

    // Lock
    this.$lock.addEventListener('click', () => {
      this.lock = !this.lock
      this.updateUI()
      void save(this.bot)
    })

    this.$delete.addEventListener('click', this.destroy.bind(this))

    // Export
    this.$export.addEventListener('click', this.export.bind(this))

    // Name
    this.$name.addEventListener('change', () => {
      this.name = this.$name.value
      this.updateUI()
      this.bot.widget.update()
      void save(this.bot)
    })

    this.bot.fixSpaceInInput(this.$name)

    // Move
    this.$canvas.addEventListener('mousedown', this.moveStart.bind(this))

    // Forward wheel event to scroll through image
    this.$wrapper.addEventListener('wheel', (event) =>
      document
        .querySelector<HTMLDivElement>('.maplibregl-canvas')!
        .dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaZ: event.deltaZ,
            clientX: event.clientX,
            clientY: event.clientY,
          }),
        ),
    )
    this.registerEvent(document, 'mouseup', this.moveStop.bind(this))
    this.registerEvent(document, 'mousemove', this.move.bind(this))

    // Resize
    for (const $resize of querySelectorAll<HTMLDivElement>(
      this.element,
      '.resize',
    ))
      $resize.addEventListener('mousedown', this.resizeStart.bind(this))
  }

  public async toJSON() {
    const blob = await this.image.convertToBlob({
      type: 'image/webp',
      quality: 1,
    })
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as string)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return {
      url,
      width: this.width,
      brightness: this.brightness,
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      disabledColors: Array.from(this.disabledColors),
      lock: this.lock,
      disabled: this.disabled,
      name: this.name,
      unownedColorStrategy: this.unownedColorStrategy,
      version: SAVE_VERSION,
    }
  }

  /** Calculates everything we need to do. Very expensive task! */
  public async updatePixels(progress?: (p: number) => void) {
    const progress2 =
      progress ??
      ((p: number) => {
        this.bot.widget.status = `⌛ Loading ${(p * 100) | 0}%`
      })
    const height = this.height
    const width = this.width
    const result = await workerPixels(
      {
        data: this.imageData,
        brightness: this.brightness,
        colors: this.colors,
        disabledColors: this.disabledColors,
        drawColorsInOrder: this.drawColorsInOrder,
        drawTransparentPixels: this.drawTransparentPixels,
        globalX: this.position.globalX,
        globalY: this.position.globalY,
        height,
        width,
        nativeHeight: this.image.height,
        nativeWidth: this.image.width,
        strategy: this.strategy,
        unavailableColors: this.bot.unavailableColors,
        unownedColorStrategy: this.unownedColorStrategy,
      },
      progress2,
    )
    this.colorsStat = result.colorStat
    this.tasks = this.disabled ? new Uint32Array(0) : result.taskPositions
    this.pixels = result.pixels
    this.$canvas.width = width
    this.$canvas.height = height
    this.context.clearRect(0, 0, width, height)
    const rgbPixels = new Uint8ClampedArray(this.pixels.length * 4)
    for (let index = 0; index < this.pixels.length; index++) {
      const pixel = this.pixels[index]!
      if (pixel === 0) continue
      const qIndex = index * 4
      const color = COLORS_RGB[pixel]!
      rgbPixels[qIndex] = color >> 16
      rgbPixels[qIndex + 1] = (color >> 8) & 0xff
      rgbPixels[qIndex + 2] = color & 0xff
      rgbPixels[qIndex + 3] = 255
    }
    this.context.putImageData(new ImageData(rgbPixels, width, height), 0, 0)
    this.updateUI()
    this.updateColors()
    if (!progress) this.bot.widget.status = ''
    this.bot.widget.update()
  }

  /** Update image (NOT PIXELS) */
  public updateUI() {
    const { x, y } = this.position.toScreenPosition()
    this.element.style.transform = `translate(${x}px, ${y}px)`
    this.element.style.width = `${this.position.pixelSize * this.width}px`
    this.$wrapper.style.opacity = this.disabled ? '0.4' : '1'
    this.$canvas.style.opacity = `${this.opacity}%`
    removeClass(this.element, 'hidden')

    this.$resetSizeSpan.textContent = this.width.toString()
    this.$brightness.valueAsNumber = this.brightness
    this.$strategy.value = this.strategy
    this.$opacity.valueAsNumber = this.opacity
    this.$drawTransparent.checked = this.drawTransparentPixels
    this.$drawColorsInOrder.checked = this.drawColorsInOrder
    this.$name.value = this.name
    const maxTasks = this.width * this.height
    const doneTasks = maxTasks - this.tasks.length / 2
    const percent = ((doneTasks / maxTasks) * 100) | 0
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${(this.tasks.length / 2 / 120) | 0}h`
    this.$progressLine.style.transform = `scaleX(${percent}%)`
    if (this.lock) addClass(this.$wrapper, 'no-pointer-events')
    else removeClass(this.$wrapper, 'no-pointer-events')
    this.$lock.textContent = this.lock ? '🔒' : '🔓'
  }

  /** Removes image */
  public override destroy() {
    super.destroy()
    this.element.remove()
    removeFromArray(this.bot.images, this)
    this.bot.widget.update()
    void save(this.bot)
  }

  /** Update colors array */
  public updateColors() {
    const LINE_HEIGHT = 20
    if (this.bot.unavailableColors.size === 0)
      addClass(this.$unownedColorStrategyLabel, 'hidden')
    this.$colors.innerHTML = ''
    const pixelsSum = this.width * this.height

    // If not the synced with colors then rebuild order
    if (
      this.colors.length !== this.colorsStat.size ||
      this.colors.some((x) => !this.colorsStat.has(x))
    ) {
      this.colors = this.colorsStat
        .values()
        .toArray()
        .sort((a, b) => b.amount - a.amount)
        .map((color) => color.realColor)
      void save(this.bot)
    }

    this.$colors.style.height = `${LINE_HEIGHT * this.colors.length}px`

    for (let index = 0; index < this.colors.length; index++) {
      const drawColor = this.colors[index]!
      if (!this.drawTransparentPixels && drawColor === 0) continue
      const css = (color: number) =>
        color === 0
          ? `repeating-linear-gradient(32deg, #ccc 0 8px, transparent 8px 16px)`
          : colorToCSS(color)
      const colorStat = this.colorsStat.get(drawColor)!
      const $button = document.createElement('button')
      // If dark make text white
      if (COLORS[drawColor]![0] < 0.6) addClass($button, 'dark')
      $button.title = 'Drag to reorder. Click to disable.'
      $button.style.top = `${index * LINE_HEIGHT}px`
      if (this.disabledColors.has(drawColor)) {
        const $warning = document.createElement('div')
        $warning.innerText = '❌'
        $warning.title = 'Disabled and will be skipped.'
        $button.appendChild($warning)
      }
      switch (this.unownedColorStrategy) {
        case UnownedColorStrategy.SUBSTITUTE:
          $button.style.background = css(colorStat.color)
          if (colorStat.color !== colorStat.realColor) {
            const $warning = document.createElement('button')
            $warning.style.backgroundColor = css(colorStat.realColor)
            $warning.title = 'This is the best color. Click to buy.'
            $warning.addEventListener('click', async () => {
              await this.bot.updateColorsData() // Will open colors to click
              document.getElementById('color-' + colorStat.realColor)?.click()
            })
            $button.appendChild($warning)
          }
          break
        case UnownedColorStrategy.BUY:
          $button.style.background = css(colorStat.realColor)
          if (this.bot.unavailableColors.has(colorStat.realColor)) {
            const $warning = document.createElement('div')
            $warning.innerText = '⌛'
            $warning.title = 'This color be automatically bought.'
            $button.appendChild($warning)
          }
          break
        case UnownedColorStrategy.SKIP:
          $button.style.background = css(colorStat.realColor)
          if (this.bot.unavailableColors.has(colorStat.realColor)) {
            const $warning = document.createElement('div')
            $warning.innerText = '⏩'
            $warning.title = 'Unowned colors will be skipped.'
            $button.appendChild($warning)
          }
          break
      }
      const $percent = document.createElement('span')
      addClass($percent, 'percent')
      $percent.innerText = `${colorStat.amount}px ${((colorStat.amount / pixelsSum) * 100) | 0}%`
      $button.appendChild($percent)
      this.$colors.append($button)

      let dragging = false

      // Dragging
      const startDrag = (startEvent: MouseEvent) => {
        addClass($button, 'dragging')
        let newIndex = index
        const mouseMoveHandler = (event: MouseEvent) => {
          newIndex = Math.min(
            this.colors.length - 1,
            Math.max(
              0,
              Math.round(
                index + (event.clientY - startEvent.clientY) / LINE_HEIGHT,
              ),
            ),
          )
          if (newIndex !== index) dragging = true
          let childIndex = 0
          for (const $child of this.$colors.children as Iterable<HTMLElement>) {
            if ($child === $button) continue
            if (childIndex === newIndex) childIndex++
            $child.style.top = `${LINE_HEIGHT * childIndex}px`
            childIndex++
          }
          $button.style.top = `${LINE_HEIGHT * newIndex}px`
        }
        this.registerEvent(document, 'mousemove', mouseMoveHandler)
        this.registerEvent(
          document,
          'mouseup',
          () => {
            removeClass($button, 'dragging')
            document.removeEventListener('mousemove', mouseMoveHandler)
            if (newIndex !== index)
              this.colors.splice(newIndex, 0, ...this.colors.splice(index, 1))
            void save(this.bot)
            $button.removeEventListener('mousedown', startDrag)
            setTimeout(() => {
              this.updateColors()
            }, 200)
          },
          {
            once: true,
          },
        )
      }
      $button.addEventListener('mousedown', startDrag)
      $button.addEventListener('click', async (event) => {
        event.stopPropagation()
        if (dragging) return
        if (this.disabledColors.has(drawColor))
          this.disabledColors.delete(drawColor)
        else this.disabledColors.add(drawColor)
        toggleClass($button, 'color-disabled')
        await this.updatePixels()
        await save(this.bot)
      })
    }
  }

  /** Called on move image start */
  protected moveStart(event: MouseEvent) {
    if (!this.lock)
      this.moveInfo = {
        globalX: this.position.globalX,
        globalY: this.position.globalY,
        clientX: event.clientX,
        clientY: event.clientY,
      }
  }

  /** Called on move image stop */
  protected async moveStop() {
    if (this.moveInfo) {
      this.moveInfo = undefined
      this.position.updateAnchor()
      await this.updatePixels()
    }
  }

  /** Resize/move image */
  protected move(event: MouseEvent) {
    if (!this.moveInfo) return
    const deltaX = Math.round(
      (event.clientX - this.moveInfo.clientX) / this.position.pixelSize,
    )
    const deltaY = Math.round(
      (event.clientY - this.moveInfo.clientY) / this.position.pixelSize,
    )
    if (this.moveInfo.globalX !== undefined) {
      this.position.globalX = deltaX + this.moveInfo.globalX
      if (this.moveInfo.width !== undefined)
        this.width = Math.max(1, this.moveInfo.width - deltaX)
    } else if (this.moveInfo.width !== undefined)
      this.width = Math.max(1, deltaX + this.moveInfo.width)
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY
      if (this.moveInfo.height !== undefined)
        this.height = Math.max(1, this.moveInfo.height - deltaY)
    } else if (this.moveInfo.height !== undefined)
      this.height = Math.max(1, deltaY + this.moveInfo.height)
    this.updateUI()
    void save(this.bot)
  }

  /** Resize start */
  protected resizeStart(event: MouseEvent) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY,
    }
    const $resize = event.target! as HTMLDivElement
    if (containsClass($resize, 'n')) {
      this.moveInfo.height = this.height
      this.moveInfo.globalY = this.position.globalY
    }
    if (containsClass($resize, 'e')) this.moveInfo.width = this.width
    if (containsClass($resize, 's')) this.moveInfo.height = this.height
    if (containsClass($resize, 'w')) {
      this.moveInfo.width = this.width
      this.moveInfo.globalX = this.position.globalX
    }
  }

  /** export image */
  protected export() {
    const a = document.createElement('a')
    document.body.append(a)
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(this.toJSON())], { type: 'application/json' }),
    )
    a.download = `${this.name}.wbot`
    a.click()
    URL.revokeObjectURL(a.href)
    a.href = this.$canvas.toDataURL('image/webp', 1)
    a.download = `${this.name}.webp`
    a.click()
    URL.revokeObjectURL(a.href)
    a.remove()
  }
}
