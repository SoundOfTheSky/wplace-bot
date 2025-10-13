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

export function deltaE2000(
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

export const COLORS = [
  [Number.NaN, Number.NaN, Number.NaN],
  [0, 0, 0],
  [0.356, 0, 0],
  [0.573, 0, 0],
  [0.864, 0, 0],
  [1, 0, 0],
  [0.31, 0.119, 0.037],
  [0.603, 0.209, 0.107],
  [0.732, 0.118, 0.137],
  [0.791, 0.039, 0.16],
  [0.895, -0.026, 0.168],
  [0.974, -0.019, 0.077],
  [0.691, -0.154, 0.075],
  [0.812, -0.185, 0.096],
  [0.898, -0.17, 0.149],
  [0.541, -0.097, 0.005],
  [0.678, -0.114, -0.018],
  [0.814, -0.15, 0.011],
  [0.447, -0.019, -0.134],
  [0.65, -0.048, -0.137],
  [0.895, -0.124, -0.027],
  [0.561, 0.054, -0.229],
  [0.771, 0, -0.11],
  [0.431, 0.145, -0.143],
  [0.557, 0.168, -0.127],
  [0.796, 0.102, -0.097],
  [0.551, 0.225, -0.023],
  [0.62, 0.238, 0],
  [0.759, 0.127, 0.006],
  [0.428, 0.036, 0.041],
  [0.552, 0.03, 0.092],
  [0.817, 0.055, 0.097],
  [0.738, 0, 0],
  [0.46, 0.163, 0.074],
  [0.735, 0.134, 0.071],
  [0.642, 0.137, 0.122],
  [0.794, 0.023, 0.054],
  [0.62, -0.005, 0.105],
  [0.747, -0.019, 0.138],
  [0.864, -0.023, 0.136],
  [0.489, -0.06, 0.058],
  [0.609, -0.092, 0.08],
  [0.76, -0.099, 0.085],
  [0.54, -0.067, -0.079],
  [0.941, -0.064, -0.007],
  [0.803, -0.05, -0.096],
  [0.438, 0.048, -0.192],
  [0.421, 0.03, -0.102],
  [0.593, 0.036, -0.119],
  [0.781, 0.031, -0.09],
  [0.757, 0.036, 0.098],
  [0.676, 0.076, 0.09],
  [0.868, 0.051, 0.061],
  [0.524, 0.087, 0.047],
  [0.684, 0.091, 0.045],
  [0.835, 0.068, 0.048],
  [0.519, 0.022, 0.034],
  [0.629, 0.017, 0.043],
  [0.342, -0.004, -0.016],
  [0.564, 0, -0.038],
  [0.789, 0.003, -0.035],
  [0.502, -0.006, 0.055],
  [0.638, -0.005, 0.047],
  [0.82, -0.007, 0.053],
] as [number, number, number][]

export const COLORS_RGB = [
  'NaN',
  '0,0,0',
  '60,60,60',
  '120,120,120',
  '210,210,210',
  '255,255,255',
  '96,0,24',
  '237,28,36',
  '255,127,39',
  '246,170,9',
  '249,221,59',
  '255,250,188',
  '14,185,104',
  '19,230,123',
  '135,255,94',
  '12,129,110',
  '16,174,166',
  '19,225,190',
  '40,80,158',
  '64,147,228',
  '96,247,242',
  '107,80,246',
  '153,177,251',
  '120,12,153',
  '170,56,185',
  '224,159,249',
  '203,0,122',
  '236,31,128',
  '243,141,169',
  '104,70,52',
  '149,104,42',
  '248,178,119',
  '170,170,170',
  '165,14,30',
  '250,128,114',
  '228,92,26',
  '214,181,148',
  '156,132,49',
  '197,173,49',
  '232,212,95',
  '74,107,58',
  '90,148,74',
  '132,197,115',
  '15,121,159',
  '187,250,242',
  '125,199,255',
  '77,49,184',
  '74,66,132',
  '122,113,196',
  '181,174,241',
  '219,164,99',
  '209,128,81',
  '255,197,165',
  '155,82,73',
  '209,128,120',
  '250,182,164',
  '123,99,82',
  '156,132,107',
  '51,57,65',
  '109,117,141',
  '179,185,209',
  '109,100,63',
  '148,140,107',
  '205,197,158',
] as string[]
export function colorToCSS(colorId: number) {
  if (colorId === 0) return 'transparent'
  const color = COLORS[colorId]!
  return `oklab(${color[0] * 100}% ${color[1]} ${color[2]})`
}
