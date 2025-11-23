import { promisifyEventSource } from '@softsky/utils'

import { WPlaceBot } from './bot'
import { COLORS, COLORS_RGB, deltaE2000, rgbToOklab } from './colors'

export type PixelColorStat = {
  color: number
  amount: number
  realColor: number
}

export class Pixels {
  public static async fromJSON(
    bot: WPlaceBot,
    data: ReturnType<Pixels['toJSON']>,
  ) {
    const image = new Image()
    image.src = data.url.startsWith('http')
      ? await fetch(data.url, { cache: 'no-store' })
          .then((x) => x.blob())
          .then((X) => URL.createObjectURL(X))
      : data.url
    await promisifyEventSource(image, ['load'], ['error'])
    return new Pixels(bot, image, data.width, data.brightness, data.exactColor)
  }

  public canvas = document.createElement('canvas')

  public context = this.canvas.getContext('2d')!

  /** Pixels of image. Use update() after changing variables */
  public pixels!: number[][]

  /** Used colors */
  public readonly colors = new Map<number, PixelColorStat>()

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
    /** Change brightness of picture */
    public brightness = 0,
    /** Use fast exact color algorithm */
    public exactColor = false,
  ) {
    if (exactColor) {
      this.resolution = 1
      this.width = 1000
    } else this.resolution = this.image.naturalWidth / this.image.naturalHeight
    this.update()
  }

  /** Update pixels of image. Heavy operation! */
  public update() {
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.colors.clear()
    const colorCache = new Map<string, [number, number]>() // cache for already processed colors
    for (let index = 1; index < 64; index++) {
      if (this.exactColor || !this.bot.unavailableColors.has(index))
        colorCache.set(COLORS_RGB[index]!, [index, index])
    }

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
      () => new Array(this.canvas.width) as number[],
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
        // Key for caching
        const key = `${r},${g},${b}`
        if (this.exactColor) {
          this.pixels[y]![x] = a < 100 ? 0 : COLORS_RGB.indexOf(key)
          continue
        }

        // Check cache
        let min!: number
        let minReal!: number
        // Transparent pixel
        if (a < 100) min = minReal = 0
        else if (colorCache.has(key)) [min, minReal] = colorCache.get(key)!
        else {
          // Find closest color
          let minDelta = Infinity
          let minDeltaReal = Infinity
          for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex++) {
            const color = COLORS[colorIndex]!
            const delta = deltaE2000(
              rgbToOklab(r, g, b),
              color,
              this.brightness,
            )
            if (
              !this.bot.unavailableColors.has(colorIndex) &&
              delta < minDelta
            ) {
              minDelta = delta
              min = colorIndex
            }
            if (delta < minDeltaReal) {
              minDeltaReal = delta
              minReal = colorIndex
            }
          }
          colorCache.set(key, [min, minReal])
        }

        // Draw pixel
        if (min !== 0) {
          this.context.fillStyle = `oklab(${COLORS[min]![0] * 100}% ${COLORS[min]![1]} ${COLORS[min]![2]})`
          this.context.fillRect(x, y, 1, 1)
        }

        this.pixels[y]![x] = min

        // Count colors

        const stat = this.colors.get(minReal)
        if (stat) stat.amount++
        else {
          this.colors.set(minReal, {
            color: min,
            amount: 1,
            realColor: minReal,
          })
        }
      }
    }
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
      brightness: this.brightness,
      exactColor: this.exactColor,
    } as {
      url: string
      width?: number
      brightness?: number
      exactColor?: boolean
    }
  }
}
