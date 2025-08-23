import { WPlaceBot } from './bot'
import { NoMarkerError } from './errors'
import { Pixels } from './pixels'
import { Position } from './types'
import { SPACE_EVENT, strategyPositionIterator, wait } from './utilities'
import { WorldPosition } from './world-position'

export type DrawTask = Position & {
  buttonId: string
}

export enum Strategy {
  RANDOM = 'RANDOM',
  DOWN = 'DOWN',
  UP = 'UP',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  SPIRAL_FROM_CENTER = 'SPIRAL_FROM_CENTER',
  SPIRAL_TO_CENTER = 'SPIRAL_TO_CENTER',
}

export class BotImage {
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

  public readonly element = document.createElement('canvas')
  public readonly context = this.element.getContext('2d')!

  /** Pixels left to draw */
  public tasks: DrawTask[] = []

  public constructor(
    public bot: WPlaceBot,
    public position: WorldPosition,
    public pixels: Pixels,
    public strategy = Strategy.RANDOM,
    public opacity = 50,
    public drawTransparentPixels = false,
  ) {
    document.body.append(this.element)
    this.element.classList.add('wbot-overlay')
    this.update()
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
  public updateTasks() {
    return this.bot.widget.runWithStatusAsync('Map reading', async () => {
      if (!this.bot.anchorWorldPosition || !this.bot.anchorScreenPosition)
        throw new NoMarkerError(this.bot)
      this.tasks.length = 0
      const position = this.position.clone()
      for (const { x, y } of strategyPositionIterator(
        this.pixels.pixels.length,
        this.pixels.pixels[0]!.length,
        this.strategy,
      )) {
        const color = this.pixels.pixels[y]![x]!
        position.globalX = this.position.globalX + x
        position.globalY = this.position.globalY + y
        const mapColor = await position.getMapColor()
        if (color.buttonId !== mapColor.buttonId)
          this.tasks.push({
            ...position.toScreenPosition(),
            buttonId: color.buttonId,
          })
      }
    })
  }

  /** Start drawing */
  public async draw() {
    this.bot.widget.status = ''
    const prevent = (event: MouseEvent) => {
      if (!event.shiftKey) event.stopPropagation()
    }
    globalThis.addEventListener('mousemove', prevent, true)
    return this.bot.widget.runWithStatusAsync(
      'Drawing',
      async () => {
        this.bot.widget.setDisabled('draw', true)
        await this.bot.updateColors()
        await this.updateTasks()
        let index = 0
        for (
          ;
          index < this.tasks.length && !document.querySelector('ol');
          index++
        ) {
          const task = this.tasks[index]!
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
        this.tasks.splice(0, index)
        this.bot.widget.updateText()
        this.bot.save()
      },
      () => {
        globalThis.removeEventListener('mousemove', prevent, true)
        this.bot.widget.setDisabled('draw', false)
      },
    )
  }

  /** Update canvas */
  public update() {
    if (this.bot.pixelSize === 0 || !this.bot.anchorScreenPosition) return
    this.element.style.transform = `translate(${this.bot.anchorScreenPosition.x}px, ${this.bot.anchorScreenPosition.y}px)`
    this.element.width = this.bot.pixelSize * this.pixels.pixels[0]!.length
    this.element.height = this.bot.pixelSize * this.pixels.pixels.length
    this.context.clearRect(0, 0, this.element.width, this.element.height)
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
  }
}
