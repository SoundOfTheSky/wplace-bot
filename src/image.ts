import { Base } from '@softsky/utils'

import { WPlaceBot } from './bot'
// @ts-ignore
import html from './image.html' with { type: 'text' }
import { Pixels } from './pixels'
import { Position, WorldPosition } from './world-position'

export type DrawTask = Position & {
  buttonId: string
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
    )
  }

  public readonly element = document.createElement('div')
  public readonly canvas
  public readonly context

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

  public constructor(
    protected bot: WPlaceBot,
    public position: WorldPosition,
    public pixels: Pixels,
    public strategy = ImageStrategy.RANDOM,
    public opacity = 50,
    public drawTransparentPixels = false,
  ) {
    super()
    document.body.append(this.element)
    this.element.innerHTML = html as string
    this.element.classList.add('wimage')
    this.canvas = this.element.querySelector('canvas')!
    this.context = this.canvas.getContext('2d')!

    // Strategy
    const $strategy =
      this.element.querySelector<HTMLSelectElement>('.strategy')!
    $strategy.addEventListener('change', () => {
      this.strategy = $strategy.value as ImageStrategy
      this.bot.save()
    })

    // Opacity
    const $opacity = this.element.querySelector<HTMLInputElement>('.opacity')!
    $opacity.addEventListener('input', () => {
      this.opacity = $opacity.valueAsNumber
      this.update()
      this.bot.save()
    })

    // Reset
    this.element
      .querySelector<HTMLButtonElement>('.reset-size')!
      .addEventListener('click', () => {
        this.pixels.width = this.pixels.image.naturalWidth
        this.pixels.update()
        this.update()
        this.bot.save()
      })

    // drawTransparent
    const $drawTransparent =
      this.element.querySelector<HTMLInputElement>('.draw-transparent')!
    $drawTransparent.addEventListener('click', () => {
      this.drawTransparentPixels = $drawTransparent.checked
      this.bot.save()
    })

    // Move
    this.canvas.addEventListener('mousedown', (event) => {
      this.moveInfo = {
        globalX: this.position.globalX,
        globalY: this.position.globalY,
        clientX: event.clientX,
        clientY: event.clientY,
      }
    })
    this.registerEvent(document, 'mouseup', () => {
      this.moveInfo = undefined
    })
    this.registerEvent(document, 'mousemove', (event) => {
      if (this.moveInfo)
        this.move((event as MouseEvent).clientX, (event as MouseEvent).clientY)
    })

    // Resize
    for (const $resize of this.element.querySelectorAll<HTMLDivElement>(
      '.resize',
    )) {
      $resize.addEventListener('mousedown', (event) => {
        this.moveInfo = {
          clientX: event.clientX,
          clientY: event.clientY,
        }
        if ($resize.classList.contains('n')) {
          this.moveInfo.height = this.pixels.height
          this.moveInfo.globalY = this.position.globalY
        }
        if ($resize.classList.contains('e'))
          this.moveInfo.width = this.pixels.width
        if ($resize.classList.contains('s'))
          this.moveInfo.height = this.pixels.height
        if ($resize.classList.contains('w')) {
          this.moveInfo.width = this.pixels.width
          this.moveInfo.globalX = this.position.globalX
        }
      })
    }
    this.update()
    void this.updateTasks()
  }

  public toJSON() {
    return {
      pixels: this.pixels.toJSON(),
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels,
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
        color.buttonId !== mapColor.buttonId &&
        (this.drawTransparentPixels || color.a !== 0)
      ) {
        const { x, y } = position.toScreenPosition()
        this.tasks.push({
          x,
          y,
          buttonId: color.buttonId,
        })
      }
    }
    this.update()
  }

  /** Update canvas */
  public update() {
    const halfPixel = this.bot.pixelSize / 2
    try {
      // Might throw if no anchor. Then we just hide all images
      const { x, y } = this.position.toScreenPosition()
      this.element.style.transform = `translate(${x - halfPixel}px, ${y - halfPixel}px)`
      this.element.classList.remove('hidden')
    } catch {
      this.element.classList.add('hidden')
    }
    this.canvas.width = this.bot.pixelSize * this.pixels.pixels[0]!.length
    this.canvas.height = this.bot.pixelSize * this.pixels.pixels.length
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let y = 0; y < this.pixels.pixels.length; y++) {
      const row = this.pixels.pixels[y]!
      for (let x = 0; x < row.length; x++) {
        const pixel = row[x]!
        this.context.fillStyle = `rgb(${pixel.r} ${pixel.g} ${pixel.b})`
        this.context.globalAlpha = (pixel.a / 255) * (this.opacity / 100)
        this.context.fillRect(
          x * this.bot.pixelSize,
          y * this.bot.pixelSize,
          this.bot.pixelSize,
          this.bot.pixelSize,
        )
      }
    }
    this.element.querySelector<HTMLSpanElement>(
      '.reset-size span',
    )!.textContent = this.pixels.width.toString()
    this.element.querySelector<HTMLSelectElement>('.strategy')!.value =
      this.strategy
    this.element.querySelector<HTMLInputElement>('.opacity')!.valueAsNumber =
      this.opacity
    this.element.querySelector<HTMLInputElement>('.draw-transparent')!.checked =
      this.drawTransparentPixels
    const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0]!.length
    const doneTasks = maxTasks - this.tasks.length
    const percent = ((doneTasks / maxTasks) * 100) | 0
    this.element.querySelector<HTMLSpanElement>('.progress span')!.textContent =
      `${doneTasks}/${maxTasks} ${percent}% ETA: ${(this.tasks.length / 120) | 0}:${((this.tasks.length % 120) / 2) | 0}`
    this.element.querySelector<HTMLDivElement>(
      '.progress div',
    )!.style.transform = `scaleX(${percent}%)`
  }

  /** Removes image. Don't forget to remove from array inside widget. */
  public destroy() {
    super.destroy()
    this.element.remove()
  }

  /** Resize/move image */
  protected move(clientX: number, clientY: number) {
    if (!this.moveInfo) return
    const deltaX = Math.round(
      (clientX - this.moveInfo.clientX) / this.bot.pixelSize,
    )
    const deltaY = Math.round(
      (clientY - this.moveInfo.clientY) / this.bot.pixelSize,
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
    if (this.moveInfo.width !== undefined || this.moveInfo.height !== undefined)
      this.pixels.update()
    this.update()
    this.bot.save()
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
}
