import { type AnyFunction } from '@softsky/utils'

export class Base {
  public readonly element = document.createElement('div')
  public readonly shadow = this.element.attachShadow({ mode: 'open' })

  public constructor(html: string, css: string) {
    const style = document.createElement('style')
    style.textContent = css
    this.shadow.append(style)
    const template = document.createElement('template')
    template.innerHTML = html as string
    this.shadow.append(template.content)
    document.body.append(this.element)
  }

  protected runOnDestroy: AnyFunction[] = []

  /** Will run all runOnDestroy functions and unregister from all events */
  public destroy() {
    this.element.remove()
    for (let index = 0; index < this.runOnDestroy.length; index++) this.runOnDestroy[index]!()
  }

  /** Build object with all found objects via querySelector */
  protected populateElementsWithSelector(selectors: Record<string, string>) {
    for (const key in selectors) {
      ;(this as unknown as Record<string, HTMLElement>)[key] = this.shadow.querySelector(
        selectors[key]!,
      )!
    }
  }

  /**
   * Register autocleared event handler.
   * If using classes methods don't forget to `bind(this)`
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  protected registerEvent<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
    options: AddEventListenerOptions = {},
  ): void {
    options.passive ??= true
    target.addEventListener(type, listener as EventListener, options)
    this.runOnDestroy.push(() => {
      target.removeEventListener(type, listener as EventListener)
    })
  }
}
