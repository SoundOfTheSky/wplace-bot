import {
  COLORS_RGB,
  COLORS_RGB_MAP,
  packRGB,
  COLORS_LAB,
  rgbToLab,
  unpackRGB,
  type Lab,
  type RGB,
} from './colors'
import { ImageStrategy } from './image'
import { isColorAvailable } from './utils'
import { WORLD_TILE_SIZE } from './world-position'

type SourceImage = {
  pixels: Uint8Array<ArrayBuffer>
  width: number
  height: number
}
export type ColorMetric = 'lab' | 'ciede2000' | 'compuphase'

export type ProcessImageJob = {
  id: string
  type: 'process'
  sourceName: string
  targetWidth: number
  targetHeight: number
  colorMetric: ColorMetric
  dithering: boolean
  extraColorsBitmap: number
  strategy: ImageStrategy
  drawColorsInOrder?: boolean
  colors?: number[]
  globalX: number
  globalY: number
}

export type WorkerRequest =
  | { id: string; type: 'register'; name: string; blob: Blob }
  | { id: string; type: 'clear-map-cache' }
  | ProcessImageJob

export type ProcessImageResult = {
  type: 'processImageResult'
  id: string
  pixels: Uint8Array<ArrayBuffer>
  colorsCount: Uint32Array<ArrayBuffer>
  colorsLeft: Uint32Array<ArrayBuffer>
  x: Uint32Array<ArrayBuffer>
  y: Uint32Array<ArrayBuffer>
}

export type WorkerResponse =
  | { id: string; type: 'error'; message: string }
  | { id: string; type: 'success' }
  | ProcessImageResult

const TAU = 2 * Math.PI
const POW7_25 = 6103515625 // 25^7
const DEG30_RAD = 0.5235987755982988
const toTile = (n: number) => Math.floor(n / WORLD_TILE_SIZE)
const toTilePos = (n: number) => ((n % WORLD_TILE_SIZE) + WORLD_TILE_SIZE) % WORLD_TILE_SIZE
const packTile = (tx: number, ty: number) => (tx << 11) | ty
const tileCache = new Map<number, Uint8Array<ArrayBuffer>>()
const tileInFlight = new Map<number, Promise<Uint8Array<ArrayBuffer>>>()
const sources = new Map<string, SourceImage>()
self.onmessage = handleMessage

function cie94Distance(sample: Lab, candidate: Lab): number {
  const dL = sample.l - candidate.l
  const da = sample.a - candidate.a
  const db = sample.b - candidate.b
  const c1 = Math.sqrt(sample.a * sample.a + sample.b * sample.b)
  const c2 = Math.sqrt(candidate.a * candidate.a + candidate.b * candidate.b)
  const dC = c1 - c2
  let dHSq = da * da + db * db - dC * dC
  if (dHSq < 0) dHSq = 0
  const dH = Math.sqrt(dHSq)
  const sC = 1 + 0.045 * c1
  const sH = 1 + 0.015 * c1
  const termC = dC / sC
  const termH = dH / sH
  const sumSq = dL * dL + termC * termC + termH * termH
  return sumSq < 0 ? 0 : Math.sqrt(sumSq)
}

function pow7(x: number) {
  const sq = x * x
  return sq * sq * sq * x
}

function atan2Normalized(y: number, x: number) {
  const a = Math.atan2(y, x)
  return a < 0 ? a + TAU : a
}

function ciede2000DistanceSquared(sample: Lab, candidate: Lab): number {
  const c1 = Math.sqrt(sample.a * sample.a + sample.b * sample.b)
  const c2 = Math.sqrt(candidate.a * candidate.a + candidate.b * candidate.b)
  const cBar7 = pow7((c1 + c2) * 0.5)
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + POW7_25)))
  const a1p = (1 + g) * sample.a,
    a2p = (1 + g) * candidate.a
  const c1p = Math.sqrt(a1p * a1p + sample.b * sample.b)
  const c2p = Math.sqrt(a2p * a2p + candidate.b * candidate.b)
  const c1pc2p = c1p * c2p
  const h1p = c1p === 0 ? 0 : atan2Normalized(sample.b, a1p)
  const h2p = c2p === 0 ? 0 : atan2Normalized(candidate.b, a2p)
  const deltaLp = candidate.l - sample.l
  const deltaCp = c2p - c1p
  let deltahp = 0
  if (c1pc2p !== 0) {
    deltahp = h2p - h1p
    if (deltahp > Math.PI) deltahp -= TAU
    else if (deltahp < -Math.PI) deltahp += TAU
  }
  const deltaHp = c1pc2p === 0 ? 0 : 2 * Math.sqrt(c1pc2p) * Math.sin(deltahp * 0.5)
  const lBarP = (sample.l + candidate.l) * 0.5
  const cBarP = (c1p + c2p) * 0.5
  let hBarP = h1p + h2p
  if (c1pc2p !== 0) {
    hBarP =
      Math.abs(h1p - h2p) > Math.PI
        ? hBarP < TAU
          ? (hBarP + TAU) * 0.5
          : (hBarP - TAU) * 0.5
        : hBarP * 0.5
  }
  const tWeight =
    1 -
    0.17 * Math.cos(hBarP - DEG30_RAD) +
    0.24 * Math.cos(2 * hBarP) +
    0.32 * Math.cos(3 * hBarP + 0.10471975511965977) -
    0.2 * Math.cos(4 * hBarP - 1.0995574287564276)
  const deltaTheta =
    DEG30_RAD * Math.exp(-(((hBarP - 4.799655442984406) / 0.4363323129985824) ** 2))
  const cBarP7 = pow7(cBarP)
  const rC = 2 * Math.sqrt(cBarP7 / (cBarP7 + POW7_25))
  const lMinus50Sq = (lBarP - 50) * (lBarP - 50)
  const sL = 1 + (0.015 * lMinus50Sq) / Math.sqrt(20 + lMinus50Sq)
  const sC = 1 + 0.045 * cBarP
  const sH = 1 + 0.015 * cBarP * tWeight
  const rT = -Math.sin(2 * deltaTheta) * rC
  const termL = deltaLp / sL,
    termC = deltaCp / sC,
    termH = deltaHp / sH
  const result = termL * termL + termC * termC + termH * termH + rT * termC * termH
  return result > 0 ? result : 0
}

function redmeanDistanceSquared(rgb1: RGB, rgb2: RGB): number {
  const rMean = (rgb1.r + rgb2.r) / 2
  const dr = rgb1.r - rgb2.r,
    dg = rgb1.g - rgb2.g,
    db = rgb1.b - rgb2.b
  const wR = 2 + rMean / 256
  const wB = 2 + (255 - rMean) / 256
  return wR * dr * dr + 4 * dg * dg + wB * db * db
}

export function nearestColorIndex(rgb: RGB, metric: ColorMetric, allowed?: number[]): number {
  let bestIdx = 1
  let bestDist = Infinity
  const n = allowed ? allowed.length : 63

  if (metric === 'compuphase') {
    for (let k = 0; k < n; k++) {
      const idx = allowed ? allowed[k]! : k + 1
      if (idx === 0) continue
      const v = COLORS_RGB[idx]!
      const rgb2 = unpackRGB(v)
      const dist = redmeanDistanceSquared(rgb, rgb2)
      if (dist < bestDist || (dist === bestDist && idx < bestIdx)) {
        bestDist = dist
        bestIdx = idx
      }
    }
    return bestIdx
  }

  const sample = rgbToLab(rgb)
  const distanceFn = metric === 'ciede2000' ? ciede2000DistanceSquared : cie94Distance
  for (let k = 0; k < n; k++) {
    const idx = allowed ? allowed[k]! : k + 1
    if (idx === 0) continue
    const dist = distanceFn(sample, COLORS_LAB[idx]!)
    if (dist < bestDist || (dist === bestDist && idx < bestIdx)) {
      bestDist = dist
      bestIdx = idx
    }
  }
  return bestIdx
}

export function resizeNearestNeighbor(
  src: Uint8Array<ArrayBuffer>,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array<ArrayBuffer> {
  if (srcW === dstW && srcH === dstH) return src
  const dst = new Uint8Array(dstW * dstH * 4)
  const colMap = new Uint32Array(dstW)
  for (let x = 0; x < dstW; x++) colMap[x] = Math.min(srcW - 1, Math.floor((x * srcW) / dstW))
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH))
    const srcRow = sy * srcW
    const dstRow = y * dstW
    for (let x = 0; x < dstW; x++) {
      const si = (srcRow + colMap[x]!) * 4
      const di = (dstRow + x) * 4
      dst[di] = src[si]!
      dst[di + 1] = src[si + 1]!
      dst[di + 2] = src[si + 2]!
      dst[di + 3] = src[si + 3]!
    }
  }
  return dst
}

/** Flat array, index*2=x, index*2+1=y, covering every (x,y) once, in `strategy`'s order. */
function strategyPositions(strategy: ImageStrategy, width: number, height: number): Uint32Array {
  const size = width * height
  const result = new Uint32Array(size * 2)
  let idx = 0
  switch (strategy) {
    case ImageStrategy.DOWN:
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          result[idx++] = x
          result[idx++] = y
        }
      break
    case ImageStrategy.UP:
      for (let y = height - 1; y >= 0; y--)
        for (let x = 0; x < width; x++) {
          result[idx++] = x
          result[idx++] = y
        }
      break
    case ImageStrategy.LEFT:
      for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++) {
          result[idx++] = x
          result[idx++] = y
        }
      break
    case ImageStrategy.RIGHT:
      for (let x = width - 1; x >= 0; x--)
        for (let y = 0; y < height; y++) {
          result[idx++] = x
          result[idx++] = y
        }
      break
    case ImageStrategy.RANDOM: {
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          result[idx++] = x
          result[idx++] = y
        }
      for (let i = size - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)) * 2
        const ri = i * 2
        const tx = result[ri]!,
          ty = result[ri + 1]!
        result[ri] = result[j]!
        result[ri + 1] = result[j + 1]!
        result[j] = tx
        result[j + 1] = ty
      }
      break
    }
    case ImageStrategy.SPIRAL_FROM_CENTER:
    case ImageStrategy.SPIRAL_TO_CENTER: {
      const reverse = strategy === ImageStrategy.SPIRAL_FROM_CENTER
      let i = reverse ? size - 1 : 0
      const step = reverse ? -1 : 1
      let top = 0,
        bottom = height - 1,
        left = 0,
        right = width - 1
      while (top <= bottom && left <= right) {
        for (let x = left; x <= right; x++) {
          result[i * 2] = x
          result[i * 2 + 1] = top
          i += step
        }
        top++
        for (let y = top; y <= bottom; y++) {
          result[i * 2] = right
          result[i * 2 + 1] = y
          i += step
        }
        right--
        if (top <= bottom) {
          for (let x = right; x >= left; x--) {
            result[i * 2] = x
            result[i * 2 + 1] = bottom
            i += step
          }
          bottom--
        }
        if (left <= right) {
          for (let y = bottom; y >= top; y--) {
            result[i * 2] = left
            result[i * 2 + 1] = y
            i += step
          }
          left++
        }
      }
      break
    }
  }
  return result
}

async function fetchTile(tileX: number, tileY: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = packTile(tileX, tileY)
  const cached = tileCache.get(key)
  if (cached) return cached
  const inFlight = tileInFlight.get(key)
  if (inFlight) return inFlight

  const promise = (async () => {
    try {
      const res = await fetch(`https://backend.wplace.live/files/s0/tiles/${tileX}/${tileY}.png`)
      if (!res.ok) throw new Error(`tile ${tileX},${tileY} fetch failed: ${res.status}`)
      const blob = await res.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
      const out = new Uint8Array(bitmap.width * bitmap.height)
      for (let i = 0, pi = 0; i < data.length; i += 4, pi++) {
        const a = data[i + 3]!
        out[pi] =
          a < 16
            ? 0
            : (COLORS_RGB_MAP.get(
                packRGB({ r: data[i]!, g: data[i + 1]! << 8, b: data[i + 2]! }),
              ) ?? 0)
      }
      tileCache.set(key, out)
      bitmap.close()
      return out
    } catch {
      const empty = new Uint8Array(WORLD_TILE_SIZE * WORLD_TILE_SIZE)
      tileCache.set(key, empty)
      return empty
    } finally {
      tileInFlight.delete(key)
    }
  })()

  tileInFlight.set(key, promise)
  return promise
}

function ensureTiles(
  globalX: number,
  globalY: number,
  width: number,
  height: number,
): Promise<unknown> {
  const jobs: Promise<unknown>[] = []
  const tx0 = toTile(globalX),
    tx1 = toTile(globalX + width - 1)
  const ty0 = toTile(globalY),
    ty1 = toTile(globalY + height - 1)
  for (let tx = tx0; tx <= tx1; tx++)
    for (let ty = ty0; ty <= ty1; ty++)
      if (!tileCache.has(packTile(tx, ty))) jobs.push(fetchTile(tx, ty))
  return Promise.all(jobs)
}

function readTilePixel(gx: number, gy: number): number {
  const tile = tileCache.get(packTile(toTile(gx), toTile(gy)))!
  return tile[toTilePos(gy) * WORLD_TILE_SIZE + toTilePos(gx)] ?? 0
}

async function decodeBlob(blob: Blob): Promise<SourceImage> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bitmap, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return { pixels: data as unknown as Uint8Array<ArrayBuffer>, width, height }
}

function send(msg: WorkerResponse, transfer: Transferable[] = []) {
  ;(postMessage as (m: unknown, t: Transferable[]) => void)(msg, transfer)
}

function handleMessage(e: MessageEvent<WorkerRequest>) {
  const req = e.data

  switch (req.type) {
    case 'register': {
      decodeBlob(req.blob)
        .then((source) => {
          sources.set(req.name, source)
          send({ type: 'success', id: req.id })
        })
        .catch((err) =>
          send({
            type: 'error',
            id: req.id,
            message: err instanceof Error ? err.message : 'decode failed',
          }),
        )
      return
    }
    case 'clear-map-cache': {
      tileCache.clear()
      return
    }
    case 'process': {
      void process(req)
      return
    }
  }
}

export function quantize(
  rgba: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
  metric: ColorMetric,
  dithering: boolean,
  allowed: number[] | undefined,
  cache: Map<number, number>,
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(width * height)

  if (!dithering) {
    for (let py = 0, pi = 0; py < height; py++) {
      for (let px = 0; px < width; px++, pi++) {
        const i = pi * 4
        const a = rgba[i + 3]!
        if (a < 16) {
          out[pi] = 0
          continue
        }
        const rgb = { r: rgba[i]!, g: rgba[i + 1]!, b: rgba[i + 2]! }
        const key = packRGB(rgb)
        let idx = cache.get(key)
        if (idx === undefined) {
          idx = nearestColorIndex(rgb, metric, allowed)
          cache.set(key, idx)
        }
        out[pi] = idx
      }
    }
    return out
  }

  // Dithered path: error-diffuse in RGB space, quantize per pixel, same as wplace.
  const rowSize = width * 3
  let errCurrent = new Float32Array(rowSize)
  let errNext = new Float32Array(rowSize)

  for (let row = 0; row < height; row++) {
    const swap = errCurrent
    errCurrent = errNext
    errNext = swap
    errNext.fill(0)
    for (let col = 0; col < width; col++) {
      const pi = row * width + col
      const i = pi * 4
      if (rgba[i + 3]! < 16) {
        out[pi] = 0
        continue
      }

      const e = col * 3
      const rgb = {
        r: Math.min(255, Math.max(0, Math.round(rgba[i]! + errCurrent[e]!))),
        g: Math.min(255, Math.max(0, Math.round(rgba[i + 1]! + errCurrent[e + 1]!))),
        b: Math.min(255, Math.max(0, Math.round(rgba[i + 2]! + errCurrent[e + 2]!))),
      }
      const key = packRGB(rgb)
      let idx = cache.get(key)
      if (idx === undefined) {
        idx = nearestColorIndex(rgb, metric, allowed)
        cache.set(key, idx)
      }
      out[pi] = idx

      const v = COLORS_RGB[idx]!
      const qrgb = idx === 0 ? { r: 0, g: 0, b: 0 } : unpackRGB(v)
      const errR = rgb.r - qrgb.r,
        errG = rgb.g - qrgb.g,
        errB = rgb.b - qrgb.b

      if (col + 1 < width) {
        const ne = (col + 1) * 3
        errCurrent[ne] += (7 / 16) * errR
        errCurrent[ne + 1] += (7 / 16) * errG
        errCurrent[ne + 2] += (7 / 16) * errB
      }
      if (row + 1 < height) {
        if (col > 0) {
          const bl = (col - 1) * 3
          errNext[bl] += (3 / 16) * errR
          errNext[bl + 1] += (3 / 16) * errG
          errNext[bl + 2] += (3 / 16) * errB
        }
        const bm = col * 3
        errNext[bm] += (5 / 16) * errR
        errNext[bm + 1] += (5 / 16) * errG
        errNext[bm + 2] += (5 / 16) * errB
        if (col + 1 < width) {
          const br = (col + 1) * 3
          errNext[br] += (1 / 16) * errR
          errNext[br + 1] += (1 / 16) * errG
          errNext[br + 2] += (1 / 16) * errB
        }
      }
    }
  }
  return out
}

async function process(job: ProcessImageJob) {
  try {
    const source = sources.get(job.sourceName)
    if (!source) throw new Error(`No registered source for ${job.sourceName}`)
    const tilesReady = ensureTiles(job.globalX, job.globalY, job.targetWidth, job.targetHeight)
    const resized = resizeNearestNeighbor(
      source.pixels,
      source.width,
      source.height,
      job.targetWidth,
      job.targetHeight,
    )

    const cache = new Map<number, number>()

    const allowedColorsIds: number[] = Array(32)
    for (let index = 0; index < 32; index++) allowedColorsIds[index] = index
    for (let index = 32; index < 64; index++)
      if (isColorAvailable(job.extraColorsBitmap, index)) allowedColorsIds.push(index)

    const pixels = quantize(
      resized,
      job.targetWidth,
      job.targetHeight,
      job.colorMetric,
      job.dithering,
      allowedColorsIds,
      cache,
    )
    await tilesReady

    const width = job.targetWidth,
      height = job.targetHeight
    const colorsCount = new Uint32Array(64)
    const colorsLeft = new Uint32Array(64)

    const colorsOrder =
      job.drawColorsInOrder && job.colors ? new Map(job.colors.map((c, i) => [c, i])) : undefined

    const positions = strategyPositions(job.strategy, width, height)
    const maxMismatches = positions.length / 2
    const xScratch = new Uint32Array(maxMismatches)
    const yScratch = new Uint32Array(maxMismatches)
    const colorScratch = colorsOrder ? new Uint8Array(maxMismatches) : undefined
    let mismatchCount = 0

    for (let p = 0; p < positions.length; p += 2) {
      const dx = positions[p]!,
        dy = positions[p + 1]!
      const color = pixels[dy * width + dx]!
      colorsCount[color]!++

      const gx = job.globalX + dx,
        gy = job.globalY + dy
      const mapColor = readTilePixel(gx, gy)

      if (color !== mapColor) {
        colorsLeft[color]!++
        xScratch[mismatchCount] = gx
        yScratch[mismatchCount] = gy
        if (colorScratch) colorScratch[mismatchCount] = color
        mismatchCount++
      }
    }

    let x = xScratch.slice(0, mismatchCount)
    let y = yScratch.slice(0, mismatchCount)

    if (colorsOrder && colorScratch) {
      const order = Array.from({ length: mismatchCount }, (_, i) => i)
      order.sort(
        (a, b) =>
          (colorsOrder.get(colorScratch[a]!) ?? Infinity) -
          (colorsOrder.get(colorScratch[b]!) ?? Infinity),
      )
      const sx = new Uint32Array(mismatchCount),
        sy = new Uint32Array(mismatchCount)
      for (let i = 0; i < mismatchCount; i++) {
        sx[i] = x[order[i]!]!
        sy[i] = y[order[i]!]!
      }
      x = sx
      y = sy
    }

    send({ type: 'processImageResult', id: job.id, pixels, colorsCount, colorsLeft, x, y }, [
      pixels.buffer,
      colorsCount.buffer,
      colorsLeft.buffer,
      x.buffer,
      y.buffer,
    ])
  } catch (err) {
    send({
      type: 'error',
      id: job.id,
      message: err instanceof Error ? err.message : 'decode failed',
    })
  } finally {
    sources.delete(job.id)
  }
}
