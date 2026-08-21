function srgbNonlinearTransformInv(c: number) {
  return c > 0.040_45 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92
}

/**
 * CIELAB (D65). Constants are wplace's own, down to the rounding: matching
 * their pick on borderline colors matters more here than precision.
 */
export function rgbToLab(r: number, g: number, b: number) {
  const lr = srgbNonlinearTransformInv(r / 255)
  const lg = srgbNonlinearTransformInv(g / 255)
  const lb = srgbNonlinearTransformInv(b / 255)

  const f = (t: number) => (t > 0.008_856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f((lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.950_47)
  const fy = f(lr * 0.2126 + lg * 0.7152 + lb * 0.0722)
  const fz = f((lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.088_83)

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)] as [
    number,
    number,
    number,
  ]
}

/**
 * CIEDE2000 color difference.
 * `brightness` is ours, not part of the standard: it biases the result towards
 * lighter or darker palette colors. Scaled by L*'s range so the numbers users
 * already have in their saves keep meaning the same thing.
 */
export function deltaE2000(
  lab1: [number, number, number],
  lab2: [number, number, number],
  brightness: number,
): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  const rad2deg = (rad: number) => (rad * 180) / Math.PI
  const deg2rad = (deg: number) => (deg * Math.PI) / 180
  /** atan2 gives (-180, 180], hue angles are [0, 360) */
  const hue = (y: number, x: number) =>
    y === 0 && x === 0 ? 0 : (rad2deg(Math.atan2(y, x)) + 360) % 360

  const kL = 1
  const kC = 1
  const kH = 1

  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2)
  const C2 = Math.sqrt(a2 ** 2 + b2 ** 2)
  const avgC = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)))

  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)
  const C1p = Math.sqrt(a1p ** 2 + b1 ** 2)
  const C2p = Math.sqrt(a2p ** 2 + b2 ** 2)
  const h1p = hue(b1, a1p)
  const h2p = hue(b2, a2p)

  const Lp = L2 - L1
  const Cp = C2p - C1p

  let hp = 0
  if (C1p * C2p !== 0) {
    hp = h2p - h1p
    if (hp > 180) hp -= 360
    else if (hp < -180) hp += 360
  }
  const Hp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(hp) / 2)

  const avgLp = (L1 + L2) / 2
  const avgCp = (C1p + C2p) / 2

  let avghp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) avghp += avghp < 360 ? 360 : -360
    avghp /= 2
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

  const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7))
  const RT =
    -RC * Math.sin(deg2rad(60 * Math.exp(-(((avghp - 275) / 25) ** 2))))

  const dL = Lp / (kL * SL)
  const dC = Cp / (kC * SC)
  const dH = Hp / (kH * SH)

  return (
    Math.sqrt(Math.max(0, dL ** 2 + dC ** 2 + dH ** 2 + RT * dC * dH)) -
    (Lp / 100) * brightness
  )
}

/**
 * CIE94, graphic arts weights. This is what wplace calls the "lab" metric and
 * uses by default, so it is our default too.
 */
export function deltaE94(
  lab1: [number, number, number],
  lab2: [number, number, number],
  brightness: number,
): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const dL = L2 - L1
  const da = a2 - a1
  const db = b2 - b1
  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2)
  const dC = Math.sqrt(a2 ** 2 + b2 ** 2) - C1
  // Hue difference, via the identity dH^2 = da^2 + db^2 - dC^2
  const dH = Math.sqrt(Math.max(0, da ** 2 + db ** 2 - dC ** 2))
  return (
    Math.sqrt(
      dL ** 2 + (dC / (1 + 0.045 * C1)) ** 2 + (dH / (1 + 0.015 * C1)) ** 2,
    ) -
    (dL / 100) * brightness
  )
}

/**
 * Compuphase, a weighted RGB distance. Takes packed rgb triples, not lab.
 * https://www.compuphase.com/cmetric.htm
 */
export function deltaCompuphase(
  rgb1: [number, number, number],
  rgb2: [number, number, number],
  brightness: number,
): number {
  const [r1, g1, b1] = rgb1
  const [r2, g2, b2] = rgb2
  const avgR = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return (
    Math.sqrt(
      (2 + avgR / 256) * dr ** 2 +
        4 * dg ** 2 +
        (2 + (255 - avgR) / 256) * db ** 2,
    ) -
    ((0.299 * (r2 - r1) + 0.587 * (g2 - g1) + 0.114 * (b2 - b1)) / 255) *
      brightness
  )
}

/** Metrics wplace offers, by its own names */
export type ColorMetric = 'lab' | 'ciede2000' | 'compuphase'

export function metricFunction(metric: ColorMetric) {
  switch (metric) {
    case 'ciede2000':
      return deltaE2000
    case 'compuphase':
      return deltaCompuphase
    case 'lab':
      return deltaE94
  }
}

export const COLORS_RGB = [
  NaN,
  0,
  3947580,
  7895160,
  13816530,
  16777215,
  6291480,
  15539236,
  16744231,
  16165385,
  16375099,
  16775868,
  964968,
  1304187,
  8912734,
  819566,
  1093286,
  1302974,
  2642078,
  4232164,
  6354930,
  7033078,
  10072571,
  7867545,
  11155641,
  14721017,
  13303930,
  15474560,
  15961513,
  6833716,
  9791530,
  16298615,
  11184810,
  10817054,
  16416882,
  14965786,
  14071188,
  10257457,
  12954929,
  15258719,
  4877114,
  5936202,
  8701299,
  1014175,
  12319474,
  8243199,
  5059000,
  4866692,
  8024516,
  11906801,
  14394467,
  13729873,
  16762277,
  10179145,
  13729912,
  16430756,
  8086354,
  10257515,
  3356993,
  7173517,
  11778513,
  7169087,
  9735275,
  13485470,
]

/** Palette as rgb triples, for metrics that work in rgb */
export const COLORS_RGB_TRIPLES = COLORS_RGB.map(
  (rgb) =>
    [rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff] as [number, number, number],
)

/** Palette in CIELAB. Index 0 is transparent, hence the NaNs */
export const COLORS = COLORS_RGB.map((rgb, index) =>
  index === 0
    ? ([Number.NaN, Number.NaN, Number.NaN] as [number, number, number])
    : rgbToLab(rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff),
)

export const COLORS_RGB_MAP = new Map<number, number>()
for (let index = 0; index < COLORS_RGB.length; index++)
  COLORS_RGB_MAP.set(COLORS_RGB[index]!, index)

export function colorToCSS(colorId: number) {
  if (colorId === 0) return 'transparent'
  const color = COLORS[colorId]!
  return `oklab(${color[0] * 100}% ${color[1]} ${color[2]})`
}
