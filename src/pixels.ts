import { promisifyEventSource } from '@softsky/utils'

import { WPlaceBot } from './bot'
import { NoImageError } from './errors'

export type Color = {
  r: number
  g: number
  b: number
  a: number
  available: boolean
  buttonId: string
}

export class Pixels {
  /** Open select image dialog and create */
  public static async fromSelectImage(bot: WPlaceBot, width?: number) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.click()
    await promisifyEventSource(input, ['change'], ['cancel', 'error'])
    const file = input.files?.[0]
    if (!file) throw new NoImageError(bot)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    await promisifyEventSource(reader, ['load'], ['error'])
    const image = new Image()
    image.src = reader.result as string
    await promisifyEventSource(image, ['load'], ['error'])
    return new Pixels(bot, image, width)
  }

  public static async fromJSON(
    bot: WPlaceBot,
    data: ReturnType<Pixels['toJSON']>,
  ) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = data.url
    await promisifyEventSource(image, ['load'], ['error'])
    return new Pixels(bot, image, data.width)
  }

  public canvas = document.createElement('canvas')

  public context = this.canvas.getContext('2d')!

  /** Pixels of image. Use update() after changing variables */
  public pixels!: string[][]

  /** Colors that are recommended to buy with amount of pixels affected. Sorted. */
  public readonly colorsToBuy: [string, number][] = []

  public readonly resolution: number

  public get height() {
    return (this.width / this.resolution) | 0
  }
  public set height(value: number) {
    this.width = (value * this.resolution) | 0
  }

  public constructor(
    public bot: WPlaceBot,
    /** Image element */
    public image: HTMLImageElement,
    /** Change scale of image pixels */
    public width = image.naturalWidth,
  ) {
    this.resolution = this.image.naturalWidth / this.image.naturalHeight
    this.update()
  }

  /** Update pixels of image. Heavy operation! */
  public update() {
    this.canvas.width = this.width
    this.canvas.height = this.height
    const colorsToBuy = new Map<string, number>()
    this.context.imageSmoothingEnabled = false
    this.context.imageSmoothingQuality = 'low'
    this.context.drawImage(
      this.image,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    )
    this.pixels = Array.from(
      { length: this.canvas.height },
      () => new Array(this.canvas.width) as string[],
    )
    const data = this.context.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    ).data
    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        const index = (y * this.canvas.width + x) * 4
        const r = data[index]!
        const g = data[index + 1]!
        const b = data[index + 2]!
        const a = data[index + 3]!
        // Find best Wplace color
        if (a < 100) {
          this.pixels[y]![x] = this.bot.colors.at(-1)!.buttonId
          continue
        }
        let minDelta = Infinity
        let min: Color | undefined
        let minDeltaReal = Infinity
        let minReal: Color | undefined
        for (let index = 0; index < this.bot.colors.length; index++) {
          const color = this.bot.colors[index]!
          const delta =
            (color.r - r) ** 2 + (color.g - g) ** 2 + (color.b - b) ** 2
          if (color.available && delta < minDelta) {
            minDelta = delta
            min = color
          }
          if (delta < minDeltaReal) {
            minDeltaReal = delta
            minReal = color
          }
        }
        this.pixels[y]![x] = min!.buttonId
        if (minReal!.buttonId !== min!.buttonId)
          colorsToBuy.set(
            minReal!.buttonId,
            (colorsToBuy.get(minReal!.buttonId) ?? 0) + 1,
          )
      }
    }
    this.colorsToBuy.splice(
      0,
      Infinity,
      ...[...colorsToBuy.entries()].sort(([, a], [, b]) => b - a),
    )
  }

  public toJSON() {
    const canvas = document.createElement('canvas')
    canvas.width = this.image.naturalWidth
    canvas.height = this.image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(this.image, 0, 0)
    return {
      url: canvas.toDataURL('image/webp', 1),
      width: this.width,
    } as { url: string; width?: number }
  }
}
