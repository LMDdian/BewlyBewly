import browser from 'webextension-polyfill'

import type { APIMAP, Message } from '../../utils'

const API_DOWNLOAD = {
  startDownload: async (message: Message) => {
    const url = message.url as string | undefined
    if (!url)
      return { ok: false, message: 'Missing download url' }

    try {
      const downloadId = await browser.downloads.download({
        url,
        filename: (message.filename as string | undefined) || undefined,
        conflictAction: (message.conflictAction as 'uniquify' | 'overwrite' | 'prompt' | undefined) || 'uniquify',
        saveAs: false,
      })
      return { ok: true, downloadId }
    }
    catch (error: any) {
      return {
        ok: false,
        message: error?.message || String(error),
      }
    }
  },
} satisfies APIMAP

export default API_DOWNLOAD
