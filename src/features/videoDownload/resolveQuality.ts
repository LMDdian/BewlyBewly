import { QUALITY_MAP } from './constants'

const PLAYER_QUALITY_SELECTORS = [
  '.bpx-player-ctrl-quality-menu .bpx-state-active',
  '.bpx-player-ctrl-quality-menu-item.bpx-state-active',
  '.squirtle-quality-select-list li.active',
  '.bpx-player-ctrl-quality .bpx-player-ctrl-quality-result',
]

const DEFAULT_QN = 80

function readQnFromDataset(el: Element | null): number | null {
  if (!el)
    return null

  const raw = (el as HTMLElement).dataset?.value
    || el.getAttribute('data-value')
    || el.getAttribute('data-q')
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0)
    return null
  return value
}

function readQnFromPlayerDom(): number | null {
  for (const selector of PLAYER_QUALITY_SELECTORS) {
    const active = document.querySelector(selector)
    let qn = readQnFromDataset(active)

    // Some builds mark "自动" as 0; fall back to the first concrete option.
    if (qn === null && active) {
      const first = active.parentElement?.querySelector('li:first-child, [data-value]') ?? null
      qn = readQnFromDataset(first)
    }

    if (qn)
      return qn
  }
  return null
}

function readQnFromPlayerSettings(): number | null {
  try {
    const raw = localStorage.getItem('bilibili_player_settings')
    if (!raw || raw === 'undefined')
      return null
    const parsed = JSON.parse(raw)
    const defquality = Number(parsed?.setting_config?.defquality)
    if (Number.isFinite(defquality) && defquality > 0)
      return defquality
  }
  catch {
    // ignore
  }
  return null
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * Prefer the quality currently selected in the bilibili player.
 * Fallback order: player DOM → player localStorage → default 80.
 */
export async function resolvePreferredQuality(explicitQn?: number): Promise<number> {
  if (explicitQn && explicitQn > 0)
    return explicitQn

  const immediate = readQnFromPlayerDom()
  if (immediate)
    return immediate

  // Quality menu items may appear slightly after player mount.
  for (let i = 0; i < 5; i++) {
    await wait(200)
    const qn = readQnFromPlayerDom()
    if (qn)
      return qn
  }

  return readQnFromPlayerSettings() || DEFAULT_QN
}

export function qualityLabel(qn: number): string {
  return QUALITY_MAP[qn] || `${qn}`
}
