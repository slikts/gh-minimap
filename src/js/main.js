/*
 ######   ##     ##         ##     ## #### ##    ## #### ##     ##    ###    ########  
##    ##  ##     ##         ###   ###  ##  ###   ##  ##  ###   ###   ## ##   ##     ## 
##        ##     ##         #### ####  ##  ####  ##  ##  #### ####  ##   ##  ##     ## 
##   #### ######### ####### ## ### ##  ##  ## ## ##  ##  ## ### ## ##     ## ########  
##    ##  ##     ##         ##     ##  ##  ##  ####  ##  ##     ## ######### ##        
##    ##  ##     ##         ##     ##  ##  ##   ###  ##  ##     ## ##     ## ##        
 ######   ##     ##         ##     ## #### ##    ## #### ##     ## ##     ## ##        
*/

const tableCache = new WeakMap()

const Listener = (target, eventType, handler, ...options) => ({
  on: () => void target.addEventListener(eventType, handler, ...options),
  off: () => void target.removeEventListener(eventType, handler, ...options),
})

const AutoListener = (...args) => {
  const { on, off } = Listener(...args)
  const [, , handler] = args
  return {
    off,
    on: () => {
      on()
      handler()
    },
  }
}

const toggle = (listeners, method) => {
  void listeners.forEach(listener => void listener[method]())
}
let lastTable
const main = () => {
  const table = document.querySelector(`table.highlight`)
  let listeners
  const setupListen = () => {
    toggle(listeners, `on`)
    lastTable = table
  }
  if (lastTable != null && table !== lastTable) {
    toggle(tableCache.get(lastTable), `off`)
    lastTable = null
  }
  if (!table) {
    return
  }
  if (tableCache.has(table)) {
    listeners = tableCache.get(table)
    setupListen()
    return
  }
  listeners = []
  const listen = (...args) => void listeners.push(Listener(...args))
  const listenAuto = (...args) => void listeners.push(AutoListener(...args))
  tableCache.set(table, listeners)
  const canvas = document.createElement(`canvas`)
  const minimap = document.createElement(`div`)
  minimap.classList.add(`__minimap`)
  const container = document.createElement(`div`)
  container.classList.add(`__minimap-container`)
  const focus = document.createElement(`div`)
  focus.classList.add(`__minimap-focus`)
  container.appendChild(focus)
  container.appendChild(canvas)
  minimap.style.backgroundColor = getComputedStyle(document.body).backgroundColor
  minimap.appendChild(container)
  const rows = table.querySelectorAll(`.blob-code-inner`)
  const heightFactor = 2
  const dummy = document.createElement(`span`)
  dummy.textContent = `m`
  rows[0].appendChild(dummy)
  const fontWidth = dummy.offsetWidth
  dummy.remove()
  const width = Math.ceil(table.offsetWidth / fontWidth) + 1
  const height = rows.length * (heightFactor + 1)
  const ctx = canvas.getContext(`2d`)
  canvas.width = width
  canvas.height = height
  minimap.style.width = `${width}px`
  const imageData = ctx.createImageData(width, height)
  const { data } = imageData

  const setPixel = ([r, g, b, a = 255], x, y) => {
    const i = (x + y * width) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  const parseColor = color => color.match(/\d+/g).map(x => +x)
  const colorCache = new Map()
  const getColor = node => parseColor(getComputedStyle(node).getPropertyValue(`color`))
  const getCachedColor = node => {
    const isText = node.nodeType === Node.TEXT_NODE
    const className = isText ? `` : node.className
    if (!colorCache.has(className)) {
      colorCache.set(className, getColor(isText ? node.parentNode : node))
    }
    return colorCache.get(className)
  }

  const minimapLineHeight = 3
  void [...rows].forEach(({ childNodes }, rowIndex) => {
    let offset = 0
    const y = rowIndex * minimapLineHeight
    for (let i = 0; i < childNodes.length; i += 1) {
      const node = childNodes[i]
      const text = node.textContent
      const color = getCachedColor(node)
      for (let j = 0; j < text.length; j += 1) {
        const x = offset + j
        if (x >= width) {
          break
        }
        if (text[j] === ` `) {
          continue
        }
        setPixel(color, x, y)
        setPixel(color, x, y + 1)
      }
      offset += text.length
      if (offset >= width) {
        break
      }
    }
  })

  ctx.putImageData(imageData, 0, 0)
  table.parentNode.insertBefore(minimap, table)

  const lineHeight = rows[0].offsetHeight

  const update = () => {
    const { top, bottom } = table.getBoundingClientRect()
    const minTop = Math.min(0, top)
    const line1 = Math.abs(Math.ceil(minTop / lineHeight))
    minimap.style.top = `${Math.max(top, 0)}px`
    focus.style.top = `${3 * line1}px`
    const off2 = Math.max(0, window.innerHeight - bottom)
    minimap.style.bottom = `${off2}px`
    const line2 = Math.ceil(
      Math.max(0, (bottom - table.offsetTop - window.innerHeight) / lineHeight),
    )
    focus.style.bottom = `${3 * (line2 + 2)}px`

    const scrolled = Math.min(1, Math.abs(minTop / (table.offsetHeight - window.innerHeight)))
    container.style.marginTop =
      height > minimap.offsetHeight ? `${(-height + minimap.offsetHeight) * scrolled}px` : 0
  }

  let dragging = false
  const scroll = e => {
    if (!dragging) {
      return
    }
    const tableOffset = table.getBoundingClientRect().top + window.pageYOffset
    const line = Math.floor(e.offsetY / minimapLineHeight)
    const minScroll = tableOffset
    const maxScroll = tableOffset + table.offsetHeight - window.innerHeight
    const lineScroll = tableOffset + line * lineHeight - window.innerHeight / 2
    window.scrollTo(window.scrollX, Math.min(maxScroll, Math.max(minScroll, lineScroll)))
  }
  listen(container, `mousemove`, scroll)
  const stopDrag = () => void (dragging = false)

  listen(container, `mousedown`, e => {
    e.preventDefault()
    dragging = true
    scroll(e)
  })
  listen(document, `mouseup`, stopDrag)
  listen(document, `mouseout`, e => {
    if (e.relatedTarget !== document.querySelector(`html`)) {
      return
    }
    dragging = false
  })
  listenAuto(window, `scroll`, update)
  window.requestAnimationFrame(update)
  document.styleSheets[0].insertRule(`@media (max-width: ${table.closest(`.file`).offsetWidth +
    (width + 2) * 2}px) {
    .__minimap {
      border-left: 1px solid rgba(0, 0, 0, .1);
    }
  }`)

  const highlight = document.createElement(`div`)
  highlight.classList.add(`__minimap-highlight`)
  container.appendChild(highlight)
  const updateHighlight = () => {
    const { hash } = window.location
    if (!hash) {
      return
    }
    const [a, b = a + 1] = hash.match(/\d+/g).map(x => +x - 1)
    highlight.style.top = `${a * minimapLineHeight}px`
    highlight.style.height = `${(b - a) * minimapLineHeight}px`
  }
  listenAuto(window, `hashchange`, updateHighlight, false)

  setupListen()
}

main()

let lastPath
new MutationObserver(() => {
  const { pathname } = window.location
  if (pathname === lastPath) {
    return
  }
  lastPath = pathname
  main()
}).observe(document.querySelector(`.application-main`), { childList: true, subtree: true })
