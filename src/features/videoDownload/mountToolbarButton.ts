const BUTTON_ID = 'bewly-video-download-btn'
const STYLE_ID = 'bewly-video-download-style'
const MOUNT_THROTTLE_MS = 400

const TOOLBAR_SELECTORS = [
  '.video-toolbar-left',
  '.video-toolbar-container .toolbar-left',
  '#arc_toolbar_report .video-toolbar-left',
]

/** Keep this list small — never observe large page roots. */
const OBSERVE_ANCHOR_SELECTORS = [
  '#arc_toolbar_report',
  '.video-toolbar-container',
]

function ensureStyle() {
  if (document.getElementById(STYLE_ID))
    return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    #${BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 12px;
      padding: 0 12px;
      height: 30px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: var(--bew-theme-color, #00a1d6);
      background: color-mix(in srgb, var(--bew-theme-color, #00a1d6) 12%, transparent);
      vertical-align: middle;
      white-space: nowrap;
    }
    #${BUTTON_ID}:hover {
      background: color-mix(in srgb, var(--bew-theme-color, #00a1d6) 22%, transparent);
    }
    #${BUTTON_ID}:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `
  document.documentElement.appendChild(style)
}

function readPageMeta() {
  const path = location.pathname
  const bvid = path.match(/\/video\/(BV\w+)/i)?.[1]
  const aidMatch = path.match(/\/video\/av(\d+)/i)
  const aid = aidMatch ? Number(aidMatch[1]) : undefined
  const page = Number(new URL(location.href).searchParams.get('p') || 1)
  const title = document.title
    .replace(/_哔哩哔哩_bilibili$/i, '')
    .replace(/_哔哩哔哩.*$/, '')
    .replace(/-哔哩哔哩.*$/, '')
    .trim() || 'bilibili_video'

  return { title, bvid, aid, page }
}

async function handleClick(btn: HTMLButtonElement) {
  if (btn.disabled)
    return

  const original = btn.textContent
  btn.disabled = true

  try {
    const { mergeDownloadLazy } = await import('./loadMergeDownload')
    const meta = readPageMeta()
    await mergeDownloadLazy({
      ...meta,
      onProgress: (msg) => {
        btn.textContent = msg
      },
    })
    btn.textContent = '下载完成'
  }
  catch (error: any) {
    console.error('[BewlyBewly] video download failed', error)
    btn.textContent = error?.message || '下载失败'
  }
  finally {
    setTimeout(() => {
      btn.disabled = false
      btn.textContent = original || '合并下载'
    }, 2000)
  }
}

function createButton() {
  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.type = 'button'
  btn.textContent = '合并下载'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    handleClick(btn)
  })
  return btn
}

function findToolbar(): HTMLElement | null {
  for (const selector of TOOLBAR_SELECTORS) {
    const el = document.querySelector(selector)
    if (el)
      return el as HTMLElement
  }
  return null
}

function findObserveAnchor(): HTMLElement | null {
  for (const selector of OBSERVE_ANCHOR_SELECTORS) {
    const el = document.querySelector(selector)
    if (el)
      return el as HTMLElement
  }
  return null
}

let observer: MutationObserver | null = null
let observedNode: HTMLElement | null = null
let historyHandler: (() => void) | null = null
let throttleTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function stopWatching() {
  observer?.disconnect()
  observer = null
  observedNode = null
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (throttleTimer) {
    clearTimeout(throttleTimer)
    throttleTimer = null
  }
}

function mountButton(): boolean {
  ensureStyle()
  if (document.getElementById(BUTTON_ID))
    return true

  const toolbar = findToolbar()
  if (!toolbar)
    return false

  toolbar.appendChild(createButton())
  return true
}

function tryMount() {
  if (!/bilibili\.com\/(?:video|list)\//.test(location.href)) {
    document.getElementById(BUTTON_ID)?.remove()
    stopWatching()
    return
  }

  if (mountButton()) {
    // Button is in place — stop observing to avoid scroll/interaction jank.
    stopWatching()
    return
  }

  bindObserver()
}

function scheduleTryMount() {
  if (throttleTimer)
    return
  throttleTimer = setTimeout(() => {
    throttleTimer = null
    tryMount()
  }, MOUNT_THROTTLE_MS)
}

function bindObserver() {
  const anchor = findObserveAnchor()
  if (observer && observedNode && anchor && observedNode === anchor)
    return

  observer?.disconnect()
  observer = null
  observedNode = null

  if (!anchor) {
    if (!pollTimer) {
      let tries = 0
      pollTimer = setInterval(() => {
        tries += 1
        if (mountButton() || tries >= 20) {
          stopWatching()
        }
        else if (findObserveAnchor()) {
          scheduleTryMount()
        }
      }, 500)
    }
    return
  }

  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  observedNode = anchor
  observer = new MutationObserver(() => scheduleTryMount())
  observer.observe(anchor, { childList: true, subtree: true })
}

export function setupVideoPageDownloadButton() {
  tryMount()

  if (!historyHandler) {
    historyHandler = () => {
      document.getElementById(BUTTON_ID)?.remove()
      stopWatching()
      setTimeout(tryMount, 500)
    }
    window.addEventListener('historyChange', historyHandler)
  }
}

export function teardownVideoPageDownloadButton() {
  stopWatching()
  if (historyHandler) {
    window.removeEventListener('historyChange', historyHandler)
    historyHandler = null
  }
  document.getElementById(BUTTON_ID)?.remove()
}
