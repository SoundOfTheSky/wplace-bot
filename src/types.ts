export enum Strategy {
  RANDOM = 'RANDOM',
  DOWN = 'DOWN',
  UP = 'UP',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  SPIRAL_FROM_CENTER = 'SPIRAL_FROM_CENTER',
  SPIRAL_TO_CENTER = 'SPIRAL_TO_CENTER',
}

export type Color = {
  r: number
  g: number
  b: number
  a: number
  available: boolean
  buttonId: string
}

export type Position = {
  x: number
  y: number
}

export type DrawTask = Position & {
  buttonId: string
}

export type Save = {
  image: string
  startScreenPosition: Position
  startPosition: [number, number, number, number]
  pixelSize: number
  widgetX: number
  widgetY: number
  overlayOpacity: number
  scale: number
  strategy: Strategy
  location?: string
}

export type PixelMetaData = {
  paintedBy: {
    id: number
    name: string
    allianceId: number
    allianceName: string
    equippedFlag: number
  }
  region: {
    id: number
    cityId: number
    name: string
    number: number
    countryId: number
  }
}
