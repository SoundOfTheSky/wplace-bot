import { promisifyEventSource, swap } from '@softsky/utils'

import { Base } from './base'
import { WPlaceBot } from './bot'
import { NoImageError, WPlaceBotError } from './errors'
import { BotImage, etaText } from './image'
import {
  addClass,
  containsClass,
  obfucsateHTML,
  querySelector,
  removeClass,
  SID,
  toggleClass,
} from './obfuscator'
import { migrateImage, save } from './save'
// @ts-ignore
import html from './widget.html' with { type: 'text' }

export enum BotStrategy {
  ALL = 'ALL',
  PERCENTAGE = 'PERCENTAGE',
  SEQUENTIAL = 'SEQUENTIAL',
}

/** Widget UI with buttons */
export class Widget extends Base {
  public readonly element = document.createElement('div')

  public get status(): string {
    return this.$status.innerHTML
  }

  public set status(value: string) {
    this.$status.innerHTML = value
  }

  public get open() {
    return containsClass(this.element, 'open')
  }
  public set open(value) {
    if (value) addClass(this.element, 'open')
    else removeClass(this.element, 'open')
  }

  protected readonly $settings!: HTMLDivElement
  protected readonly $status!: HTMLDivElement
  protected readonly $minimize!: HTMLButtonElement
  protected readonly $topbar!: HTMLDivElement
  protected readonly $title!: HTMLInputElement
  protected readonly $draw!: HTMLButtonElement
  protected readonly $addImage!: HTMLButtonElement
  protected readonly $strategy!: HTMLInputElement
  protected readonly $progressLine!: HTMLDivElement
  protected readonly $progressText!: HTMLSpanElement
  protected readonly $images!: HTMLDivElement
  protected readonly $openButton!: HTMLButtonElement
  public readonly $autoDraw!: HTMLButtonElement

  // protected readonly $pumpkinHunt!: HTMLButtonElement

  public constructor(protected bot: WPlaceBot) {
    super()
    addClass(this.element, 'widget')
    this.element.innerHTML = obfucsateHTML(html)
    document.body.append(this.element)

    this.populateElementsWithSelector(this.element, {
      $openButton: '.open-button',
      $settings: '.form',
      $status: '.status',
      $minimize: '.minimize',
      $topbar: '.topbar',
      $title: '.title',
      $draw: '.draw',
      $addImage: '.add-image',
      $strategy: '.strategy',
      $progressLine: '.progress div',
      $progressText: '.progress span',
      $images: '.images',
      $autoDraw: '.auto-draw',
      // $pumpkinHunt: '.pumpkin-hunt',
    })

    // Button actions
    this.$openButton.addEventListener('click', () => (this.open = !this.open))
    this.$title.addEventListener('change', () => {
      this.bot.title = this.$title.value.trim()
      void save(this.bot)
    })
    this.bot.fixSpaceInInput(this.$title)
    this.$draw.addEventListener('click', () => this.bot.draw())
    // this.$pumpkinHunt.addEventListener('click', () => this.pumpkinHunt())
    this.$addImage.addEventListener('click', () => this.addImage())
    this.$strategy.addEventListener('change', () => {
      this.bot.strategy = this.$strategy.value as BotStrategy
    })
    this.$autoDraw.addEventListener('click', () => this.bot.autoDraw())

    this.update()
    this.open = true
  }

  /** Add image handler */
  public addImage() {
    this.setDisabled('add-image', true)
    return this.run(
      'Adding image',
      async () => {
        await this.bot.updateColorsData()
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*,.wbot'
        input.click()
        await promisifyEventSource(input, ['change'], ['cancel', 'error'])
        const file = input.files?.[0]
        if (!file) throw new NoImageError(this.bot)
        if (file.name.endsWith('.wbot')) {
          await BotImage.fromJSON(
            this.bot,
            migrateImage(
              JSON.parse(await file.text()) as Awaited<
                ReturnType<BotImage['toJSON']>
              >,
            ),
          )
        } else {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          await promisifyEventSource(reader, ['load'], ['error'])
          await BotImage.fromJSON(this.bot, {
            url: reader.result as string,
          })
        }
        await save(this.bot, true)
        document.location.reload()
      },
      () => {
        this.setDisabled('add-image', false)
      },
    )
  }

  /** Update widget position and contents */
  public update() {
    this.$title.value = this.bot.title
    this.$strategy.value = this.bot.strategy
    // Progress
    let maxTasks = 0
    let totalTasks = 0
    for (let index = 0; index < this.bot.images.length; index++) {
      const image = this.bot.images[index]!
      if (image.disabled) continue
      maxTasks += image.width * image.height
      totalTasks += image.tasks.length / 2
    }
    const doneTasks = maxTasks - totalTasks
    const percent = maxTasks === 0 ? 0 : ((doneTasks / maxTasks) * 100) | 0
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${etaText(this.bot, totalTasks)}`
    this.$progressLine.style.transform = `scaleX(${percent}%)`

    // Images
    this.$images.innerHTML = ''
    for (let index = 0; index < this.bot.images.length; index++) {
      const image = this.bot.images[index]!
      const $image = document.createElement('div')
      this.$images.append($image)
      $image.className = SID + 'item'
      $image.innerHTML = obfucsateHTML(`
<canvas></canvas>
<input type="text" class="name">
<label class="toggle">
  <input type="checkbox" class="enabled" ${image.disabled ? '' : 'checked'}>
  <span>${image.disabled ? 'Disabled' : 'Enabled'}</span>
</label>
<button class="up" title="Move up" ${index === 0 ? 'disabled' : ''}>▴</button>
<button class="down" title="Move down" ${index === this.bot.images.length - 1 ? 'disabled' : ''}>▾</button>`)

      // Draw copy in center
      const $canvas = $image.querySelector<HTMLCanvasElement>('canvas')!
      $canvas.width = 48
      $canvas.height = 64
      const scale = Math.min(48 / image.width, 64 / image.height)
      const w = image.width * scale
      const h = image.height * scale
      $canvas
        .getContext('2d')!
        .drawImage(image.$canvas, (48 - w) / 2, (64 - h) / 2, w, h)
      $canvas.addEventListener('click', () => {
        image.position.moveScreenTo()
      })

      const $name = querySelector<HTMLInputElement>($image, '.name')!
      $name.value = image.name
      $name.addEventListener('change', () => {
        image.name = $name.value
        image.updateUI()
        this.update()
        void save(this.bot)
      })
      const $enabled = querySelector<HTMLInputElement>($image, '.enabled')!
      $enabled.addEventListener('change', async () => {
        image.disabled = !$enabled.checked
        await image.updatePixels()
        await save(this.bot)
      })
      // Close on input to not consume space
      this.bot.fixSpaceInInput($name)
      querySelector($image, '.up')!.addEventListener('click', () => {
        swap(this.bot.images, index, index - 1)
        this.update()
        void save(this.bot)
      })
      querySelector($image, '.down')!.addEventListener('click', () => {
        swap(this.bot.images, index, index + 1)
        this.update()
        void save(this.bot)
      })
    }
  }

  /** Disable/enable element by class name */
  public setDisabled(name: string, disabled: boolean) {
    querySelector<HTMLButtonElement>(this.element, '.' + name)!.disabled =
      disabled
  }

  /** Show status of running task */
  public async run<T>(
    status: string,
    run: (progress: (progress: number) => void) => Promise<T>,
    fin?: () => unknown,
    emoji = '⌛',
  ): Promise<T> {
    const originalStatus = this.status
    try {
      const result = await run((p) => {
        this.status = `${emoji} ${status} ${(p * 100) | 0}%`
      })
      this.status = originalStatus
      return result
    } catch (error) {
      if (!(error instanceof WPlaceBotError)) {
        console.error(error)
        this.status = `❌ ${status}`
      }
      throw error
    } finally {
      await fin?.()
    }
  }

  /** Hides content */
  protected minimize() {
    toggleClass(this.$settings, 'hidden')
  }

  // protected async pumpkinHunt() {
  //   this.$pumpkinHunt.disabled = false
  //   const PUMPKIN_PATTERN =
  //     '8,8,8,8,8,8,8,1,8,8,8,1,8,8,8,1,8,8,8,8,8,8_8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8_8,1,1,1,1,8,8,8,8,8,8,8,8,8,8,8,8,8,1,1,1,1_8,8,1,1,1,1,1,1,8,8,8,8,8,8,8,1,1,1,1,1,1,8_8,8,1,1,1,5,5,1,1,8,8,8,8,8,1,1,5,5,1,1,1,8_8,8,1,1,1,5,5,1,1,1,8,8,8,1,1,1,5,5,1,1,1,8_8,8,8,1,1,1,1,1,1,8,8,1,8,8,1,1,1,1,1,1,8,8_8,8,8,8,1,1,1,1,8,8,1,1,1,8,8,1,1,1,1,8,8,8_8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8_8,8,8,8,1,8,8,8,8,8,8,1,8,8,8,8,8,8,1,8,8,8_8,8,8,1,1,1,8,8,8,8,1,1,1,8,8,8,8,1,1,1,8,8_8,8,1,1,8,1,1,8,8,1,1,8,1,1,8,8,1,1,8,1,1,8_1,8,8,8,8,8,1,1,1,1,8,8,8,1,1,1,1,8,8,8,8,8_1,1,1,8,8,8,8,1,1,8,8,8,8,8,1,1,8,8,8,8,1,1_1,12,12,1,1,8,8,8,8,8,8,1,8,8,8,8,8,8,1,1,19,18_1,12,12,13,13,1,1,1,1,1,1,19,1,1,1,1,1,1,18,18,18,18_12,13,13,13,13,13,13,19,19,19,19,19,19,19,19,19,18,18,18,18,18,18_13,13,13,13,13,13,13,19,19,19,19,19,19,19,19,19,18,18,18,18,18,18_18,18,19,19,13,13,13,13,13,13,13,13,19,19,19,19,18,18,18,18,18,18_18,18,19,19,13,13,13,13,13,13,13,13,19,19,19,19,18,18,18,18,18,18_18,18,19,19,19,19,19,19,19,19,19,19,13,13,13,13,18,18,18,18,18,18_18,18,18,19,19,19,19,19,19,19,19,19,13,13,13,13,18,18,18,18,18,18_18,18,18,18,19,19,19,19,19,19,13,13,13,13,12,12,12,18,18,18,18,18_18,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,12,18,18,18,18,18_18,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,12,18,18,18,18,18_1,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,12,12,12,12,18,18_1,18,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,12,12,12,18,18_1,18,18,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,12,12,18,18'
  //       .split('_')
  //       .map((x) => x.split(',').map((x) => +x))
  //   const firstColor = PUMPKIN_PATTERN[0]![0]!
  //   try {
  //     main: while (true) {
  //       const claimed = new Set(
  //         (
  //           await retry(
  //             () =>
  //               fetch(
  //                 'https://backend.wplace.live/event/hallowen/pumpkins/claimed',
  //                 {
  //                   credentials: 'include',
  //                 },
  //               ).then((x) => x.json()) as Promise<{ claimed: number[] }>,
  //             10,
  //             10_000,
  //           )
  //         ).claimed,
  //       )
  //       const pumpkinsFound = Object.entries(
  //         (await retry(
  //           () =>
  //             fetch('https://wplace.samuelscheit.com/tiles/pumpkin.json').then(
  //               (x) => x.json(),
  //             ),
  //           10,
  //           10_000,
  //         )) as Record<
  //           string,
  //           {
  //             foundAt: string
  //             lat: number
  //             lng: number
  //             offsetX: number
  //             offsetY: number
  //             tileX: number
  //             tileY: number
  //           }
  //         >,
  //       )

  //       for (const [index, pumpkin] of pumpkinsFound) {
  //         if (claimed.size === 100) {
  //           this.$pumpkinHunt.textContent = `Pumpkin Hunt Finished!`
  //           break main
  //         }
  //         this.$pumpkinHunt.textContent = `⌛ Pumpkin Hunt [${claimed.size}/100]`
  //         if (
  //           claimed.has(+index) ||
  //           Date.now() - new Date(pumpkin.foundAt).getTime() > 3_600_000
  //         )
  //           continue

  //         const { pixels } = await retry(
  //           () =>
  //             Pixels.fromJSON(this.bot, {
  //               url: `https://backend.wplace.live/files/s0/tiles/${pumpkin.tileX}/${pumpkin.tileY}.png`,
  //               exactColor: true,
  //             }),
  //           10,
  //           10_000,
  //         )
  //         for (let x = 0; x < 1000; x++) {
  //           nextPixel: for (let y = 0; y < 1000; y++) {
  //             if (pixels[y]![x] !== firstColor) continue
  //             for (let offsetY = 0; offsetY < PUMPKIN_PATTERN.length; offsetY++)
  //               for (
  //                 let offsetX = 0;
  //                 offsetX < PUMPKIN_PATTERN[offsetY]!.length;
  //                 offsetX++
  //               )
  //                 if (
  //                   pixels[y + offsetY]![x + offsetX]! !==
  //                   PUMPKIN_PATTERN[offsetY]![offsetX]!
  //                 )
  //                   continue nextPixel

  //             // Pattern found, check if it's real and click it
  //             const info = await retry(
  //               () =>
  //                 fetch(
  //                   `https://backend.wplace.live/s0/pixel/${pumpkin.tileX}/${pumpkin.tileY}?x=${x + 10}&y=${y + 10}`,
  //                 ).then((x) => x.json()) as Promise<{
  //                   paintedBy: { event?: boolean; eventClaimNumber?: number }
  //                 }>,
  //               3,
  //               10_000,
  //             )
  //             if (!info.paintedBy.event) continue
  //             await retry(
  //               async () => {
  //                 const response = await fetch(
  //                   `https://backend.wplace.live/s0/event/pixel/claim`,
  //                   {
  //                     credentials: 'include',
  //                     body: JSON.stringify({
  //                       event: 'halloween',
  //                       tx: pumpkin.tileX,
  //                       ty: pumpkin.tileY,
  //                       px: x + 10,
  //                       py: y + 10,
  //                     }),
  //                     method: 'POST',
  //                   },
  //                 )
  //                 if (!response.ok) throw new Error('CAN NOT CLAIM')
  //               },
  //               3,
  //               10_000,
  //             )
  //             claimed.add(+index)
  //           }
  //         }
  //         await wait(5000)
  //       }
  //       this.$pumpkinHunt.textContent = `⌛ Pumpkin Hunt (wait 10 min)`
  //       await wait(10 * 1000 * 60)
  //     }
  //   } catch (error) {
  //     this.$pumpkinHunt.disabled = false
  //     this.$pumpkinHunt.textContent = `❌ Pumpkin Hunt!`
  //   }
  // }
}
