/*
 ######   ##     ##         ##     ## #### ##    ## #### ##     ##    ###    ########  
##    ##  ##     ##         ###   ###  ##  ###   ##  ##  ###   ###   ## ##   ##     ## 
##        ##     ##         #### ####  ##  ####  ##  ##  #### ####  ##   ##  ##     ## 
##   #### ######### ####### ## ### ##  ##  ## ## ##  ##  ## ### ## ##     ## ########  
##    ##  ##     ##         ##     ##  ##  ##  ####  ##  ##     ## ######### ##        
##    ##  ##     ##         ##     ##  ##  ##   ###  ##  ##     ## ##     ## ##        
 ######   ##     ##         ##     ## #### ##    ## #### ##     ## ##     ## ##        
*/

const tableMemo = new WeakSet()

const main = () => {
  const table = document.querySelector(`table.highlight`)
  if (!table || tableMemo.has(table)) {
    return
  }
  tableMemo.add(table)
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
  update()
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
  container.addEventListener(`mousemove`, scroll)
  const stopDrag = () => void (dragging = false)
  container.addEventListener(`mousedown`, e => {
    e.preventDefault()
    dragging = true
    scroll(e)
  })
  document.addEventListener(`mouseup`, stopDrag)
  document.body.addEventListener(`mouseout`, e => {
    if (e.relatedTarget !== document.querySelector(`html`)) {
      return
    }
    dragging = false
  })
  window.addEventListener(`scroll`, update)
  document.styleSheets[0].insertRule(`@media (max-width: ${table.closest(`.file`).offsetWidth +
    (width + 2) * 2}px) {
    .__minimap {
      border-left: 1px solid rgba(0, 0, 0, .1);
    }
  }`)
}

main()

const observer = new MutationObserver(() => void main())
observer.observe(document.querySelector(`.application-main`), { childList: true, subtree: true })
