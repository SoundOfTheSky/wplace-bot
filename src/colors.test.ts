import { expect, test } from 'bun:test'

import {
  COLORS,
  COLORS_RGB_TRIPLES,
  deltaCompuphase,
  deltaE2000,
  deltaE94,
  metricFunction,
  rgbToLab,
} from './colors'

type Lab = [number, number, number]

/** Sharma's CIEDE2000 test data, the reference every implementation is checked against */
const SHARMA: [Lab, Lab, number][] = [
  [[50, 2.677_2, -79.775_1], [50, 0, -82.748_5], 2.042_5],
  [[50, 2.49, -0.001], [50, -2.49, 0.000_9], 7.179_2],
  [[50, 0, 0], [50, -1, 2], 2.366_9],
  [[60.257_4, -34.009_9, 36.267_7], [60.462_6, -34.175_1, 39.438_7], 1.264_4],
  [[63.010_9, -31.096_1, -5.866_3], [62.818_7, -29.794_6, -4.086_4], 1.263_0],
]

test('matches the CIEDE2000 reference values', () => {
  for (const [lab1, lab2, expected] of SHARMA)
    expect(deltaE2000(lab1, lab2, 0)).toBeCloseTo(expected, 3)
})

test('a color is identical to itself', () => {
  expect(deltaE2000([50, 10, -20], [50, 10, -20], 0)).toBe(0)
})

test('converts sRGB to CIELAB', () => {
  // White lands a hundredth off neutral because wplace's rounded matrix does
  // not sum exactly to its white point. We copy that on purpose, to pick the
  // same colors they do
  const [l, a, b] = rgbToLab(255, 255, 255)
  expect(l).toBeCloseTo(100, 1)
  expect(a).toBeCloseTo(0, 1)
  expect(b).toBeCloseTo(0, 1)
  expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 3)
  // Middle gray sits near L* 53.4, the classic sanity check
  expect(rgbToLab(128, 128, 128)[0]).toBeCloseTo(53.585, 2)
})

/**
 * Borderline colors, each sitting almost exactly between its two nearest
 * palette colors, so any drift in the math flips the pick. Expected indexes
 * captured from wplace's own quantizer, one block per metric.
 */
const BORDERLINE: Record<
  'lab' | 'ciede2000' | 'compuphase',
  [[number, number, number], number][]
> = {
  lab: [
    [[8, 138, 151], 3],
    [[8, 151, 138], 16],
    [[8, 190, 8], 42],
    [[21, 99, 216], 48],
    [[21, 138, 151], 3],
    [[21, 177, 8], 12],
    [[21, 190, 21], 42],
    [[34, 138, 151], 3],
  ],
  ciede2000: [
    [[8, 8, 99], 46],
    [[8, 21, 112], 47],
    [[8, 112, 73], 15],
    [[8, 125, 73], 40],
    [[8, 203, 229], 45],
    [[21, 21, 112], 47],
    [[21, 99, 73], 15],
    [[21, 164, 60], 41],
  ],
  compuphase: [
    [[8, 8, 125], 47],
    [[8, 8, 138], 47],
    [[8, 21, 138], 18],
    [[8, 21, 151], 18],
    [[8, 34, 125], 47],
    [[8, 34, 177], 46],
    [[8, 47, 21], 58],
    [[8, 60, 8], 58],
  ],
}

function nearest(
  metric: (
    l: [number, number, number],
    c: [number, number, number],
    b: number,
  ) => number,
  palette: readonly [number, number, number][],
  source: [number, number, number],
) {
  let best = 1
  let bestDelta = Infinity
  for (let index = 1; index < 64; index++) {
    const delta = metric(source, palette[index]!, 0)
    if (delta < bestDelta) {
      bestDelta = delta
      best = index
    }
  }
  return best
}

test('matches wplace on borderline colors, per metric', () => {
  for (const [rgb, expected] of BORDERLINE.lab)
    expect(nearest(deltaE94, COLORS, rgbToLab(...rgb))).toBe(expected)
  for (const [rgb, expected] of BORDERLINE.ciede2000)
    expect(nearest(deltaE2000, COLORS, rgbToLab(...rgb))).toBe(expected)
  for (const [rgb, expected] of BORDERLINE.compuphase)
    expect(nearest(deltaCompuphase, COLORS_RGB_TRIPLES, rgb)).toBe(expected)
})

test('CIE94 weights chroma and hue', () => {
  // Pure lightness difference is unweighted
  expect(deltaE94([50, 0, 0], [60, 0, 0], 0)).toBeCloseTo(10, 6)
  // Pure chroma difference is divided by 1 + 0.045 * C1
  expect(deltaE94([50, 10, 0], [50, 20, 0], 0)).toBeCloseTo(10 / 1.45, 6)
  expect(deltaE94([50, 10, -20], [50, 10, -20], 0)).toBe(0)
})

test('defaults to the metric wplace defaults to', () => {
  expect(metricFunction('lab')).toBe(deltaE94)
  expect(metricFunction('ciede2000')).toBe(deltaE2000)
  expect(metricFunction('compuphase')).toBe(deltaCompuphase)
})
