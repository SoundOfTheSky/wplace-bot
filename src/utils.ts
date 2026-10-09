export function formatPercent(n: number) {
  if (Number.isNaN(n)) return '0%'
  return ((n * 100) | 0) + '%'
}
