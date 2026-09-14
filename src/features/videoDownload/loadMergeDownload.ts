import type { MergeDownloadOptions } from './types'

type MergeDownloadModule = typeof import('./mergeDownload')

let loading: Promise<MergeDownloadModule> | null = null
let cached: MergeDownloadModule | null = null

/**
 * Lazily evaluate the download module (ffmpeg included).
 * Uses a same-bundle dynamic import so we never inject a second classic/ESM
 * script into the page (avoids "Identifier already declared" conflicts).
 */
export async function loadMergeDownload(): Promise<MergeDownloadModule> {
  if (cached)
    return cached
  if (!loading) {
    loading = import('./mergeDownload')
      .then((mod) => {
        cached = mod
        return cached
      })
      .catch((err) => {
        loading = null
        throw err
      })
  }
  return loading
}

export async function mergeDownloadLazy(options: MergeDownloadOptions): Promise<void> {
  const { mergeDownload } = await loadMergeDownload()
  return mergeDownload(options)
}
