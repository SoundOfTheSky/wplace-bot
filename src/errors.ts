export class WPlaceBotError extends Error {
  public override name = 'WPlaceBotError'
}

export class NoImageError extends WPlaceBotError {
  public override name = 'NoImageError'
  public constructor() {
    super('No image is selected')
  }
}

export class NoAnchorError extends WPlaceBotError {
  public override name = 'NoAnchorError'
  public constructor() {
    super('Anchors are missing. Reload the page.')
  }
}
