import { WPlaceBot } from './bot'
import { NotInitializedError } from './errors'

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
    const p = bot.anchorsWorldPosition[0]
    const s = bot.anchorsScreenPosition[0]
    if (!p || !s) throw new NotInitializedError(bot)
    return new WorldPosition(
      bot,
      (p.globalX + (position.x - s.x) / bot.pixelSize) | 0,
      (p.globalY + (position.y - s.y) / bot.pixelSize) | 0,
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
    const p = this.bot.anchorsWorldPosition[0]
    const s = this.bot.anchorsScreenPosition[0]
    if (!p || !s) throw new NotInitializedError(this.bot)
    return {
      x: (this.globalX - p.globalX) * this.bot.pixelSize + s.x,
      y: (this.globalY - p.globalY) * this.bot.pixelSize + s.y,
    }
  }

  public getMapColor() {
    return this.bot.mapsCache.get(this.tileX + '/' + this.tileY)!.pixels[
      this.y
    ]![this.x]!
  }

  public scrollScreenTo() {
    const { x, y } = this.toScreenPosition()
    this.bot.moveMap({
      x: x - window.innerWidth / 3,
      y: y - window.innerHeight / 3,
    })
  }

  public clone() {
    return new WorldPosition(this.bot, this.tileX, this.tileY, this.x, this.y)
  }

  public toJSON() {
    return [this.tileX, this.tileY, this.x, this.y] as const
  }
}
