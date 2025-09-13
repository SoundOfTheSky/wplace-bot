import { promisifyEventSource, swap } from '@softsky/utils'

import { Base } from './base'
import { WPlaceBot } from './bot'
import { NoImageError, WPlaceBotError } from './errors'
import { BotImage } from './image'
import { Pixels } from './pixels'
import html from './widget.html' with { type: 'text' }
import { WorldPosition } from './world-position'

export enum BotStrategy {
  ALL = 'ALL',
  PERCENTAGE = 'PERCENTAGE',
  SEQUENTIAL = 'SEQUENTIAL',
}

/** Widget UI with buttons */
export class Widget extends Base {
  public readonly element = document.createElement('div')

  public x = 64

  public y = 64

  public get status(): string {
    return this.$status.innerHTML
  }

  public set status(value: string) {
    this.$status.innerHTML = value
  }

  /** Strategy how to distribute draw calls between images */
  public strategy = BotStrategy.SEQUENTIAL

  /** Images on canvas */
  public images: BotImage[] = []

  /** Moving widget */
  protected moveInfo?: {
    x: number
    y: number
    originalX: number
    originalY: number
  }

  protected readonly $settings!: HTMLDivElement
  protected readonly $status!: HTMLDivElement
  protected readonly $minimize!: HTMLButtonElement
  protected readonly $topbar!: HTMLDivElement
  protected readonly $draw!: HTMLButtonElement
  protected readonly $addImage!: HTMLButtonElement
  protected readonly $strategy!: HTMLInputElement
  protected readonly $progressLine!: HTMLDivElement
  protected readonly $progressText!: HTMLSpanElement
  protected readonly $images!: HTMLDivElement

  public constructor(protected bot: WPlaceBot) {
    super()
    this.element.classList.add('wwidget')
    this.element.innerHTML = html as unknown as string
    document.body.append(this.element)

    this.populateElementsWithSelector(this.element, {
      $settings: '.wsettings',
      $status: '.wstatus',
      $minimize: '.minimize',
      $topbar: '.wtopbar',
      $draw: '.draw',
      $addImage: '.add-image',
      $strategy: '.strategy',
      $progressLine: '.progress div',
      $progressText: '.progress span',
      $images: '.images',
    })

    // Move/minimize
    this.$minimize.addEventListener('click', () => {
      this.minimize()
    })
    this.$topbar.addEventListener('mousedown', (event) => {
      this.moveStart(event.clientX, event.clientY)
    })
    this.registerEvent(document, 'mouseup', () => {
      this.moveStop()
    })
    this.registerEvent(document, 'mousemove', (event) => {
      if (this.moveInfo)
        this.move((event as MouseEvent).clientX, (event as MouseEvent).clientY)
      this.element.style.transform = `translate(${this.x}px, ${this.y}px)`
    })
    this.element.style.transform = `translate(${this.x}px, ${this.y}px)`

    // Button actions
    this.$draw.addEventListener('click', () => this.bot.draw())
    this.$addImage.addEventListener('click', () => this.addImage())
    this.$strategy.addEventListener('change', () => {
      this.strategy = this.$strategy.value as BotStrategy
    })

    this.update()
  }

  /** Add image handler */
  public addImage() {
    this.setDisabled('add-image', true)
    return this.run(
      'Adding image',
      async () => {
        await this.bot.updateColors()
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*,.wbot'
        input.click()
        await promisifyEventSource(input, ['change'], ['cancel', 'error'])
        const file = input.files?.[0]
        if (!file) throw new NoImageError(this.bot)
        let botImage
        if (file.name.endsWith('.wbot')) {
          botImage = await BotImage.fromJSON(
            this.bot,
            JSON.parse(await file.text()) as ReturnType<BotImage['toJSON']>,
          )
        } else {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          await promisifyEventSource(reader, ['load'], ['error'])
          const image = new Image()
          image.src = reader.result as string
          await promisifyEventSource(image, ['load'], ['error'])
          botImage = new BotImage(
            this.bot,
            WorldPosition.fromScreenPosition(this.bot, {
              x: 256,
              y: 32,
            }),
            new Pixels(this.bot, image),
          )
        }
        this.images.push(botImage)
        await botImage.updateTasks()
        this.bot.save()
      },
      () => {
        this.setDisabled('add-image', false)
      },
    )
  }

  /** Update widget position and contents */
  public update() {
    this.$strategy.value = this.strategy
    // Progress
    let maxTasks = 0
    let totalTasks = 0
    for (let index = 0; index < this.images.length; index++) {
      const image = this.images[index]!
      maxTasks += image.pixels.pixels.length * image.pixels.pixels[0]!.length
      totalTasks += image.tasks.length
    }
    const doneTasks = maxTasks - totalTasks
    const percent = ((doneTasks / maxTasks) * 100) | 0
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${(totalTasks / 120) | 0}h`
    this.$progressLine.style.transform = `scaleX(${percent}%)`

    // Images
    this.$images.innerHTML = ''
    for (let index = 0; index < this.images.length; index++) {
      const image = this.images[index]!
      const $image = document.createElement('div')
      this.$images.append($image)
      $image.className = 'image'
      $image.innerHTML = `<img src="${image.pixels.image.src}">
  <button class="up" title="Move up" ${index === 0 ? 'disabled' : ''}>▴</button>
  <button class="down" title="Move down" ${index === this.images.length - 1 ? 'disabled' : ''}>▾</button>
  <button class="delete" title="Move delete">X</button>`
      $image
        .querySelector<HTMLButtonElement>('img')!
        .addEventListener('click', () => {
          image.position.scrollScreenTo()
        })
      $image
        .querySelector<HTMLButtonElement>('.up')!
        .addEventListener('click', () => {
          swap(this.images, index, index - 1)
          this.update()
          this.bot.save()
        })
      $image
        .querySelector<HTMLButtonElement>('.down')!
        .addEventListener('click', () => {
          swap(this.images, index, index + 1)
          this.update()
          this.bot.save()
        })
      $image
        .querySelector<HTMLButtonElement>('.delete')!
        .addEventListener('click', () => {
          this.images.splice(index, 1)
          image.destroy()
          this.update()
          this.bot.save()
        })
    }
  }

  /** Update images position and contents */
  public updateImages() {
    for (let index = 0; index < this.images.length; index++)
      this.images[index]!.update()
  }

  /** Disable/enable element by class name */
  public setDisabled(name: string, disabled: boolean) {
    this.element.querySelector<HTMLButtonElement>('.' + name)!.disabled =
      disabled
  }

  /** Show status of running task */
  public async run<T>(
    status: string,
    run: () => Promise<T>,
    fin?: () => unknown,
    emoji = '⌛',
  ): Promise<T> {
    const originalStatus = this.status
    this.status = `${emoji} ${status}`
    try {
      const result = await run()
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

  public toJSON() {
    return {
      x: this.x,
      y: this.y,
      images: this.images.map((x) => x.toJSON()),
      strategy: this.strategy,
    }
  }

  /** Hides content */
  protected minimize() {
    this.$settings.classList.toggle('hidden')
  }

  /** movestart handler */
  protected moveStart(x: number, y: number) {
    this.moveInfo = {
      x: this.x,
      y: this.y,
      originalX: x,
      originalY: y,
    }
  }

  /** movestop handler */
  protected moveStop() {
    this.moveInfo = undefined
  }

  /** move handler */
  protected move(x: number, y: number) {
    if (!this.moveInfo) return
    this.x = this.moveInfo.x + x - this.moveInfo.originalX
    this.y = this.moveInfo.y + y - this.moveInfo.originalY
  }
}
