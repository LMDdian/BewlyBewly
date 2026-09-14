export const FFMPEG_DIR = 'assets/ffmpeg'
export const FFMPEG_WORKER = 'ffmpeg.worker.js'
export const FFMPEG_CORE_JS = 'ffmpeg-core.js'
export const FFMPEG_CORE_WASM = 'ffmpeg-core.wasm'
export const FFMPEG_CORE_WORKER = 'ffmpeg-core.worker.js'

export const VIP_ONLY_CODE = -10403

export const QUALITY_MAP: Record<number, string> = {
  16: '360P',
  32: '480P',
  64: '720P',
  74: '720P60',
  80: '1080P',
  112: '1080P+',
  116: '1080P60',
  120: '4K',
  125: 'HDR',
  126: '杜比视界',
  127: '8K',
}
