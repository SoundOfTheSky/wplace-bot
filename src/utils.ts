import { formatNumber } from '@softsky/utils'
import type { WPlaceBot } from './bot'

export function formatPercent(n: number) {
  if (Number.isNaN(n)) return '0%'
  return ((n * 100) | 0) + '%'
}

/** Time left to paint `remaining` pixels, counting the charges already stored */
export function etaText(bot: WPlaceBot, remaining: number): string {
  const charges = Math.floor(bot.me?.charges.count ?? 0)
  const cooldownMs = bot.me?.charges.cooldownMs ?? 30000
  return formatNumber(Math.max(0, remaining - charges) * cooldownMs, 60000)
}

/** Check if colors is available to player by this.me!.extraColorsBitmap */
export function isColorAvailable(bitmap: number, color: number) {
  return color < 32 || (bitmap & (1 << (color - 32))) !== 0
}
