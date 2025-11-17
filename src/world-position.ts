import { Me, WPlaceBot } from './bot'

export type Position = {
  x: number
  y: number
}

export const FAVORITE_LOCATIONS_POSITIONS: Position[] = [
  {
    x: 170_666,
    y: 1_874_537,
  },
  {
    x: 170_666,
    y: 1_704_430,
  },
  {
    x: 170_666,
    y: 1_534_322,
  },
  {
    x: 170_666,
    y: 1_364_215,
  },
  {
    x: 170_666,
    y: 1_194_107,
  },
  {
    x: 170_666,
    y: 1_024_000,
  },
  {
    x: 170_666,
    y: 853_892,
  },
  {
    x: 170_666,
    y: 683_784,
  },
  {
    x: 170_666,
    y: 513_677,
  },
  {
    x: 170_666,
    y: 343_569,
  },
  {
    x: 170_666,
    y: 173_462,
  },
  {
    x: 170_666,
    y: 3354,
  },
  {
    x: 341_333,
    y: 1_874_537,
  },
  {
    x: 341_333,
    y: 1_704_430,
  },
  {
    x: 341_333,
    y: 1_534_322,
  },
  {
    x: 341_333,
    y: 1_364_215,
  },
  {
    x: 341_333,
    y: 1_194_107,
  },
  {
    x: 341_333,
    y: 1_024_000,
  },
  {
    x: 341_333,
    y: 853_892,
  },
  {
    x: 341_333,
    y: 683_784,
  },
  {
    x: 341_333,
    y: 513_677,
  },
  {
    x: 341_333,
    y: 343_569,
  },
  {
    x: 341_333,
    y: 173_462,
  },
  {
    x: 341_333,
    y: 3354,
  },
  {
    x: 512_000,
    y: 1_874_537,
  },
  {
    x: 512_000,
    y: 1_704_430,
  },
  {
    x: 512_000,
    y: 1_534_322,
  },
  {
    x: 512_000,
    y: 1_364_215,
  },
  {
    x: 512_000,
    y: 1_194_107,
  },
  {
    x: 512_000,
    y: 1_024_000,
  },
  {
    x: 512_000,
    y: 853_892,
  },
  {
    x: 512_000,
    y: 683_784,
  },
  {
    x: 512_000,
    y: 513_677,
  },
  {
    x: 512_000,
    y: 343_569,
  },
  {
    x: 512_000,
    y: 173_462,
  },
  {
    x: 512_000,
    y: 3354,
  },
  {
    x: 682_666,
    y: 1_874_537,
  },
  {
    x: 682_666,
    y: 1_704_430,
  },
  {
    x: 682_666,
    y: 1_534_322,
  },
  {
    x: 682_666,
    y: 1_364_215,
  },
  {
    x: 682_666,
    y: 1_194_107,
  },
  {
    x: 682_666,
    y: 1_024_000,
  },
  {
    x: 682_666,
    y: 853_892,
  },
  {
    x: 682_666,
    y: 683_784,
  },
  {
    x: 682_666,
    y: 513_677,
  },
  {
    x: 682_666,
    y: 343_569,
  },
  {
    x: 682_666,
    y: 173_462,
  },
  {
    x: 682_666,
    y: 3354,
  },
  {
    x: 853_333,
    y: 1_874_537,
  },
  {
    x: 853_333,
    y: 1_704_430,
  },
  {
    x: 853_333,
    y: 1_534_322,
  },
  {
    x: 853_333,
    y: 1_364_215,
  },
  {
    x: 853_333,
    y: 1_194_107,
  },
  {
    x: 853_333,
    y: 1_024_000,
  },
  {
    x: 853_333,
    y: 853_892,
  },
  {
    x: 853_333,
    y: 683_784,
  },
  {
    x: 853_333,
    y: 513_677,
  },
  {
    x: 853_333,
    y: 343_569,
  },
  {
    x: 853_333,
    y: 173_462,
  },
  {
    x: 853_333,
    y: 3354,
  },
  {
    x: 1_024_000,
    y: 1_874_537,
  },
  {
    x: 1_024_000,
    y: 1_704_430,
  },
  {
    x: 1_024_000,
    y: 1_534_322,
  },
  {
    x: 1_024_000,
    y: 1_364_215,
  },
  {
    x: 1_024_000,
    y: 1_194_107,
  },
  {
    x: 1_024_000,
    y: 1_024_000,
  },
  {
    x: 1_024_000,
    y: 853_892,
  },
  {
    x: 1_024_000,
    y: 683_784,
  },
  {
    x: 1_024_000,
    y: 513_677,
  },
  {
    x: 1_024_000,
    y: 343_569,
  },
  {
    x: 1_024_000,
    y: 173_462,
  },
  {
    x: 1_024_000,
    y: 3354,
  },
  {
    x: 1_194_666,
    y: 1_874_537,
  },
  {
    x: 1_194_666,
    y: 1_704_430,
  },
  {
    x: 1_194_666,
    y: 1_534_322,
  },
  {
    x: 1_194_666,
    y: 1_364_215,
  },
  {
    x: 1_194_666,
    y: 1_194_107,
  },
  {
    x: 1_194_666,
    y: 1_024_000,
  },
  {
    x: 1_194_666,
    y: 853_892,
  },
  {
    x: 1_194_666,
    y: 683_784,
  },
  {
    x: 1_194_666,
    y: 513_677,
  },
  {
    x: 1_194_666,
    y: 343_569,
  },
  {
    x: 1_194_666,
    y: 173_462,
  },
  {
    x: 1_194_666,
    y: 3354,
  },
  {
    x: 1_365_333,
    y: 1_874_537,
  },
  {
    x: 1_365_333,
    y: 1_704_430,
  },
  {
    x: 1_365_333,
    y: 1_534_322,
  },
  {
    x: 1_365_333,
    y: 1_364_215,
  },
  {
    x: 1_365_333,
    y: 1_194_107,
  },
  {
    x: 1_365_333,
    y: 1_024_000,
  },
  {
    x: 1_365_333,
    y: 853_892,
  },
  {
    x: 1_365_333,
    y: 683_784,
  },
  {
    x: 1_365_333,
    y: 513_677,
  },
  {
    x: 1_365_333,
    y: 343_569,
  },
  {
    x: 1_365_333,
    y: 173_462,
  },
  {
    x: 1_365_333,
    y: 3354,
  },
  {
    x: 1_535_000,
    y: 1_874_537,
  },
  {
    x: 1_535_000,
    y: 1_704_430,
  },
  {
    x: 1_535_000,
    y: 1_534_322,
  },
  {
    x: 1_535_000,
    y: 1_364_215,
  },
  {
    x: 1_535_000,
    y: 1_194_107,
  },
  {
    x: 1_535_000,
    y: 1_024_000,
  },
  {
    x: 1_535_000,
    y: 853_892,
  },
  {
    x: 1_535_000,
    y: 683_784,
  },
  {
    x: 1_535_000,
    y: 513_677,
  },
  {
    x: 1_535_000,
    y: 343_569,
  },
  {
    x: 1_535_000,
    y: 173_462,
  },
  {
    x: 1_535_000,
    y: 3354,
  },
  {
    x: 1_706_666,
    y: 1_874_537,
  },
  {
    x: 1_706_666,
    y: 1_704_430,
  },
  {
    x: 1_706_666,
    y: 1_534_322,
  },
  {
    x: 1_706_666,
    y: 1_364_215,
  },
  {
    x: 1_706_666,
    y: 1_194_107,
  },
  {
    x: 1_706_666,
    y: 1_024_000,
  },
  {
    x: 1_706_666,
    y: 853_892,
  },
  {
    x: 1_706_666,
    y: 683_784,
  },
  {
    x: 1_706_666,
    y: 513_677,
  },
  {
    x: 1_706_666,
    y: 343_569,
  },
  {
    x: 1_706_666,
    y: 173_462,
  },
  {
    x: 1_706_666,
    y: 3354,
  },
  {
    x: 1_877_333,
    y: 1_874_537,
  },
  {
    x: 1_877_333,
    y: 1_704_430,
  },
  {
    x: 1_877_333,
    y: 1_534_322,
  },
  {
    x: 1_877_333,
    y: 1_364_215,
  },
  {
    x: 1_877_333,
    y: 1_194_107,
  },
  {
    x: 1_877_333,
    y: 1_024_000,
  },
  {
    x: 1_877_333,
    y: 853_892,
  },
  {
    x: 1_877_333,
    y: 683_784,
  },
  {
    x: 1_877_333,
    y: 513_677,
  },
  {
    x: 1_877_333,
    y: 343_569,
  },
  {
    x: 1_877_333,
    y: 173_462,
  },
  {
    x: 1_877_333,
    y: 3354,
  },
  {
    x: 2_048_000,
    y: 1_874_537,
  },
  {
    x: 2_048_000,
    y: 1_704_430,
  },
  {
    x: 2_048_000,
    y: 1_534_322,
  },
  {
    x: 2_048_000,
    y: 1_364_215,
  },
  {
    x: 2_048_000,
    y: 1_194_107,
  },
  {
    x: 2_048_000,
    y: 1_024_000,
  },
  {
    x: 2_048_000,
    y: 853_892,
  },
  {
    x: 2_048_000,
    y: 683_784,
  },
  {
    x: 2_048_000,
    y: 513_677,
  },
  {
    x: 2_048_000,
    y: 343_569,
  },
  {
    x: 2_048_000,
    y: 173_462,
  },
  {
    x: 2_048_000,
    y: 3354,
  },
]

export const FAVORITE_LOCATIONS: Me['favoriteLocations'] = []
const N = 12
for (let index = 0; index < N; index++) {
  const x = (((index + 1) / N) * 2 - 1) * Math.PI
  for (let index2 = 0; index2 < N; index2++) {
    FAVORITE_LOCATIONS.push({
      id: -(Date.now() + index * 1000 + index2),
      name: 'WBOT_ALIGN',
      latitude:
        ((2 *
          Math.atan(
            Math.exp(
              (((index2 + 1) / N) * 2 - 1) *
                Math.log(Math.tan(Math.PI / 4 + (85 * Math.PI) / 180 / 2)),
            ),
          ) -
          Math.PI / 2) *
          180) /
        Math.PI,
      longitude: (x * 180) / Math.PI,
    })
  }
}

export const WORLD_TILE_SIZE = 1000

export function extractScreenPositionFromStar($star: HTMLDivElement) {
  const [x, y] = $star.style.transform
    .slice(32, -31)
    .split(', ')
    .map((x) => Number.parseFloat(x)) as [number, number]
  return { x, y }
}

export class WorldPosition {
  public static fromJSON(
    bot: WPlaceBot,
    data: ReturnType<WorldPosition['toJSON']>,
  ) {
    return new WorldPosition(bot, ...data)
  }

  public static fromScreenPosition(bot: WPlaceBot, position: Position) {
    const { anchorScreenPosition, pixelSize, anchorWorldPosition } =
      bot.findAnchorsForScreen(position)
    return new WorldPosition(
      bot,
      (anchorWorldPosition.x +
        (position.x - anchorScreenPosition.x) / pixelSize) |
        0,
      (anchorWorldPosition.y +
        (position.y - anchorScreenPosition.y) / pixelSize) |
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

  /** Anchor that is used to align screen position for this world positions */
  public anchor1Index!: number

  /** Second anchor that is used to align screen position for this world positions */
  public anchor2Index!: number

  /** Pixel size around with world position. Calculated on every read */
  public get pixelSize() {
    return (
      (extractScreenPositionFromStar(this.bot.$stars[this.anchor2Index]!).x -
        extractScreenPositionFromStar(this.bot.$stars[this.anchor1Index]!).x) /
      (FAVORITE_LOCATIONS_POSITIONS[this.anchor2Index]!.x -
        FAVORITE_LOCATIONS_POSITIONS[this.anchor1Index]!.x)
    )
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
    this.updateAnchor()
  }

  /** Find closest anchor point for best accuracy */
  public updateAnchor() {
    this.anchor1Index = 0
    this.anchor2Index = 1
    let min1 = Infinity
    let min2 = Infinity
    for (let index = 0; index < FAVORITE_LOCATIONS_POSITIONS.length; index++) {
      const { x, y } = FAVORITE_LOCATIONS_POSITIONS[index]!
      if (x < this.globalX && y < this.globalY) {
        const delta = this.globalX - x + (this.globalY - y)
        if (delta < min1) {
          min1 = delta
          this.anchor1Index = index
        }
      } else if (x > this.globalX && y > this.globalY) {
        const delta = x - this.globalX + (y - this.globalY)
        if (delta < min2) {
          min2 = delta
          this.anchor2Index = index
        }
      }
    }
  }

  /** Get screen position */
  public toScreenPosition(): Position {
    const worldPosition = FAVORITE_LOCATIONS_POSITIONS[this.anchor1Index]!
    const screenPosition = extractScreenPositionFromStar(
      this.bot.$stars[this.anchor1Index]!,
    )
    return {
      x: (this.globalX - worldPosition.x) * this.pixelSize + screenPosition.x,
      y: (this.globalY - worldPosition.y) * this.pixelSize + screenPosition.y,
    }
  }

  /** Get map color at this position */
  public getMapColor() {
    return this.bot.mapsCache.get(this.tileX + '/' + this.tileY)!.pixels[
      this.y
    ]![this.x]!
  }

  /** Scroll screen to this position */
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
