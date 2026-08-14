import { WPlaceBot } from './bot'

export class WPlaceBotError extends Error {
  public override name = 'WPlaceBotError'
  public constructor(message: string, bot: WPlaceBot) {
    super(message)
    bot.widget.status = message
  }
}

export class NoImageError extends WPlaceBotError {
  public override name = 'NoImageError'
  public constructor(bot: WPlaceBot) {
    super('❌ No image is selected', bot)
  }
}
