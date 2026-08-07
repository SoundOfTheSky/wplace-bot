export const SID = Array.from({ length: 16 }, () =>
  ((10 + Math.random() * 26) | 0).toString(36),
).join('')

export function obfucsateHTML(html: unknown): string {
  return (html as string).replace(/class="([^"]*)"/g, (_, classes: string) => {
    const prefixed = classes
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => `${SID}${c}`)
      .join(' ')
    return `class="${prefixed}"`
  })
}

export function obfuscateLocalCSS(css: string) {
  return css.replaceAll(/\.([a-z])/g, `.${SID}$1`)
}

export function obfuscateCSS(css: string) {
  const [global, local] = css.split('/** LOCAL STYLES */')
  return global + '\n' + obfuscateLocalCSS(local)
}

export function toggleClass(el: HTMLElement, className: string) {
  return el.classList.toggle(SID + className)
}

export function addClass(el: HTMLElement, className: string) {
  el.classList.add(SID + className)
}

export function removeClass(el: HTMLElement, className: string) {
  el.classList.remove(SID + className)
}

export function containsClass(el: HTMLElement, className: string) {
  return el.classList.contains(SID + className)
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function querySelector<T extends Element>(
  el: HTMLElement,
  selector: string,
) {
  if (selector === '.topbar') console.log(el, obfuscateLocalCSS(selector))
  return el.querySelector<T>(obfuscateLocalCSS(selector))
}

export function querySelectorAll<T extends Element>(
  el: HTMLElement,
  selector: string,
) {
  return el.querySelectorAll<T>(obfuscateLocalCSS(selector))
}
