import { expect, test } from 'bun:test'

import { type BotImage } from './image'
import { fromWplaceFile, toWplaceFile } from './wplace-file'

/** Bounds of a real template exported by wplace, 920x1250 drawn as 92x125 */
const BOUNDS = {
  north: 48.873_039_846_595_43,
  south: 48.858_585_689_305_194,
  west: 9.528_398_437_499_991,
  east: 9.544_570_312_499_987,
}

test('import keeps position and on-map scale', () => {
  const data = fromWplaceFile({
    image: { dataUrl: 'data:image/png;base64,x', width: 920, height: 1250 },
    bounds: BOUNDS,
    opacity: 0.5,
    name: 'template.jpg',
    locked: true,
    visible: false,
  })
  expect(data.position).toEqual([1_078_206, 704_428])
  expect(data.width).toBe(92)
  expect(data.opacity).toBe(50)
  expect(data.lock).toBe(true)
  expect(data.disabled).toBe(true)
})

test('rejects a file without bounds', () => {
  expect(() =>
    fromWplaceFile({ image: { dataUrl: 'data:image/png;base64,x' } }),
  ).toThrow()
})

test('export round-trips back to the same pixels', () => {
  const image = {
    $canvas: { toDataURL: () => 'data:image/png;base64,x' },
    position: { globalX: 1_078_206, globalY: 704_428 },
    width: 92,
    height: 125,
    opacity: 50,
    name: 'template',
    lock: false,
    disabled: false,
  } as unknown as BotImage
  const file = toWplaceFile(image)
  const data = fromWplaceFile(file)
  expect(data.position).toEqual([1_078_206, 704_428])
  expect(data.width).toBe(92)
  expect(data.opacity).toBe(50)
})
