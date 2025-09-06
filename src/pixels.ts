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

  /** Pixels of image. Use update() after changing variables */
  public pixels!: Color[][]

  /** Colors that are recommended to buy with amount of pixels affected. Sorted. */
  public readonly colorsToBuy: [Color, number][] = []

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
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    const colorsToBuy = new Map<Color, number>()
    canvas.width = this.width
    canvas.height = this.height
    context.drawImage(this.image, 0, 0, canvas.width, canvas.height)
    this.pixels = Array.from(
      { length: canvas.height },
      () => new Array(canvas.width) as Color[],
    )
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4
        const r = data[index]!
        const g = data[index + 1]!
        const b = data[index + 2]!
        const a = data[index + 3]!
        // Find best Wplace color
        if (a < 100) {
          this.pixels[y]![x] = this.bot.colors.at(-1)!
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
        this.pixels[y]![x] = min!
        if (minReal!.buttonId !== min!.buttonId)
          colorsToBuy.set(minReal!, (colorsToBuy.get(minReal!) ?? 0) + 1)
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
