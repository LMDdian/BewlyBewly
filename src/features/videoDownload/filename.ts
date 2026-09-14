/** Sanitize a title into a safe download filename stem */
export function sanitizeFilename(name: string, maxLength = 80): string {
  let cleaned = ''
  for (const ch of name) {
    const code = ch.charCodeAt(0)
    if (code < 32 || '<>:"/\\|?*'.includes(ch))
      cleaned += '_'
    else
      cleaned += ch
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  if (!cleaned)
    return 'bilibili_video'

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned
}

export function guessExtFromUrl(url: string, fallback = '.mp4'): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const match = pathname.match(/\.[a-z0-9]+$/)
    if (!match)
      return fallback
    if (match[0] === '.m4s')
      return '.mp4'
    return match[0]
  }
  catch {
    return fallback
  }
}
