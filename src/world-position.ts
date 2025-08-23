import { WPlaceBot } from './bot'
import { NoMarkerError } from './errors'
import { Pixels } from './pixels'
import { Position } from './types'

export const WORLD_TILE_SIZE = 1000
export class WorldPosition {
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

  public static fromJSON(
    bot: WPlaceBot,
    data: ReturnType<WorldPosition['toJSON']>,
  ) {
    return new WorldPosition(bot, ...data)
  }

  public toScreenPosition(): Position {
    if (!this.bot.anchorWorldPosition || !this.bot.anchorScreenPosition)
      throw new NoMarkerError(this.bot)
    const halfPixel = this.bot.pixelSize / 2
    return {
      x:
        (this.globalX - this.bot.anchorWorldPosition.globalX) *
          this.bot.pixelSize +
        this.bot.anchorScreenPosition.x +
        halfPixel,
      y:
        (this.globalY - this.bot.anchorWorldPosition.globalY) *
          this.bot.pixelSize +
        this.bot.anchorScreenPosition.y +
        halfPixel,
    }
  }

  public async getMapColor() {
    const key = this.tileX + '/' + this.tileY
    let map = this.bot.maps.get(key)
    if (!map) {
      map = await Pixels.fromJSON(this.bot, {
        scalePixelDelta: 0,
        url: `https://backend.wplace.live/files/s0/tiles/${this.tileX}/${this.tileY}.png`,
      })
      this.bot.maps.set(key, map)
    }
    return map.pixels[this.y]![this.x]!
  }

  public clone() {
    return new WorldPosition(this.bot, this.tileX, this.tileY, this.x, this.y)
  }

  public toJSON() {
    return [this.tileX, this.tileY, this.x, this.y] as const
  }
}
