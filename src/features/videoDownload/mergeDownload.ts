import type { VideoInfo } from '~/models/video/videoInfo'
import api from '~/utils/api'

import { mergeAudioVideo } from './ffmpeg'
import { guessExtFromUrl, sanitizeFilename } from './filename'
import { resolveStreams } from './parsePlayUrl'
import { qualityLabel, resolvePreferredQuality } from './resolveQuality'
import type { MergeDownloadOptions, PlayUrlResult } from './types'

let queue: Promise<void> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(() => undefined, () => undefined)
  return run
}

async function fetchBlob(url: string, onProgress?: (message: string) => void, label = '媒体') {
  onProgress?.(`正在下载${label}...`)
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`下载${label}失败 (${res.status})`)

  const total = Number(res.headers.get('content-length') || 0)
  if (!res.body || !total)
    return await res.blob()

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    if (value) {
      chunks.push(value)
      received += value.byteLength
      const pct = Math.min(100, Math.round((received / total) * 100))
      onProgress?.(`正在下载${label} ${pct}%`)
    }
  }

  return new Blob(chunks as BlobPart[])
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function startBrowserDownload(url: string, filename: string) {
  const res = await api.download.startDownload({ url, filename } as any)
  if (!res?.ok)
    throw new Error(res?.message || '浏览器下载失败')
  return res
}

async function resolveCidAndMeta(options: MergeDownloadOptions) {
  let { aid, bvid, cid, title } = options
  const page = options.page ?? Number(new URL(location.href).searchParams.get('p') || 1)

  if (!cid || !title || (!aid && !bvid)) {
    const info = await api.video.getVideoInfo({
      bvid: bvid || undefined,
      aid: aid ? String(aid) : undefined,
    }) as VideoInfo | undefined
    if (!info || info.code !== 0)
      throw new Error(info?.message || '获取视频信息失败')

    aid = aid || info.data.aid
    bvid = bvid || info.data.bvid
    title = title || info.data.title

    if (!cid) {
      const pages = info.data.pages || []
      const matched = pages.find(item => item.page === page) || pages[0]
      cid = matched?.cid || info.data.cid
    }
  }

  if (!cid)
    throw new Error('缺少 cid，无法下载')

  return { aid, bvid, cid, title }
}

/**
 * Resolve playurl, then either:
 * - DASH: fetch A/V → ffmpeg merge → save mp4
 * - durl: use chrome.downloads for each segment
 */
export async function mergeDownload(options: MergeDownloadOptions): Promise<void> {
  return enqueue(async () => {
    const onProgress = options.onProgress
    const qn = await resolvePreferredQuality(options.qn)
    const qLabel = qualityLabel(qn)
    const meta = await resolveCidAndMeta(options)
    const filenameStem = sanitizeFilename(`${meta.title}_${qLabel}`)

    onProgress?.(`正在获取下载地址 (${qLabel})...`)
    const playRes = await api.video.getPlayUrl({
      aid: meta.aid ? String(meta.aid) : undefined,
      bvid: meta.bvid || undefined,
      cid: meta.cid,
      qn,
      fnver: 0,
      fnval: 4048,
      fourk: 1,
    }) as PlayUrlResult | undefined

    if (!playRes)
      throw new Error('获取下载地址失败：扩展后台无响应，请重新加载扩展后重试')

    const streams = resolveStreams(playRes.data, qn, playRes.code, playRes.message)
    if (streams.code !== 0)
      throw new Error(streams.message || '获取下载地址失败')

    const finalLabel = streams.qualityLabel || qLabel
    onProgress?.(`清晰度 ${finalLabel}`)

    if (streams.video && streams.audio) {
      const [videoBlob, audioBlob] = await Promise.all([
        fetchBlob(streams.video.url, onProgress, '视频'),
        fetchBlob(streams.audio.url, onProgress, '音频'),
      ])
      onProgress?.('正在合并音视频...')
      const merged = await mergeAudioVideo(audioBlob, videoBlob)
      onProgress?.('合并完成，开始保存...')
      triggerBlobDownload(merged, `${filenameStem}.mp4`)
      return
    }

    if (streams.video && !streams.audio) {
      onProgress?.('开始下载视频...')
      await startBrowserDownload(
        streams.video.url,
        `BewlyBewly/${filenameStem}${guessExtFromUrl(streams.video.url)}`,
      )
      return
    }

    if (streams.segments?.length) {
      onProgress?.('开始下载...')
      for (let i = 0; i < streams.segments.length; i++) {
        const seg = streams.segments[i]
        const suffix = streams.segments.length > 1 ? `_p${i + 1}` : ''
        await startBrowserDownload(
          seg.url,
          `BewlyBewly/${filenameStem}${suffix}${guessExtFromUrl(seg.url)}`,
        )
      }
      return
    }

    throw new Error('未找到可下载的流')
  })
}
