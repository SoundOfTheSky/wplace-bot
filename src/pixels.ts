import { promisifyEventSource } from '@softsky/utils'

import { WPlaceBot } from './bot'

export type Color = {
  color: [number, number, number]
  available: boolean
  buttonId: string
}

function srgbNonlinearTransformInv(c: number) {
  return c > 0.040_45 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92
}

export function rgbToOklab(r: number, g: number, b: number) {
  const lr = srgbNonlinearTransformInv(r / 255)
  const lg = srgbNonlinearTransformInv(g / 255)
  const lb = srgbNonlinearTransformInv(b / 255)

  const lp = Math.cbrt(
    0.412_221_470_8 * lr + 0.536_332_536_3 * lg + 0.051_445_992_9 * lb,
  )
  const mp = Math.cbrt(
    0.211_903_498_2 * lr + 0.680_699_545_1 * lg + 0.107_396_956_6 * lb,
  )
  const sp = Math.cbrt(
    0.088_302_461_9 * lr + 0.281_718_837_6 * lg + 0.629_978_700_5 * lb,
  )

  const l = 0.210_454_255_3 * lp + 0.793_617_785 * mp - 0.004_072_046_8 * sp
  const aa = 1.977_998_495_1 * lp - 2.428_592_205 * mp + 0.450_593_709_9 * sp
  const bb = 0.025_904_037_1 * lp + 0.782_771_766_2 * mp - 0.808_675_766 * sp

  return [l, aa, bb] as [number, number, number]
}

function deltaE2000(
  lab1: [number, number, number],
  lab2: [number, number, number],
  brightness: number,
): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  // Helper functions
  const rad2deg = (rad: number) => (rad * 180) / Math.PI
  const deg2rad = (deg: number) => (deg * Math.PI) / 180

  // Weighting factors
  const kL = 1,
    kC = 1,
    kH = 1

  // Step 1: Calculate CIELAB values
  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2)
  const C2 = Math.sqrt(a2 ** 2 + b2 ** 2)
  const avgC = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)))

  // Step 2: Calculate a', C', h'
  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)
  const C1p = Math.sqrt(a1p ** 2 + b1 ** 2)
  const C2p = Math.sqrt(a2p ** 2 + b2 ** 2)

  const h1p = b1 === 0 && a1p === 0 ? 0 : rad2deg(Math.atan2(b1, a1p)) % 360
  const h2p = b2 === 0 && a2p === 0 ? 0 : rad2deg(Math.atan2(b2, a2p)) % 360

  // Step 3: Calculate ΔL', ΔC', ΔH'
  const Lp = L2 - L1
  const Cp = C2p - C1p
  let hp = 0

  if (C1p * C2p !== 0) {
    hp = h2p - h1p
    if (hp > 180) {
      hp -= 360
    } else if (hp < -180) {
      hp += 360
    }
  }

  const Hp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(hp) / 2)

  // Step 4: Calculate weighting functions
  const avgLp = (L1 + L2) / 2
  const avgCp = (C1p + C2p) / 2

  let avghp = (h1p + h2p) / 2
  if (Math.abs(h1p - h2p) > 180) {
    avghp += 180
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(avghp - 30)) +
    0.24 * Math.cos(deg2rad(2 * avghp)) +
    0.32 * Math.cos(deg2rad(3 * avghp + 6)) -
    0.2 * Math.cos(deg2rad(4 * avghp - 63))

  const SL = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2)
  const SC = 1 + 0.045 * avgCp
  const SH = 1 + 0.015 * avgCp * T

  // Step 5: Calculate rotation term
  const θ = 30 * Math.exp((-((avghp - 275) / 25)) ** 2)
  const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7))
  const RT = -RC * Math.sin(deg2rad(2 * θ))

  // Final calculation
  return (
    Math.sqrt(
      (Lp / (kL * SL)) ** 2 +
        (Cp / (kC * SC)) ** 2 +
        (Hp / (kH * SH)) ** 2 +
        RT * (Cp / (kC * SC)) * (Hp / (kH * SH)),
    ) -
    Lp * brightness
  )
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
  public pixels!: string[][]

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
    /** Change brightness of picture */
    public brightness = 0,
    /** Use fast exact color algorithm */
    public exactColor = false,
  ) {
    this.resolution = this.image.naturalWidth / this.image.naturalHeight
    this.update()
  }

  /** Update pixels of image. Heavy operation! */
  public update() {
    this.canvas.width = this.width
    this.canvas.height = this.height
    const colorsToBuy = new Map<Color, number>()
    const colorCache = new Map<string, [Color, Color]>() // cache for already processed colors

    for (let index = 0; index < this.bot.colors.length; index++) {
      const color = this.bot.colors[index]!
      colorCache.set(
        `${color.color[0].toFixed(4)},${color.color[1].toFixed(4)},${color.color[2].toFixed(4)}`,
        [color, color],
      )
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

        // Transparent pixel
        if (data[index + 3]! < 100) {
          this.pixels[y]![x] = 'color-0'
          continue
        }

        const originalColor = rgbToOklab(
          ...(data.slice(index, index + 3) as unknown as [
            number,
            number,
            number,
          ]),
        )

        // Key for caching
        const key = `${originalColor[0].toFixed(4)},${originalColor[1].toFixed(4)},${originalColor[2].toFixed(4)}`

        // Check cache
        let min!: Color
        let minReal!: Color
        if (colorCache.has(key)) [min, minReal] = colorCache.get(key)!
        else {
          let minDelta = Infinity
          let minDeltaReal = Infinity
          for (
            let colorIndex = 0;
            colorIndex < this.bot.colors.length;
            colorIndex++
          ) {
            const color = this.bot.colors[colorIndex]!
            const delta = deltaE2000(
              originalColor,
              color.color,
              this.brightness,
            )
            if (color.available && delta < minDelta) {
              minDelta = delta
              min = color
            }
            if (delta < minDeltaReal) {
              minDeltaReal = delta
              minReal = color
            }
          }
          colorCache.set(key, [min, minReal])
        }

        // Draw pixel
        this.context.fillStyle = `oklab(${min.color[0] * 100}% ${min.color[1]} ${min.color[2]})`
        this.context.fillRect(x, y, 1, 1)

        this.pixels[y]![x] = min.buttonId

        // Count colors to buy
        if (minReal.buttonId !== min.buttonId)
          colorsToBuy.set(minReal, (colorsToBuy.get(minReal) ?? 0) + 1)
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
