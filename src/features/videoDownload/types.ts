export interface DashStream {
  id?: number
  codecid?: number
  base_url: string
  backup_url?: string[]
  size?: number
}

export interface PlayUrlData {
  dash?: {
    video?: DashStream[]
    audio?: DashStream[]
  }
  durl?: Array<{ url: string, backup_url?: string[], size?: number }>
  accept_description?: string[]
  accept_quality?: number[]
  video_codecid?: number
  support_formats?: Array<{
    quality: number
    new_description?: string
    display_desc?: string
  }>
}

export interface PlayUrlResult {
  code: number
  message?: string
  data?: PlayUrlData
}

export interface ResolvedStreams {
  code: number
  message?: string
  qualityLabel?: string
  video?: { url: string, size?: number }
  audio?: { url: string, size?: number }
  /** Single-file / segmented fallback */
  segments?: Array<{ url: string, size?: number }>
}

export interface MergeDownloadOptions {
  aid?: number | string
  bvid?: string
  cid?: number
  /** Multi-P index (1-based), default from URL `p` */
  page?: number
  title: string
  /**
   * Preferred qn.
   * If omitted, follows player current quality → bilibili_player_settings → 80.
   */
  qn?: number
  onProgress?: (message: string) => void
}
