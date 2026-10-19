import { promisifyEventSource, removeFromArray, type RequiredKey } from '@softsky/utils'
import { Base } from './base'
import { WPlaceBot } from './bot'
import { COLORS_LAB, COLORS_RGB, colorToCSS } from './colors'
// @ts-ignore
import imageCss from './image.css' with { type: 'text' }
// @ts-ignore
import html from './image.html' with { type: 'text' }
import { SAVE_VERSION } from './save'
// @ts-ignore
import sharedCss from './shared.css' with { type: 'text' }
import { etaText, formatPercent, isColorAvailable } from './utils'
import { latToPos, lngToPos, posToLat, posToLng, WorldPosition } from './world-position'

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
  left: number
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

export type ColorMetric = 'lab' | 'ciede2000' | 'compuphase'

export type ColorPaletteMode = 'free' | 'unlocked' | 'template' | 'all'

export type Template = {
  id: string
  name: string
  bounds: {
    north: number
    south: number
    west: number
    east: number
  }
  opacity: number
  visible: boolean
  locked: boolean
  colorMetric: ColorMetric
  dithering: boolean
  useLegacyColors: boolean
  colorPaletteMode: ColorPaletteMode
  hasPlaced: boolean
  originalWidth: number
  originalHeight: number
  order: number
  updatedAt: number
}

export const DEFAULT_TEMPLATE_SETTINGS: Pick<
  Template,
  'colorMetric' | 'dithering' | 'useLegacyColors' | 'colorPaletteMode' | 'visible' | 'hasPlaced'
> = {
  colorMetric: 'lab',
  dithering: true,
  useLegacyColors: false,
  colorPaletteMode: 'all',
  visible: true,
  hasPlaced: false,
}

export class BotImage extends Base {
  public static async fromJSON(
    bot: WPlaceBot,
    data: RequiredKey<Partial<Awaited<ReturnType<BotImage['toJSON']>>>, 'url' | 'template'>,
  ) {
    let image: HTMLImageElement | ImageBitmap
    let blob!: Blob
    if (typeof data.url === 'string') {
      image = new Image()
      image.src = data.url.startsWith('http')
        ? await fetch(data.url, { cache: 'no-store' })
            .then((x) => x.blob())
            .then((x) => {
              blob = x
              return URL.createObjectURL(x)
            })
        : data.url
      await promisifyEventSource(image, ['load'], ['error'])
    } else {
      image = await createImageBitmap(data.url)
      blob = data.url
    }
    const canvas = new OffscreenCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)

    if (Number.isNaN(data.template.originalWidth)) data.template.originalWidth = image.width
    if (Number.isNaN(data.template.originalHeight)) data.template.originalHeight = image.height
    if (Number.isNaN(data.template.bounds.south))
      data.template.bounds.south = posToLat(
        latToPos(data.template.bounds.north) + data.template.originalHeight,
      )
    if (Number.isNaN(data.template.bounds.east))
      data.template.bounds.east = posToLng(
        lngToPos(data.template.bounds.west) + data.template.originalWidth,
      )
    const botImage = new BotImage(
      bot,
      data.template,
      canvas,
      data.strategy,
      data.drawColorsInOrder,
      data.colors,
      new Set(data.disabledColors ?? [0]),
      data.lock,
      data.disabled,
      data.autoBuyColors,
    )
    await bot.worker.register(data.template.id, blob)
    await botImage.updatePixels()
    return botImage
  }

  public pixels = new Uint8Array(0)
  public colorsCount = new Uint32Array(64)
  public colorsLeft = new Uint32Array(64)

  public get width() {
    const bounds = this.template.bounds
    return lngToPos(bounds.east) - lngToPos(bounds.west)
  }
  public set width(value: number) {
    this.template.bounds.east = posToLng(value)
  }

  public get height() {
    const bounds = this.template.bounds
    return latToPos(bounds.south) - latToPos(bounds.north)
  }
  public set height(value: number) {
    this.template.bounds.south = posToLat(value)
  }

  /** Pixels to draw X */
  public tasksX = new Uint32Array(0)
  /** Pixels to draw Y */
  public tasksY = new Uint32Array(0)
  /** Position of image. After updating call syncPositionWithTemplate() */
  public position: WorldPosition

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

  public readonly $canvas!: HTMLCanvasElement
  protected readonly context
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
  protected readonly $autoBuyColorsLabel!: HTMLLabelElement
  protected readonly $autoBuyColors!: HTMLInputElement
  protected readonly $openSettings!: HTMLButtonElement
  protected readonly $dialog!: HTMLDialogElement

  public constructor(
    protected bot: WPlaceBot,
    /** Wplace template */
    public template: Template,
    /** Source image */
    public readonly image: OffscreenCanvas,
    /** Order of pixels to draw */
    public strategy = ImageStrategy.SPIRAL_TO_CENTER,
    /** Should bot draw colors in order */
    public drawColorsInOrder = true,
    /** Colors order */
    public colors: number[] = [],
    /** Colors not to draw */
    public disabledColors = new Set<number>([0]),
    /** Stop accidental image edit */
    public lock = false,
    /** Disable this image from drawing and from counting toward totals */
    public disabled = false,
    /** What to do with colors that user does not own */
    public autoBuyColors = true,
  ) {
    super(html as unknown as string, `${sharedCss as string}\n${imageCss as string}`)
    this.populateElementsWithSelector({
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
      $autoBuyColorsLabel: '.auto-buy-colors',
      $openSettings: '.open-settings',
      $dialog: 'dialog',
      $canvas: 'canvas',
    })

    this.bot.images.push(this)
    this.position = new WorldPosition(
      bot,
      lngToPos(this.template.bounds.west),
      latToPos(this.template.bounds.north),
    )
    this.imageData = this.image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data

    this.context = this.$canvas.getContext('2d')!
    this.$autoBuyColors = this.$autoBuyColorsLabel.querySelector<HTMLInputElement>('input')!
    this.$resetSizeSpan = this.$resetSize.querySelector<HTMLSpanElement>('span')!

    this.$openSettings.addEventListener('click', () => {
      this.$dialog.showModal()
    })
    // Close on backdrop click
    this.$dialog.addEventListener('click', (event) => {
      if (event.target === this.$dialog) this.$dialog.close()
    })

    // Auto buy colors
    this.$autoBuyColors.addEventListener('change', () => {
      this.autoBuyColors = this.$autoBuyColors.checked
      this.updateColors()
      void this.bot.save.save()
    })

    // Strategy
    this.$strategy.addEventListener('change', () => {
      this.strategy = this.$strategy.value as ImageStrategy
      void this.bot.save.save()
    })

    // Opacity
    this.$opacity.addEventListener('input', () => {
      this.template.opacity = this.$opacity.valueAsNumber
      this.$opacity.style.setProperty('--val', this.template.opacity + '%')
      this.updateUI()
      void this.bot.save.save()
    })
    this.$opacity.style.setProperty('--val', this.template.opacity + '%')

    // Reset
    this.$resetSize.addEventListener('click', async () => {
      this.width = this.template.originalWidth
      this.height = this.template.originalHeight
      await this.updatePixels()
      await this.bot.save.save()
    })

    // drawColorsInOrder
    this.$drawColorsInOrder.addEventListener('click', () => {
      this.drawColorsInOrder = this.$drawColorsInOrder.checked
      this.updateColors()
      void this.bot.save.save()
    })

    // Lock
    this.$lock.addEventListener('click', () => {
      this.lock = !this.lock
      this.updateUI()
      void this.bot.save.save()
    })

    this.$delete.addEventListener('click', this.destroy.bind(this))

    // Export
    this.$export.addEventListener('click', this.exportSaveFile.bind(this))

    // Name
    this.$name.addEventListener('change', () => {
      this.template.name = this.$name.value
      this.updateUI()
      this.bot.widget.update()
      void this.bot.save.save()
    })

    this.bot.fixSpaceInInput(this.$name)

    // Move
    this.$canvas.addEventListener('mousedown', this.moveStart.bind(this))

    // Forward wheel event to scroll through image
    this.$wrapper.addEventListener('wheel', (event) =>
      document.querySelector<HTMLDivElement>('.maplibregl-canvas')!.dispatchEvent(
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
    for (const $resize of this.shadow.querySelectorAll<HTMLDivElement>('.resize'))
      $resize.addEventListener('mousedown', this.resizeStart.bind(this))
  }

  public async toJSON(exportBlob?: boolean) {
    const blob = await this.image.convertToBlob({ type: 'image/png', quality: 1 })
    let url: Blob | string = blob
    if (!exportBlob) {
      url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve(reader.result as string)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }
    return {
      id: this.template.id,
      url,
      template: this.template,
      strategy: this.strategy,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      disabledColors: Array.from(this.disabledColors),
      lock: this.lock,
      disabled: this.disabled,
      autoBuyColors: this.autoBuyColors,
      version: SAVE_VERSION,
    }
  }

  /** Calculates everything we need to do. Very expensive task! */
  public async updatePixels() {
    const result = await this.bot.worker.process({
      colorMetric: this.template.colorMetric,
      dithering: this.template.dithering,
      globalX: this.position.globalX,
      globalY: this.position.globalY,
      sourceName: this.template.id,
      strategy: this.strategy,
      targetHeight: this.height,
      targetWidth: this.width,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      // If free no colors, if 'all' or 'template' all the colors
      extraColorsBitmap:
        this.template.colorPaletteMode === 'unlocked'
          ? this.bot.me.extraColorsBitmap
          : this.template.colorPaletteMode === 'free'
            ? 0
            : 4294967295,
    })
    this.colorsCount = result.colorsCount
    this.colorsLeft = result.colorsLeft
    this.pixels = result.pixels
    this.tasksX = result.x
    this.tasksY = result.y
    this.$canvas.width = this.width
    this.$canvas.height = this.height
    this.context.clearRect(0, 0, this.width, this.height)
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
    this.context.putImageData(new ImageData(rgbPixels, this.width, this.height), 0, 0)
    this.updateUI()
    this.updateColors()
    this.bot.widget.update()
  }

  /** Update image (NOT PIXELS) */
  public updateUI() {
    const { x, y } = this.position.toScreenPosition()
    this.element.style.transform = `translate(${x}px, ${y}px)`
    this.element.style.width = `${this.position.pixelSize * this.width}px`
    this.$wrapper.style.opacity = this.disabled ? '0.4' : '1'
    this.$canvas.style.opacity = `${this.template.opacity}%`
    this.element.classList.remove('hidden')
    this.$resetSizeSpan.textContent = this.width.toString()
    this.$strategy.value = this.strategy
    this.$opacity.valueAsNumber = this.template.opacity
    this.$drawColorsInOrder.checked = this.drawColorsInOrder
    this.$name.value = this.template.name
    const maxTasks = this.getMaxTasks()
    const doneTasks = maxTasks - this.tasksX.length
    const percent = formatPercent(doneTasks / maxTasks)
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent} ETA: ${etaText(this.bot, this.tasksX.length)}`
    this.$progressLine.style.transform = `scaleX(${percent})`
    this.$wrapper.classList.toggle('no-pointer-events', this.lock)
    this.$lock.textContent = this.lock ? '🔒' : '🔓'
  }

  /** Get not disabled pixels count */
  public getMaxTasks() {
    let max = 0
    for (let index = 0; index < 64; index++)
      if (!this.disabledColors.has(index)) max += this.colorsCount[index]
    return max
  }

  /** Removes image */
  public override destroy() {
    super.destroy()
    this.element.remove()
    removeFromArray(this.bot.images, this)
    this.bot.widget.update()
    void this.bot.save.save()
  }

  /** Update colors array */
  public updateColors() {
    const LINE_HEIGHT = 20
    this.$autoBuyColorsLabel.classList.toggle(
      'hidden',
      this.bot.me.extraColorsBitmap === 4294967295,
    )
    this.$colors.innerHTML = ''
    let pixelsSum = 0
    const colorsToBe = new Set<number>()
    for (let index = 0; index < 64; index++) {
      const x = this.colorsCount[index]!
      if (x === 0) continue
      pixelsSum += x
      colorsToBe.add(x)
    }

    // If not the synced with colors then rebuild order
    if (this.colors.length !== colorsToBe.size || this.colors.some((x) => !colorsToBe.has(x))) {
      this.colors.length = 0
      for (let index = 0; index < 64; index++) {
        const x = this.colorsCount[index]!
        if (x === 0) continue
        this.colors.push(x)
      }
      this.colors.sort((a, b) => this.colorsCount[b] - this.colorsCount[a])
      void this.bot.save.save()
    }

    this.$colors.style.height = `${LINE_HEIGHT * this.colors.length}px`

    for (let index = 0; index < this.colors.length; index++) {
      const drawColor = this.colors[index]!
      const count = this.colorsCount[drawColor]
      const left = this.colorsLeft[drawColor]
      const css = (color: number) =>
        color === 0
          ? `repeating-linear-gradient(32deg, #ccc 0 8px, transparent 8px 16px)`
          : colorToCSS(color)
      const $button = document.createElement('button')
      // If dark make text white
      if (COLORS_LAB[drawColor]!.l < 0.6) $button.classList.add('dark')
      $button.title = 'Drag to reorder. Click to disable.'
      $button.style.top = `${index * LINE_HEIGHT}px`
      if (this.disabledColors.has(drawColor)) {
        const $warning = document.createElement('div')
        $warning.innerText = '❌'
        $warning.title = 'Disabled and will be skipped.'
        $button.appendChild($warning)
      }
      $button.style.background = css(drawColor)
      if (!isColorAvailable(this.bot.me.extraColorsBitmap, drawColor)) {
        const $warning = document.createElement('div')
        if (this.autoBuyColors) {
          $warning.innerText = '⌛'
          $warning.title = 'This color be automatically bought.'
        } else {
          $warning.innerText = '⏩'
          $warning.title = 'Unowned colors will be skipped.'
        }
        $button.appendChild($warning)
      }
      const $percent = document.createElement('span')
      $percent.classList.add('percent')
      const donePixels = count - left
      $percent.innerText = `${donePixels}/${count}px ${formatPercent(donePixels / count)} (${formatPercent(count / pixelsSum)})`
      $button.appendChild($percent)
      this.$colors.append($button)

      let dragging = false

      // Dragging
      const startDrag = (startEvent: MouseEvent) => {
        $button.classList.add('dragging')
        let newIndex = index
        const mouseMoveHandler = (event: MouseEvent) => {
          newIndex = Math.min(
            this.colors.length - 1,
            Math.max(0, Math.round(index + (event.clientY - startEvent.clientY) / LINE_HEIGHT)),
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
            $button.classList.remove('dragging')
            document.removeEventListener('mousemove', mouseMoveHandler)
            if (newIndex !== index) this.colors.splice(newIndex, 0, ...this.colors.splice(index, 1))
            void this.bot.save.save()
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
        if (this.disabledColors.has(drawColor)) this.disabledColors.delete(drawColor)
        else this.disabledColors.add(drawColor)
        $button.classList.toggle('color-disabled')
        await this.updatePixels()
        await this.bot.save.save()
      })
    }
  }

  /** Call after updates to position */
  public posToTemplate() {
    this.template.bounds.east = posToLng(this.position.globalX)
    this.template.bounds.north = posToLat(this.position.globalY)
  }

  /** Call after updates to template */
  public posFromTemplate() {
    this.position.globalX = lngToPos(this.template.bounds.east)
    this.position.globalY = latToPos(this.template.bounds.north)
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
      await this.updatePixels()
    }
  }

  /** Resize/move image */
  protected move(event: MouseEvent) {
    if (!this.moveInfo) return
    const deltaX = Math.round((event.clientX - this.moveInfo.clientX) / this.position.pixelSize)
    const deltaY = Math.round((event.clientY - this.moveInfo.clientY) / this.position.pixelSize)
    const resolution = this.template.originalWidth / this.template.originalHeight
    if (this.moveInfo.globalX !== undefined) {
      this.position.globalX = deltaX + this.moveInfo.globalX
      if (this.moveInfo.width !== undefined) {
        this.width = Math.max(1, this.moveInfo.width - deltaX)
        this.height = (this.width / resolution) | 0
      }
    } else if (this.moveInfo.width !== undefined) {
      this.width = Math.max(1, deltaX + this.moveInfo.width)
      this.height = (this.width / resolution) | 0
    }
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY
      if (this.moveInfo.height !== undefined) {
        this.height = Math.max(1, this.moveInfo.height - deltaY)
        this.width = (this.height * resolution) | 0
      }
    } else if (this.moveInfo.height !== undefined) {
      this.height = Math.max(1, deltaY + this.moveInfo.height)
      this.width = (this.height * resolution) | 0
    }
    this.position.updateAnchor()
    this.posToTemplate()
    this.updateUI()
    void this.bot.save.save()
  }

  /** Resize start */
  protected resizeStart(event: MouseEvent) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY,
    }
    const $resize = event.target! as HTMLDivElement
    if ($resize.classList.contains('n')) {
      this.moveInfo.height = this.height
      this.moveInfo.globalY = this.position.globalY
    }
    if ($resize.classList.contains('e')) this.moveInfo.width = this.width
    if ($resize.classList.contains('s')) this.moveInfo.height = this.height
    if ($resize.classList.contains('w')) {
      this.moveInfo.width = this.width
      this.moveInfo.globalX = this.position.globalX
    }
  }

  /** export image as save file */
  protected async exportSaveFile() {
    const a = document.createElement('a')
    document.body.append(a)
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(await this.toJSON())], {
        type: 'application/json',
      }),
    )
    a.download = `${this.template.name}.wbot`
    a.click()
    URL.revokeObjectURL(a.href)
    a.href = this.$canvas.toDataURL('image/png', 1)
    a.download = `${this.template.name}.png`
    a.click()
    URL.revokeObjectURL(a.href)
    a.remove()
  }
}
