import { type BotImage } from './image'
import {
  latitudeToWorld,
  longitudeToWorld,
  worldToLatitude,
  worldToLongitude,
} from './world-position'

/**
 * wplace.live's own template format, as exported by its template manager.
 * This is their public contract (`schemaVersion`), so keep it isolated here
 * instead of leaking their field names into our save format.
 */
export type WplaceFile = {
  id: string
  schemaVersion: string
  name: string
  opacity: number
  image: {
    dataUrl: string
    width: number
    height: number
  }
  bounds: {
    north: number
    south: number
    west: number
    east: number
  }
  colorMetric: string
  dithering: boolean
  useLegacyColors: boolean
  colorPaletteMode: string
  order: number
  locked: boolean
  hasPlaced: boolean
  visible: boolean
}

/**
 * Convert a parsed `.wplace` file into arguments for `BotImage.fromJSON`.
 * The bounds carry the on-map size, so the template keeps its scale.
 */
export function fromWplaceFile(raw: unknown) {
  const file = raw as Partial<WplaceFile>
  const bounds = file.bounds
  if (
    typeof file.image?.dataUrl !== 'string' ||
    !bounds ||
    [bounds.north, bounds.south, bounds.west, bounds.east].some(
      (x) => typeof x !== 'number' || !Number.isFinite(x),
    )
  )
    throw new Error('Not a valid .wplace template')
  const globalX = Math.round(longitudeToWorld(bounds.west))
  const globalY = Math.round(latitudeToWorld(bounds.north))
  return {
    url: file.image.dataUrl,
    position: [globalX, globalY] as [number, number],
    width: Math.max(1, Math.round(longitudeToWorld(bounds.east)) - globalX),
    opacity:
      typeof file.opacity === 'number'
        ? Math.round(file.opacity * 100)
        : undefined,
    lock: file.locked,
    disabled: file.visible === false,
    name: file.name,
  }
}

/**
 * Serialize an image into a `.wplace` template.
 * Exports the quantized canvas, so it is already at map scale and needs no
 * resampling on their side.
 */
export function toWplaceFile(image: BotImage, order = 0): WplaceFile {
  const { globalX, globalY } = image.position
  return {
    id: crypto.randomUUID(),
    schemaVersion: '1',
    name: image.name,
    opacity: image.opacity / 100,
    image: {
      dataUrl: image.$canvas.toDataURL('image/png'),
      width: image.width,
      height: image.height,
    },
    bounds: {
      north: worldToLatitude(globalY),
      south: worldToLatitude(globalY + image.height),
      west: worldToLongitude(globalX),
      east: worldToLongitude(globalX + image.width),
    },
    // We export an already quantized canvas, so these all mean "leave the
    // pixels alone": dithering would smear finished pixels, legacy colors or a
    // restricted palette would remap them, and ciede2000 (our deltaE2000) maps
    // every palette color onto itself.
    colorMetric: 'ciede2000',
    dithering: false,
    useLegacyColors: false,
    colorPaletteMode: 'all',
    order,
    locked: image.lock,
    hasPlaced: false,
    visible: !image.disabled,
  }
}
