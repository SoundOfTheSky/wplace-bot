import { Base } from './base'
import { type WPlaceBot } from './bot'
import { BotImage, ImageStrategy, UnownedColorStrategy } from './image'
import { save } from './save'
import { SEVEN_SEALS_POSITIONS } from './seven-seals-positions'
// @ts-ignore
import css from './seven-seals.css' with { type: 'text' }
// @ts-ignore
import html from './seven-seals.html' with { type: 'text' }
// @ts-ignore
import sharedCss from './shared.css' with { type: 'text' }

/** One fragment as reported by the event endpoint. */
type Copy = {
  index: number
  opensAt: string
  totalPixels: number
  paintedPixels: number
  completedAt: string | null
}

type Payload = {
  startsAt: string
  endsAt: string
  copies: Copy[]
}

type Status = 'open' | 'locked' | 'complete' | 'unknown'

type Fragment = {
  id: number
  seal: number
  numeral: string
  /** Position of the fragment inside its seal, starting at 1 */
  n: number
  copy: Copy | null
  status: Status
  progress: number
  remaining: number
  imported: boolean
}

type SealGroup = { seal: number; numeral: string; fragments: Fragment[] }

const SEALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const
const PER_SEAL = 24
const FRAGMENTS = SEALS.length * PER_SEAL
const ENDPOINT = 'https://backend.wplace.live/seven-seals'
const TEMPLATE = '/img/seven-seals/seal-'
const TILE = 1000
const IMAGE_WIDTH = 1000
const IMAGE_HEIGHT = 2000

const STATUS_TEXT: Record<Status, string> = {
  open: 'in progress',
  locked: 'not opened',
  complete: 'complete',
  unknown: 'unknown',
}

/**
 * Import panel for the Seven Seals event: 7 seals (I..VII) of 24 fragments.
 * Lists every fragment grouped by seal with its live status, so a fragment can
 * be picked by series instead of by typing an id.
 */
export class SevenSeals extends Base {
  protected readonly $seals!: HTMLDivElement
  protected readonly $sub!: HTMLDivElement
  protected readonly $chips!: HTMLDivElement
  protected readonly $query!: HTMLInputElement
  protected readonly $only!: HTMLInputElement
  protected readonly $body!: HTMLDivElement
  protected readonly $foot!: HTMLDivElement
  protected readonly $refresh!: HTMLButtonElement
  protected readonly $close!: HTMLButtonElement

  protected payload: Payload | null = null
  protected model: SealGroup[] = []
  protected byId = new Map<number, Copy>()
  protected loading = false
  protected error = ''
  protected updatedAt = 0
  protected query = ''
  protected onlyImportable = false
  protected sealFilter = 0
  protected autoScrolled = false
  protected readonly busy = new Set<number>()
  protected foot: { ok: boolean; text: string } | null = null

  public constructor(protected bot: WPlaceBot) {
    super(html as unknown as string, `${sharedCss as string}\n${css as string}`)
    this.populateElementsWithSelector({
      $seals: '.seals',
      $sub: '.sub',
      $chips: '.chips',
      $query: '.query',
      $only: '.only',
      $body: '.body',
      $foot: '.foot',
      $refresh: '.refresh',
      $close: '.close',
    })

    this.registerEvent(this.$refresh, 'click', () => void this.refresh())
    this.registerEvent(this.$close, 'click', () => this.hide())
    this.registerEvent(this.$query, 'input', () => {
      this.query = this.$query.value.trim()
      this.render()
    })
    this.registerEvent(this.$only, 'change', () => {
      this.onlyImportable = this.$only.checked
      this.render()
    })
    this.registerEvent(this.$chips, 'click', (event: MouseEvent) => {
      const chip = (event.target as HTMLElement | null)?.closest('[data-seal]')
      if (!chip) return
      const seal = Number((chip as HTMLElement).dataset.seal) || 0
      this.sealFilter = this.sealFilter === seal ? 0 : seal
      this.render()
    })
    this.registerEvent(this.$body, 'click', (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('[data-import]')
      if (!button) return
      void this.import(Number((button as HTMLElement).dataset.import))
    })
    this.registerEvent(this.shadow, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.hide()
    })
  }

  public get opened() {
    return !this.$seals.hidden
  }

  public show() {
    this.$seals.hidden = false
    this.$query.focus()
    if (this.model.length === 0 && !this.loading) void this.refresh()
    else this.render()
  }

  public hide() {
    this.$seals.hidden = true
  }

  public toggle() {
    if (this.opened) this.hide()
    else this.show()
  }

  /** Fragment id -> seal index (1-based). */
  protected static sealOf(id: number) {
    return Math.min(SEALS.length, Math.max(1, Math.ceil(id / PER_SEAL)))
  }

  protected static fragmentOf(id: number) {
    return ((id - 1) % PER_SEAL) + 1
  }

  /** Image name kept stable so already imported fragments are recognised. */
  protected static imageName(id: number) {
    return `Seven Seals ${SevenSeals.sealOf(id)}-${SevenSeals.fragmentOf(id)} (#${id})`
  }

  protected static statusOf(copy: Copy | null, now: number): Status {
    if (!copy) return 'unknown'
    if (copy.completedAt || copy.paintedPixels >= copy.totalPixels) return 'complete'
    if (new Date(copy.opensAt).getTime() > now) return 'locked'
    return 'open'
  }

  protected isImported(id: number) {
    const name = SevenSeals.imageName(id)
    return this.bot.images.some((image) => image.name === name)
  }

  protected buildModel(payload: Payload, now: number) {
    this.byId.clear()
    for (const copy of payload.copies) this.byId.set(copy.index, copy)

    const model: SealGroup[] = []
    for (let seal = 1; seal <= SEALS.length; seal++) {
      const numeral = SEALS[seal - 1] ?? ''
      const fragments: Fragment[] = []
      for (let n = 1; n <= PER_SEAL; n++) {
        const id = (seal - 1) * PER_SEAL + n
        const copy = this.byId.get(id) ?? null
        const total = copy?.totalPixels ?? 0
        const painted = copy?.paintedPixels ?? 0
        fragments.push({
          id,
          seal,
          numeral,
          n,
          copy,
          status: SevenSeals.statusOf(copy, now),
          progress: total > 0 ? Math.min(1, painted / total) : 0,
          remaining: Math.max(0, total - painted),
          imported: this.isImported(id),
        })
      }
      model.push({ seal, numeral, fragments })
    }
    this.model = model
  }

  protected counts() {
    let open = 0
    let locked = 0
    let complete = 0
    let unknown = 0
    let imported = 0
    for (const group of this.model)
      for (const fragment of group.fragments) {
        if (fragment.status === 'open') open++
        else if (fragment.status === 'locked') locked++
        else if (fragment.status === 'complete') complete++
        else unknown++
        if (fragment.imported) imported++
      }
    return { open, locked, complete, unknown, imported, total: FRAGMENTS }
  }

  protected static importable(group: SealGroup) {
    let count = 0
    for (const fragment of group.fragments)
      if (fragment.status === 'open' && !fragment.imported) count++
    return count
  }

  protected static pixels(value: number) {
    if (!Number.isFinite(value)) return '?'
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
    return String(value)
  }

  protected static eventWindow(payload: Payload | null) {
    if (!payload) return ''
    const format = (value: string) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    const from = format(payload.startsAt)
    const to = format(payload.endsAt)
    return from && to ? `${from} – ${to}` : ''
  }

  protected static ago(timestamp: number) {
    if (!timestamp) return ''
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
    if (seconds < 5) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    return `${Math.round(seconds / 60)}m ago`
  }

  protected static element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = '',
    text?: string,
  ) {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
  }

  // ------------------------------------------------------------------ fetching

  public async refresh() {
    if (this.loading) return
    this.loading = true
    this.error = ''
    this.foot = null
    this.render()
    try {
      const response = await fetch(ENDPOINT, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`Event API HTTP ${response.status}`)
      const payload = (await response.json()) as Payload
      if (!Array.isArray(payload.copies)) throw new Error('Unexpected event response')
      this.payload = payload
      this.buildModel(payload, Date.now())
      this.updatedAt = Date.now()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.error('[Seven Seals]', error)
    } finally {
      this.loading = false
      this.render()
      if (!this.autoScrolled && this.model.length > 0) {
        this.autoScrolled = true
        this.scrollToFirstImportable()
      }
    }
  }

  /** Jump to the first seal that still has something to import. */
  protected scrollToFirstImportable() {
    if (this.sealFilter || this.query || this.onlyImportable) return
    const first = this.model.find((group) => SevenSeals.importable(group) > 0)
    if (!first) return
    const section = this.$body.querySelector(`.seal[data-seal="${first.seal}"]`)
    try {
      section?.scrollIntoView({ block: 'start' })
    } catch {
      // Some embedded browsers do not implement scrollIntoView.
    }
  }

  // ----------------------------------------------------------------- rendering

  protected filterMatch(fragment: Fragment) {
    if (this.sealFilter && fragment.seal !== this.sealFilter) return false
    if (this.onlyImportable && (fragment.status !== 'open' || fragment.imported)) return false
    const query = this.query.toLowerCase()
    if (!query) return true
    const haystack = [
      `#${fragment.id}`,
      String(fragment.id),
      fragment.numeral,
      `${fragment.numeral}-${fragment.n}`,
      `${fragment.numeral} ${fragment.n}`,
      SevenSeals.imageName(fragment.id),
    ]
      .join(' ')
      .toLowerCase()
    return query.split(/\s+/).every((token) => haystack.includes(token))
  }

  protected renderRow(fragment: Fragment) {
    const row = SevenSeals.element('div', `row st-${fragment.status}`)
    row.dataset.fragment = String(fragment.id)
    if (fragment.imported) row.classList.add('imported')

    row.append(
      SevenSeals.element('span', 'id', `#${fragment.id}`),
      SevenSeals.element('span', 'tag', `${fragment.numeral}-${fragment.n}`),
    )

    const pill = SevenSeals.element(
      'span',
      `pill p-${fragment.status}`,
      STATUS_TEXT[fragment.status],
    )
    row.append(pill)

    const bar = SevenSeals.element('div', 'bar')
    const fill = document.createElement('i')
    fill.style.width = `${Math.round(fragment.progress * 100)}%`
    bar.append(fill)
    row.append(bar)

    row.append(SevenSeals.element('span', 'pct', `${Math.round(fragment.progress * 100)}%`))

    const action = SevenSeals.element('div', 'act')
    if (fragment.imported) {
      action.textContent = 'imported'
    } else if (fragment.status === 'open') {
      const busy = this.busy.has(fragment.id)
      const button = SevenSeals.element('button', '', busy ? '…' : 'Import')
      button.type = 'button'
      button.dataset.import = String(fragment.id)
      button.disabled = busy
      button.title =
        `Seal ${fragment.numeral}, fragment ${fragment.n} · ` +
        `${SevenSeals.pixels(fragment.remaining)} pixels left`
      action.append(button)
    } else if (fragment.status === 'locked' && fragment.copy) {
      action.textContent = 'locked'
      action.title = `Opens ${new Date(fragment.copy.opensAt).toLocaleString()}`
    } else {
      action.textContent = '—'
    }
    row.append(action)
    return row
  }

  protected renderChips() {
    this.$chips.textContent = ''
    if (this.model.length === 0) return
    const counts = this.counts()

    const make = (value: number, label: string, note: string) => {
      const chip = SevenSeals.element('button', 'chip', label)
      chip.type = 'button'
      chip.dataset.seal = String(value)
      chip.setAttribute('aria-pressed', String(this.sealFilter === value))
      chip.append(SevenSeals.element('span', 'n', note))
      this.$chips.append(chip)
    }
    make(0, 'All seal series', `${counts.open} open`)
    for (const group of this.model)
      make(group.seal, group.numeral, String(SevenSeals.importable(group)))
  }

  protected renderBody() {
    this.$body.textContent = ''
    if (this.model.length === 0) {
      this.$body.append(
        SevenSeals.element('div', 'empty', this.loading ? 'Loading event data…' : ''),
      )
      return
    }

    const fragment = document.createDocumentFragment()
    let visible = 0
    for (const group of this.model) {
      if (this.sealFilter && group.seal !== this.sealFilter) continue

      const rows: HTMLDivElement[] = []
      for (const item of group.fragments) {
        const row = this.renderRow(item)
        if (this.filterMatch(item)) visible++
        else row.hidden = true
        rows.push(row)
      }

      const section = SevenSeals.element('section', 'seal')
      section.dataset.seal = String(group.seal)
      const title = SevenSeals.element('h3', '', `Seal ${group.numeral}`)
      const firstId = (group.seal - 1) * PER_SEAL + 1
      const lastId = group.seal * PER_SEAL
      title.append(
        SevenSeals.element(
          'span',
          'meta',
          `fragments ${firstId}–${lastId} · ${SevenSeals.importable(group)} importable`,
        ),
      )
      section.append(title, ...rows)
      fragment.append(section)
    }

    if (visible === 0)
      fragment.append(SevenSeals.element('div', 'empty', 'No fragment matches the filter.'))
    this.$body.append(fragment)
  }

  protected renderFoot() {
    this.$foot.textContent = ''
    if (this.foot) {
      this.$foot.append(SevenSeals.element('span', this.foot.ok ? '' : 'err', this.foot.text))
      return
    }
    if (this.error) {
      this.$foot.append(SevenSeals.element('span', 'err', `Error: ${this.error}`))
      return
    }
    if (this.model.length === 0) {
      this.$foot.append(SevenSeals.element('span', '', this.loading ? 'Fetching event…' : 'Idle.'))
      return
    }
    const counts = this.counts()
    const window = SevenSeals.eventWindow(this.payload)
    this.$foot.append(
      SevenSeals.element(
        'span',
        '',
        `${counts.total} fragments · ${counts.open} open · ${counts.complete} complete · ` +
          `${counts.locked} locked · ${counts.imported} imported` +
          (window ? ` · ${window}` : '') +
          (this.updatedAt ? ` · updated ${SevenSeals.ago(this.updatedAt)}` : ''),
      ),
    )
  }

  protected render() {
    this.renderChips()
    this.renderBody()
    this.renderFoot()
    const counts = this.model.length > 0 ? this.counts() : null
    this.$sub.textContent = counts
      ? `${counts.open} open fragment${counts.open === 1 ? '' : 's'} · ` +
        `${SEALS.length} seals × ${PER_SEAL} fragments`
      : 'Live event status from wplace.live'
  }

  // ----------------------------------------------------------------- importing

  public async import(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > FRAGMENTS) return
    if (this.busy.has(id)) return

    const position = SEVEN_SEALS_POSITIONS[id - 1]
    if (!position) {
      this.foot = { ok: false, text: `No known position for fragment #${id}.` }
      this.render()
      return
    }

    const name = SevenSeals.imageName(id)
    if (this.isImported(id)) {
      this.foot = { ok: false, text: `${name} is already imported.` }
      this.render()
      return
    }

    const seal = SevenSeals.sealOf(id)
    this.busy.add(id)
    this.foot = { ok: true, text: `Importing ${name}…` }
    this.render()

    try {
      const image = await BotImage.fromJSON(this.bot, {
        url: `${location.origin}${TEMPLATE}${seal}.png`,
        position: [position[0] * TILE, position[1] * TILE] as const,
        width: IMAGE_WIDTH,
        brightness: 0,
        strategy: ImageStrategy.SPIRAL_TO_CENTER,
        opacity: 50,
        drawColorsInOrder: false,
        colors: [],
        disabledColors: [0],
        lock: true,
        disabled: false,
        name,
        unownedColorStrategy: UnownedColorStrategy.BUY,
      })

      // Never keep a template that is not the official size.
      if (image.width !== IMAGE_WIDTH || image.height !== IMAGE_HEIGHT) {
        image.destroy()
        throw new Error(`Unexpected template dimensions: ${image.width}x${image.height}`)
      }

      await save(this.bot)

      const fragment = this.model.flatMap((group) => group.fragments).find((item) => item.id === id)
      this.foot = {
        ok: true,
        text:
          `Imported ${name} — Seal ${SEALS[seal - 1] ?? ''}, ` +
          `fragment ${SevenSeals.fragmentOf(id)}` +
          (fragment ? `, ${SevenSeals.pixels(fragment.remaining)} pixels left` : '') +
          '. Move the map there, then Draw or Auto-Draw.',
      }
      if (this.payload) this.buildModel(this.payload, Date.now())
    } catch (error) {
      this.foot = {
        ok: false,
        text: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      }
      console.error('[Seven Seals]', error)
    } finally {
      this.busy.delete(id)
      this.render()
    }
  }
}
