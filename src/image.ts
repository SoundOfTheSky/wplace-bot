import { removeFromArray } from '@softsky/utils'

import { Base } from './base'
import { WPlaceBot } from './bot'
import { COLORS, colorToCSS } from './colors'
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
import { Pixels } from './pixels'
import { save } from './save'
import { Position, WorldPosition } from './world-position'

export type DrawTask = {
  position: WorldPosition
  color: number
}

export type ImageColorSetting = {
  color: number
  disabled?: boolean
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
    data: ReturnType<BotImage['toJSON']>,
  ) {
    return new BotImage(
      bot,
      WorldPosition.fromJSON(bot, data.position),
      await Pixels.fromJSON(bot, data.pixels),
      data.strategy,
      data.opacity,
      data.drawTransparentPixels,
      data.drawColorsInOrder,
      data.colors,
      data.lock,
      data.name,
      data.unownedColorStrategy,
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

  protected readonly $brightness!: HTMLInputElement
  protected readonly $canvas!: HTMLCanvasElement
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
    public position: WorldPosition,
    /** Parsed imageto draw */
    public pixels: Pixels,
    /** Order of pixels to draw */
    public strategy = ImageStrategy.SPIRAL_TO_CENTER,
    /** Opacity of overlay */
    public opacity = 50,
    /** Should we erase pixels there transparency should be */
    public drawTransparentPixels = false,
    /** Should bot draw colors in order */
    public drawColorsInOrder = false,
    /** Colors settings */
    public colors: { realColor: number; disabled?: boolean }[] = [],
    /** Stop accidental image edit */
    public lock = false,
    /** Name of image */
    public name = `${pixels.width}x${pixels.height}`,
    /** What to do with colors that user does not own */
    public unownedColorStrategy = UnownedColorStrategy.BUY,
  ) {
    super()
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
    })
    this.$unownedColorStrategy =
      this.$unownedColorStrategyLabel.querySelector<HTMLSelectElement>(
        'select',
      )!
    this.$resetSizeSpan =
      this.$resetSize.querySelector<HTMLSpanElement>('span')!
    this.$canvas = this.pixels.canvas
    this.$wrapper.prepend(this.pixels.canvas)

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
      save(this.bot)
    })

    // Strategy
    this.$strategy.addEventListener('change', () => {
      this.strategy = this.$strategy.value as ImageStrategy
      save(this.bot)
    })

    // Opacity
    this.$opacity.addEventListener('input', () => {
      this.opacity = this.$opacity.valueAsNumber
      this.$opacity.style.setProperty('--val', this.opacity + '%')
      this.update()
      save(this.bot)
    })
    this.$opacity.style.setProperty('--val', this.opacity + '%')

    let timeout: ReturnType<typeof setTimeout> | undefined

    this.$brightness.addEventListener('change', () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        this.pixels.brightness = this.$brightness.valueAsNumber
        this.pixels.update()
        this.updateColors()
        this.update()
        save(this.bot)
      }, 1000)
    })

    // Reset
    this.$resetSize.addEventListener('click', () => {
      this.pixels.width = this.pixels.image.naturalWidth
      this.pixels.update()
      this.updateColors()
      this.update()
      save(this.bot)
    })

    // drawTransparent
    this.$drawTransparent.addEventListener('click', () => {
      this.drawTransparentPixels = this.$drawTransparent.checked
      save(this.bot)
    })

    // drawColorsInOrder
    this.$drawColorsInOrder.addEventListener('click', () => {
      this.drawColorsInOrder = this.$drawColorsInOrder.checked
      this.updateColors()
      save(this.bot)
    })

    // Lock
    this.$lock.addEventListener('click', () => {
      this.lock = !this.lock
      this.update()
      save(this.bot)
    })

    this.$delete.addEventListener('click', this.destroy.bind(this))

    // Export
    this.$export.addEventListener('click', this.export.bind(this))

    // Name
    this.$name.addEventListener('change', () => {
      this.name = this.$name.value
      this.update()
      this.bot.widget.update()
      save(this.bot)
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
    this.update()
    this.updateColors()
  }

  public toJSON() {
    return {
      pixels: this.pixels.toJSON(),
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      lock: this.lock,
      name: this.name,
      unownedColorStrategy: this.unownedColorStrategy,
    }
  }

  /** Calculates everything we need to do. Very expensive task! */
  public updateTasks() {
    this.tasks.length = 0
    const position = this.position.clone()
    const skipColors = new Set<number>()
    const colorsOrderMap = new Map<number, number>()
    for (let index = 0; index < this.colors.length; index++) {
      const drawColor = this.colors[index]
      if (
        drawColor.disabled ||
        this.bot.unavailableColors.has(drawColor.realColor)
      )
        skipColors.add(drawColor.realColor)
      colorsOrderMap.set(drawColor.realColor, index)
    }
    const isSubstitute =
      this.unownedColorStrategy === UnownedColorStrategy.SUBSTITUTE
    for (const { x, y } of this.strategyPositionIterator()) {
      const color = isSubstitute
        ? this.pixels.pixelsSubstitute[y][x]
        : this.pixels.pixels[y][x]
      if (skipColors.has(color)) continue
      position.globalX = this.position.globalX + x
      position.globalY = this.position.globalY + y
      const mapColor = position.getMapColor()
      if (color !== mapColor && (this.drawTransparentPixels || color !== 0))
        this.tasks.push({
          position: position.clone(),
          color,
        })
    }
    if (this.drawColorsInOrder)
      this.tasks.sort(
        (a, b) =>
          (colorsOrderMap.get(a.color) ?? 0) -
          (colorsOrderMap.get(b.color) ?? 0),
      )
    this.update()
    this.bot.widget.update()
  }

  /** Update image (NOT PIXELS) */
  public update() {
    const { x, y } = this.position.toScreenPosition()
    this.element.style.transform = `translate(${x}px, ${y}px)`
    this.element.style.width = `${this.position.pixelSize * this.pixels.width}px`
    this.$canvas.style.opacity = `${this.opacity}%`
    removeClass(this.element, 'hidden')

    this.$resetSizeSpan.textContent = this.pixels.width.toString()
    this.$brightness.valueAsNumber = this.pixels.brightness
    this.$strategy.value = this.strategy
    this.$opacity.valueAsNumber = this.opacity
    this.$drawTransparent.checked = this.drawTransparentPixels
    this.$drawColorsInOrder.checked = this.drawColorsInOrder
    this.$name.value = this.name
    const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0].length
    const doneTasks = maxTasks - this.tasks.length
    const percent = ((doneTasks / maxTasks) * 100) | 0
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${(this.tasks.length / 120) | 0}h`
    this.$progressLine.style.transform = `scaleX(${percent}%)`
    if (this.lock) addClass(this.$wrapper, 'no-pointer-events')
    else removeClass(this.$wrapper, 'no-pointer-events')
    this.$lock.textContent = this.lock ? '🔒' : '🔓'
  }

  /** Removes image */
  public destroy() {
    super.destroy()
    this.element.remove()
    removeFromArray(this.bot.images, this)
    this.bot.widget.update()
    save(this.bot)
  }

  /** Update colors array */
  public updateColors() {
    const LINE_HEIGHT = 20
    if (this.bot.unavailableColors.size === 0)
      addClass(this.$unownedColorStrategyLabel, 'hidden')
    this.$colors.innerHTML = ''
    const pixelsSum = this.pixels.pixels.length * this.pixels.pixels[0].length

    // If not the synced with colors then rebuild order
    if (
      this.colors.length !== this.pixels.colors.size ||
      this.colors.some((x) => !this.pixels.colors.has(x.realColor))
    ) {
      this.colors = this.pixels.colors
        .values()
        .toArray()
        .sort((a, b) => b.amount - a.amount)
        .map((color) => ({
          realColor: color.realColor,
          disabled: false,
        }))
      save(this.bot)
    }

    this.$colors.style.height = `${LINE_HEIGHT * this.colors.length}px`

    for (let index = 0; index < this.colors.length; index++) {
      const drawColor = this.colors[index]
      if (!this.drawTransparentPixels && drawColor.realColor === 0) continue
      const css = (color: number) =>
        color === 0
          ? `repeating-linear-gradient(32deg, #ccc 0 8px, transparent 8px 16px)`
          : colorToCSS(color)
      const color = this.pixels.colors.get(drawColor.realColor)!
      const $button = document.createElement('button')
      // If dark make text white
      if (COLORS[drawColor.realColor][0] < 0.6) addClass($button, 'dark')
      $button.title = 'Drag to reorder. Click to disable.'
      $button.style.top = `${index * LINE_HEIGHT}px`
      if (drawColor.disabled) {
        const $warning = document.createElement('div')
        $warning.innerText = '❌'
        $warning.title = 'Disabled and will be skipped.'
        $button.appendChild($warning)
      }
      switch (this.unownedColorStrategy) {
        case UnownedColorStrategy.SUBSTITUTE:
          $button.style.background = css(color.color)
          if (color.color !== color.realColor) {
            const $warning = document.createElement('button')
            $warning.style.backgroundColor = css(color.realColor)
            $warning.title = 'This is the best color. Click to buy.'
            $warning.addEventListener('click', async () => {
              await this.bot.updateColors()
              document.getElementById('color-' + color.realColor)?.click()
            })
            $button.appendChild($warning)
          }
          break
        case UnownedColorStrategy.BUY:
          $button.style.background = css(color.realColor)
          if (this.bot.unavailableColors.has(color.realColor)) {
            const $warning = document.createElement('div')
            $warning.innerText = '⌛'
            $warning.title = 'This color be automatically bought.'
            $button.appendChild($warning)
          }
          break
        case UnownedColorStrategy.SKIP:
          $button.style.background = css(color.realColor)
          if (this.bot.unavailableColors.has(color.realColor)) {
            const $warning = document.createElement('div')
            $warning.innerText = '⏩'
            $warning.title = 'Unowned colors will be skipped.'
            $button.appendChild($warning)
          }
          break
      }
      const $percent = document.createElement('span')
      addClass($percent, 'percent')
      $percent.innerText = `${color.amount}px ${((color.amount / pixelsSum) * 100) | 0}%`
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
          console.log(newIndex)
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
            save(this.bot)
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
      $button.addEventListener('click', (event) => {
        event.stopPropagation()
        if (dragging) return
        drawColor.disabled = drawColor.disabled ? undefined : true
        toggleClass($button, 'color-disabled')
        save(this.bot)
      })
    }
  }

  /** Create iterator that generates positions based on strategy */
  protected *strategyPositionIterator(): Generator<Position> {
    const height = this.pixels.pixels.length
    const width = this.pixels.pixels[0].length
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
          const temporary = positions[index]
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
                x += directories[directionIndex][0]
                y += directories[directionIndex][1]
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
            yield collected[index]
        }
        break
      }
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
  protected moveStop() {
    if (this.moveInfo) {
      this.moveInfo = undefined
      this.position.updateAnchor()
      this.pixels.update()
      this.updateColors()
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
        this.pixels.width = Math.max(1, this.moveInfo.width - deltaX)
    } else if (this.moveInfo.width !== undefined)
      this.pixels.width = Math.max(1, deltaX + this.moveInfo.width)
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY
      if (this.moveInfo.height !== undefined)
        this.pixels.height = Math.max(1, this.moveInfo.height - deltaY)
    } else if (this.moveInfo.height !== undefined)
      this.pixels.height = Math.max(1, deltaY + this.moveInfo.height)
    this.update()
    save(this.bot)
  }

  /** Resize start */
  protected resizeStart(event: MouseEvent) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY,
    }
    const $resize = event.target! as HTMLDivElement
    if (containsClass($resize, 'n')) {
      this.moveInfo.height = this.pixels.height
      this.moveInfo.globalY = this.position.globalY
    }
    if (containsClass($resize, 'e')) this.moveInfo.width = this.pixels.width
    if (containsClass($resize, 's')) this.moveInfo.height = this.pixels.height
    if (containsClass($resize, 'w')) {
      this.moveInfo.width = this.pixels.width
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
    a.href = this.pixels.canvas.toDataURL('image/webp', 1)
    a.download = `${this.name}.webp`
    a.click()
    URL.revokeObjectURL(a.href)
    a.remove()
  }
}
