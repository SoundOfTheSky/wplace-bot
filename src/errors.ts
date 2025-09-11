import { WPlaceBot } from './bot'

export class WPlaceBotError extends Error {
  public name = 'WPlaceBotError'
  public constructor(message: string, bot: WPlaceBot) {
    super(message)
    bot.widget.status = message
  }
}

export class NotInitializedError extends WPlaceBotError {
  public name = 'NotInitializedError'
  public constructor(bot: WPlaceBot) {
    super('❌ Not initialized', bot)
  }
}

export class StarsAreTooCloseError extends WPlaceBotError {
  public name = 'StarsAreTooCloseError'
  public constructor(bot: WPlaceBot) {
    super('❌ Stars are too close', bot)
  }
}

export class ZoomTooFarError extends WPlaceBotError {
  public name = 'ZoomTooFarError'
  public constructor(bot: WPlaceBot) {
    super('❌ Zoom is too far', bot)
  }
}

export class NoImageError extends WPlaceBotError {
  public name = 'NoImageError'
  public constructor(bot: WPlaceBot) {
    super('❌ No image is selected', bot)
  }
}
