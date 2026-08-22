const palette = { colors: [{ rgb: [0, 0, 0] }] } as const
// ---------------------------------------------------------------------------
// Tailwind class helpers (cycle through a 14-color rainbow by index)
// ---------------------------------------------------------------------------

const TEXT_COLORS = [
  'text-red-500',
  'text-orange-500',
  'text-yellow-500',
  'text-lime-500',
  'text-emerald-500',
  'text-teal-500',
  'text-cyan-500',
  'text-sky-500',
  'text-indigo-500',
  'text-violet-500',
  'text-purple-500',
  'text-fuchsia-500',
  'text-pink-500',
  'text-rose-500',
]

const BG_COLORS = [
  'bg-red-500/10',
  'bg-orange-500/10',
  'bg-yellow-500/10',
  'bg-lime-500/10',
  'bg-emerald-500/10',
  'bg-teal-500/10',
  'bg-cyan-500/10',
  'bg-sky-500/10',
  'bg-indigo-500/10',
  'bg-violet-500/10',
  'bg-purple-500/10',
  'bg-fuchsia-500/10',
  'bg-pink-500/10',
  'bg-rose-500/10',
]

export function getTextColorClass(index: number): string {
  return TEXT_COLORS[index % TEXT_COLORS.length]!
}

export function getBgColorClass(index: number): string {
  return BG_COLORS[index % BG_COLORS.length]!
}

// ---------------------------------------------------------------------------
// Basic RGB <-> hex helpers
// ---------------------------------------------------------------------------

type RGB = {
  r: number
  g: number
  b: number
}
type RGBA = { a: number } & RGB
type Lab = {
  l: number
  a: number
  b: number
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToRgb(input: string): RGB {
  let hex = input.trim().replace('#', '')
  if (hex.length === 3) {
    hex = hex[0]! + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length !== 6) return { r: 0, g: 0, b: 0 }
  return {
    r: +('0x' + hex.slice(0, 2)),
    g: +('0x' + hex.slice(2, 4)),
    b: +('0x' + hex.slice(4, 6)),
  }
}

/** Look up a palette color by index. Index 0 is treated as transparent. */
export function getPaletteColor(index: number): RGBA {
  index = Math.min(index, palette.colors.length - 1)
  const [r, g, b] = palette.colors[index]!.rgb
  return { r, g, b, a: index === 0 ? 0 : 255 }
}

// ---------------------------------------------------------------------------
// Color-distance math
// ---------------------------------------------------------------------------

const TAU = 2 * Math.PI
const POW_25_7 = 6103515625 // 25^7, used by CIEDE2000
const DEG30 = 0.5235987755982988 // 30° in radians
const DEG6 = 0.10471975511965977 // 6°
const DEG63 = 1.0995574287564276 // 63°
const DEG275 = 4.799655442984406 // 275°
const DEG25 = 0.4363323129985824 // 25°

/** x^7, needed repeatedly by CIEDE2000 */
function pow7(x: number): number {
  const sq = x * x
  return sq * sq * sq * x
}

/** atan2 normalized to [0, 2π) */
function atan2Positive(y: number, x: number): number {
  const angle = Math.atan2(y, x)
  return angle < 0 ? angle + TAU : angle
}

// sRGB (0-255) -> linear-light lookup table, for Lab conversion
const SRGB_TO_LINEAR = new Float64Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  SRGB_TO_LINEAR[i] =
    c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92
}

/** Convert sRGB (0-255 per channel) to CIELAB */
function rgbToLab(color: RGB): Lab {
  const rl = SRGB_TO_LINEAR[color.r]
  const gl = SRGB_TO_LINEAR[color.g]
  const bl = SRGB_TO_LINEAR[color.b]

  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  x = f(x)
  y = f(y)
  z = f(z)

  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }
}

type LabEntry = {
  idx: number
  lab: Lab
}
type RgbEntry = {
  idx: number
  rgb: RGB
}

// Precompute Lab + RGB for every non-transparent palette color (idx !== 0)
const LAB_ENTRIES: LabEntry[] = palette.colors
  .map((c: { rgb: [number, number, number] }, idx: number) => ({
    idx,
    lab: rgbToLab({ r: c.rgb[0], g: c.rgb[1], b: c.rgb[2] }),
  }))
  .filter((e: LabEntry) => e.idx !== 0)

const RGB_ENTRIES: RgbEntry[] = palette.colors
  .map((c: { rgb: [number, number, number] }, idx: number) => ({
    idx,
    rgb: { r: c.rgb[0], g: c.rgb[1], b: c.rgb[2] },
  }))
  .filter((e: RgbEntry) => e.idx !== 0)

// Sparse index -> entry, so a restricted search (allowedIndices) is O(subset)
const LAB_BY_INDEX: LabEntry[] = new Array(palette.colors.length)
for (const e of LAB_ENTRIES) LAB_BY_INDEX[e.idx] = e

const RGB_BY_INDEX: RgbEntry[] = new Array(palette.colors.length)
for (const e of RGB_ENTRIES) RGB_BY_INDEX[e.idx] = e

type LabDistanceFn = (a: Lab, b: Lab) => number

function nearestByLab(
  target: Lab,
  distanceFn: LabDistanceFn,
  allowedIndices?: number[],
): number {
  let bestIdx = LAB_ENTRIES[0].idx
  let bestDist = Number.MAX_VALUE
  const useSubset = !!allowedIndices?.length
  const count = useSubset ? allowedIndices.length : LAB_ENTRIES.length

  for (let i = 0; i < count; i++) {
    const entry = useSubset ? LAB_BY_INDEX[allowedIndices[i]] : LAB_ENTRIES[i]
    if (!entry) continue
    const dist = distanceFn(target, entry.lab)
    if (dist < bestDist || (dist === bestDist && entry.idx < bestIdx)) {
      bestIdx = entry.idx
      bestDist = dist
    }
  }
  return bestIdx
}

function nearestByRgb(target: RGB, allowedIndices?: number[]): number {
  let bestIdx = RGB_ENTRIES[0].idx
  let bestDist = Number.MAX_VALUE
  const useSubset = !!allowedIndices?.length
  const count = useSubset ? allowedIndices.length : RGB_ENTRIES.length

  for (let i = 0; i < count; i++) {
    const entry = useSubset ? RGB_BY_INDEX[allowedIndices[i]] : RGB_ENTRIES[i]
    if (!entry) continue
    const dist = redmeanDistance(target, entry.rgb)
    if (dist < bestDist || (dist === bestDist && entry.idx < bestIdx)) {
      bestIdx = entry.idx
      bestDist = dist
    }
  }
  return bestIdx
}

export type MatchAlgorithm = 'lab' | 'ciede2000' | 'compuphase'

/**
 * Find the closest palette color index to `target`.
 * - 'compuphase': fast weighted-RGB approximation, no Lab conversion.
 * - 'ciede2000': slowest, most perceptually accurate.
 * - 'lab' (default): CIE94, a good accuracy/speed middle ground.
 */
export function matchColor(
  target: RGB,
  algorithm: MatchAlgorithm = 'lab',
  allowedIndices?: number[],
): number {
  if (algorithm === 'compuphase') return nearestByRgb(target, allowedIndices)
  const lab = rgbToLab(target)
  return nearestByLab(
    lab,
    algorithm === 'ciede2000' ? ciede2000 : cie94,
    allowedIndices,
  )
}

/** CIE94 color difference (kL = kC = kH = 1) */
function cie94(a: Lab, b: Lab): number {
  const dL = a.l - b.l
  const da = a.a - b.a
  const db = a.b - b.b
  const c1 = Math.sqrt(a.a * a.a + a.b * a.b)
  const c2 = Math.sqrt(b.a * b.a + b.b * b.b)
  const dC = c1 - c2

  let dHsq = da * da + db * db - dC * dC
  dHsq = dHsq < 0 ? 0 : dHsq
  const dH = Math.sqrt(dHsq)

  const sC = 1 + 0.045 * c1
  const sH = 1 + 0.015 * c1
  const weightedC = dC / sC
  const weightedH = dH / sH

  const sumSq = dL * dL + weightedC * weightedC + weightedH * weightedH
  return sumSq < 0 ? 0 : Math.sqrt(sumSq)
}

/**
 * CIEDE2000 color difference — the modern standard for perceptual accuracy.
 * Note: returns the *squared* distance (no final sqrt). That's fine here
 * since sqrt is monotonic and this value is only ever used for comparison.
 */
function ciede2000(a: Lab, b: Lab): number {
  const c1 = Math.sqrt(a.a * a.a + a.b * a.b)
  const c2 = Math.sqrt(b.a * b.a + b.b * b.b)
  const cBar7 = pow7((c1 + c2) * 0.5)
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + POW_25_7)))

  const a1p = (1 + g) * a.a
  const a2p = (1 + g) * b.a
  const c1p = Math.sqrt(a1p * a1p + a.b * a.b)
  const c2p = Math.sqrt(a2p * a2p + b.b * b.b)
  const cpProduct = c1p * c2p

  const h1p = c1p === 0 ? 0 : atan2Positive(a.b, a1p)
  const h2p = c2p === 0 ? 0 : atan2Positive(b.b, a2p)

  const dLp = b.l - a.l
  const dCp = c2p - c1p

  let dhp = 0
  if (cpProduct !== 0) {
    dhp = h2p - h1p
    if (dhp > Math.PI) dhp -= TAU
    else if (dhp < -Math.PI) dhp += TAU
  }
  const dHp =
    cpProduct === 0 ? 0 : 2 * Math.sqrt(cpProduct) * Math.sin(dhp * 0.5)

  const lBarP = (a.l + b.l) * 0.5
  const cBarP = (c1p + c2p) * 0.5

  let hBarP = h1p + h2p
  if (cpProduct !== 0) {
    hBarP =
      Math.abs(h1p - h2p) > Math.PI
        ? hBarP < TAU
          ? (hBarP + TAU) * 0.5
          : (hBarP - TAU) * 0.5
        : hBarP * 0.5
  }

  const t =
    1 -
    0.17 * Math.cos(hBarP - DEG30) +
    0.24 * Math.cos(2 * hBarP) +
    0.32 * Math.cos(3 * hBarP + DEG6) -
    0.2 * Math.cos(4 * hBarP - DEG63)

  const dTheta = (hBarP - DEG275) / DEG25
  const deltaTheta = DEG30 * Math.exp(-(dTheta * dTheta))

  const cBarP7 = pow7(cBarP)
  const rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + POW_25_7))

  const lOffsetSq = (lBarP - 50) * (lBarP - 50)
  const sL = 1 + (0.015 * lOffsetSq) / Math.sqrt(20 + lOffsetSq)
  const sC = 1 + 0.045 * cBarP
  const sH = 1 + 0.015 * cBarP * t
  const rT = -Math.sin(2 * deltaTheta) * rc

  const termL = dLp / sL
  const termC = dCp / sC
  const termH = dHp / sH

  const distSq =
    termL * termL + termC * termC + termH * termH + rT * termC * termH
  return distSq > 0 ? distSq : 0
}

/** "Redmean" weighted Euclidean RGB distance — cheap perceptual approximation */
function redmeanDistance(a: RGB, b: RGB): number {
  const rMean = (a.r + b.r) / 2
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  const rWeight = 2 + rMean / 256
  const bWeight = 2 + (255 - rMean) / 256
  return rWeight * dr * dr + 4 * dg * dg + bWeight * db * db
}

// Original minified exports, for reference if you need drop-in compatibility:
// it→getBgColorClass (a), ut→matchColor (b), gt→getPaletteColor (c),
// rt→getTextColorClass (g), lt→hexToRgb (h), at→rgbToHex (r)
