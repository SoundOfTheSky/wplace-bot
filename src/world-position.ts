import { WPlaceBot } from './bot'
import { UnfocusRequiredError } from './errors'
import { Pixels } from './pixels'

export type Position = {
  x: number
  y: number
}

export const WORLD_TILE_SIZE = 1000
export class WorldPosition {
  public static fromJSON(
    bot: WPlaceBot,
    data: ReturnType<WorldPosition['toJSON']>,
  ) {
    return new WorldPosition(bot, ...data)
  }

  public static fromScreenPosition(bot: WPlaceBot, position: Position) {
    if (!bot.anchorWorldPosition) throw new UnfocusRequiredError(bot)
    return new WorldPosition(
      bot,
      (bot.anchorWorldPosition.globalX +
        (position.x - bot.anchorScreenPosition.x) / bot.pixelSize) |
        0,
      (bot.anchorWorldPosition.globalY +
        (position.y - bot.anchorScreenPosition.y) / bot.pixelSize) |
        0,
    )
  }

  public globalX = 0

  public globalY = 0

  public get tileX(): number {
    return (this.globalX / WORLD_TILE_SIZE) | 0
  }
  public set tileX(value: number) {
    this.globalX = value * WORLD_TILE_SIZE + this.x
  }

  public get tileY(): number {
    return (this.globalY / WORLD_TILE_SIZE) | 0
  }
  public set tileY(value: number) {
    this.globalY = value * WORLD_TILE_SIZE + this.y
  }

  public get x(): number {
    return this.globalX % WORLD_TILE_SIZE
  }
  public set x(value: number) {
    this.globalX = this.tileX * WORLD_TILE_SIZE + value
  }

  public get y(): number {
    return this.globalY % WORLD_TILE_SIZE
  }
  public set y(value: number) {
    this.globalY = this.tileY * WORLD_TILE_SIZE + value
  }

  public constructor(
    protected bot: WPlaceBot,
    tileorGlobalX: number,
    tileorGlobalY: number,
    x?: number,
    y?: number,
  ) {
    if (x === undefined || y === undefined) {
      this.globalX = tileorGlobalX
      this.globalY = tileorGlobalY
    } else {
      this.globalX = tileorGlobalX * WORLD_TILE_SIZE + x
      this.globalY = tileorGlobalY * WORLD_TILE_SIZE + y
    }
  }

  public toScreenPosition(): Position {
    if (!this.bot.anchorWorldPosition) throw new UnfocusRequiredError(this.bot)
    return {
      x:
        (this.globalX - this.bot.anchorWorldPosition.globalX) *
          this.bot.pixelSize +
        this.bot.anchorScreenPosition.x,
      y:
        (this.globalY - this.bot.anchorWorldPosition.globalY) *
          this.bot.pixelSize +
        this.bot.anchorScreenPosition.y,
    }
  }

  public async getMapColor() {
    const key = this.tileX + '/' + this.tileY
    let map = this.bot.mapsCache.get(key)
    if (!map) {
      map = await Pixels.fromJSON(this.bot, {
        url: `https://backend.wplace.live/files/s0/tiles/${key}.png`,
      })
      this.bot.mapsCache.set(key, map)
    }
    return map.pixels[this.y]![this.x]!
  }

  public scrollScreenTo() {
    const { x, y } = this.toScreenPosition()
    console.log(x, y)
    this.bot.moveMap({
      x: -x,
      y: -y,
    })
  }

  public clone() {
    return new WorldPosition(this.bot, this.tileX, this.tileY, this.x, this.y)
  }

  public toJSON() {
    return [this.tileX, this.tileY, this.x, this.y] as const
  }
}
