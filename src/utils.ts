export function formatPercent(n: number) {
  if (Number.isNaN(n)) return '0%'
  if (n < 0.1) n = ((n * 1000) | 0) / 10
  else n = (n * 100) | 0
  return n + '%'
}
