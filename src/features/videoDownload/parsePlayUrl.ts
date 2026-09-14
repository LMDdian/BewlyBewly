import { QUALITY_MAP, VIP_ONLY_CODE } from './constants'
import type { PlayUrlData, ResolvedStreams } from './types'

function pickLabel(data: PlayUrlData, quality: number) {
  const fromSupport = data.support_formats?.find(f => f.quality === quality)
  if (fromSupport?.new_description || fromSupport?.display_desc)
    return fromSupport.new_description || fromSupport.display_desc

  const idx = data.accept_quality?.indexOf(quality) ?? -1
  if (idx >= 0 && data.accept_description?.[idx])
    return data.accept_description[idx]

  return QUALITY_MAP[quality] || `${quality}`
}

export function resolveStreams(data: PlayUrlData | undefined, quality: number, code = 0, message?: string): ResolvedStreams {
  if (code !== 0 || !data) {
    if (code === VIP_ONLY_CODE) {
      return {
        code,
        message: message || '该清晰度需要大会员账号，请登录后重试',
      }
    }
    return {
      code: code || -1,
      message: message || '获取下载地址失败',
    }
  }

  if (data.dash?.video?.length) {
    const video = data.dash.video.find(v =>
      `${v.codecid}` === `${data.video_codecid}` && `${v.id}` === `${quality}`,
    ) ?? data.dash.video[0]

    const audio = data.dash.audio?.[0]
    const q = video.id ?? quality

    return {
      code: 0,
      qualityLabel: pickLabel(data, q),
      video: video ? { url: video.base_url, size: video.size } : undefined,
      audio: audio ? { url: audio.base_url, size: audio.size } : undefined,
    }
  }

  if (data.durl?.length) {
    return {
      code: 0,
      qualityLabel: pickLabel(data, quality),
      segments: data.durl.map(seg => ({ url: seg.url, size: seg.size })),
    }
  }

  return {
    code: -2,
    message: '该视频暂时不支持下载',
  }
}
