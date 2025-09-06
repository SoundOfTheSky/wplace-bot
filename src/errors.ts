import { WPlaceBot } from './bot'

export class WPlaceBotError extends Error {
  public name = 'WPlaceBotError'
  public constructor(message: string, bot: WPlaceBot) {
    super(message)
    bot.widget.status = message
  }
}

export class UnfocusRequiredError extends WPlaceBotError {
  public name = 'UnfocusRequiredError'
  public constructor(bot: WPlaceBot) {
    super('❌ UNFOCUS WINDOW', bot)
  }
}

export class NoFavLocation extends WPlaceBotError {
  public name = 'NoFavLocation'
  public constructor(bot: WPlaceBot) {
    super("❌ Don't remove star!", bot)
    setTimeout(() => {
      globalThis.location.reload()
    }, 1000)
  }
}

export class NoImageError extends WPlaceBotError {
  public name = 'NoImageError'
  public constructor(bot: WPlaceBot) {
    super('❌ No image is selected', bot)
  }
}
