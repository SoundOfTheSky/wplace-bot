export type RGB = { r: number; g: number; b: number }
export type RGBA = { r: number; g: number; b: number; a: number }
export type Lab = { l: number; a: number; b: number }

export const unpackR = (v: number) => (v >> 16) & 0xff
export const unpackG = (v: number) => (v >> 8) & 0xff
export const unpackB = (v: number) => v & 0xff
export const packRGB = (rgb: RGB) => (rgb.r << 16) | (rgb.g << 8) | rgb.b
export const unpackRGB = (packed: number): RGB => ({
  r: (packed >> 16) & 0xff,
  g: (packed >> 8) & 0xff,
  b: packed & 0xff,
})

/** Packed RGB values for each color */
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

export const COLORS_RGB_MAP = new Map<number, number>()
for (let i = 0; i < COLORS_RGB.length; i++) COLORS_RGB_MAP.set(COLORS_RGB[i]!, i)

export const SRGB_TO_LINEAR = new Float64Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  SRGB_TO_LINEAR[i] = c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92
}

export const COLORS_LAB: Lab[] = new Array(64)
COLORS_LAB[0] = { l: 0, a: 0, b: 0 }
for (let i = 1; i < 64; i++) COLORS_LAB[i] = rgbToLab(unpackRGB(COLORS_RGB[i]!))

export function rgbToLab(rgb: RGB): Lab {
  const rl = SRGB_TO_LINEAR[rgb.r]!,
    gl = SRGB_TO_LINEAR[rgb.g]!,
    bl = SRGB_TO_LINEAR[rgb.b]!
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883
  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }
}

export function colorToCSS(colorId: number) {
  if (colorId === 0) return 'transparent'
  const color = COLORS_LAB[colorId]!
  return `oklab(${color.l * 100}% ${color.a} ${color.b})`
}
