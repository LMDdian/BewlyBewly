import {
  FFMPEG_CORE_JS,
  FFMPEG_CORE_WASM,
  FFMPEG_CORE_WORKER,
  FFMPEG_DIR,
  FFMPEG_WORKER,
} from './constants'

enum Msg {
  LOAD = 'LOAD',
  EXEC = 'EXEC',
  WRITE_FILE = 'WRITE_FILE',
  READ_FILE = 'READ_FILE',
  DELETE_FILE = 'DELETE_FILE',
  ERROR = 'ERROR',
  LOG = 'LOG',
  PROGRESS = 'PROGRESS',
}

let msgId = 0
const nextId = () => msgId++

async function toBlobURL(url: string, type: string) {
  const buf = await (await fetch(url)).arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type }))
}

class FFmpegClient {
  #worker: Worker | null
  #resolvers = new Map<number, (v: unknown) => void>()
  #rejecters = new Map<number, (e: unknown) => void>()
  loaded = false

  constructor(worker: Worker) {
    this.#worker = worker
    this.#bind()
  }

  #bind() {
    if (!this.#worker)
      return
    this.#worker.onmessage = ({ data: { id, type, data } }) => {
      switch (type) {
        case Msg.LOAD:
          this.loaded = true
          this.#resolvers.get(id)?.(data)
          break
        case Msg.EXEC:
        case Msg.WRITE_FILE:
        case Msg.READ_FILE:
        case Msg.DELETE_FILE:
          this.#resolvers.get(id)?.(data)
          break
        case Msg.ERROR:
          this.#rejecters.get(id)?.(data)
          break
      }
      this.#resolvers.delete(id)
      this.#rejecters.delete(id)
    }
  }

  #send(payload: { type: string, data?: unknown }, transfer: Transferable[] = []) {
    if (!this.#worker)
      return Promise.reject(new Error('ffmpeg is not loaded'))

    return new Promise((resolve, reject) => {
      const id = nextId()
      this.#resolvers.set(id, resolve)
      this.#rejecters.set(id, reject)
      this.#worker!.postMessage({ id, type: payload.type, data: payload.data }, transfer)
    })
  }

  load(config: { coreURL: string, wasmURL: string, workerURL: string }) {
    return this.#send({ type: Msg.LOAD, data: config })
  }

  exec(args: string[], timeout = -1) {
    return this.#send({ type: Msg.EXEC, data: { args, timeout } })
  }

  writeFile(path: string, data: Uint8Array) {
    return this.#send(
      { type: Msg.WRITE_FILE, data: { path, data } },
      [data.buffer],
    )
  }

  readFile(path: string, encoding: 'binary' | 'utf8' = 'binary') {
    return this.#send({ type: Msg.READ_FILE, data: { path, encoding } })
  }

  deleteFile(path: string) {
    return this.#send({ type: Msg.DELETE_FILE, data: { path } })
  }

  terminate() {
    this.#worker?.terminate()
    this.#worker = null
    this.loaded = false
  }
}

const state = {
  ffmpegInstance: null as FFmpegClient | null,
  blobUrls: new Set<string>(),
}

async function getFFmpeg() {
  if (state.ffmpegInstance)
    return state.ffmpegInstance

  const baseUrl = browser.runtime.getURL(`${FFMPEG_DIR}/`)
  const workerUrl = await toBlobURL(`${baseUrl}${FFMPEG_WORKER}`, 'text/javascript')
  state.blobUrls.add(workerUrl)

  const client = new FFmpegClient(new Worker(workerUrl, { type: 'module' }))
  await client.load({
    coreURL: await toBlobURL(`${baseUrl}${FFMPEG_CORE_JS}`, 'text/javascript').then((u) => {
      state.blobUrls.add(u)
      return u
    }),
    wasmURL: await toBlobURL(`${baseUrl}${FFMPEG_CORE_WASM}`, 'application/wasm').then((u) => {
      state.blobUrls.add(u)
      return u
    }),
    workerURL: await toBlobURL(`${baseUrl}${FFMPEG_CORE_WORKER}`, 'text/javascript').then((u) => {
      state.blobUrls.add(u)
      return u
    }),
  })

  state.ffmpegInstance = client
  return client
}

async function asUint8(input: Blob) {
  return new Uint8Array(await input.arrayBuffer())
}

export async function mergeAudioVideo(audio: Blob, video: Blob): Promise<Blob> {
  const stamp = `${Date.now()}${Math.random().toString(16).slice(2)}`
  const ffmpeg = await getFFmpeg()
  const audioPath = `${stamp}_audio.mp4`
  const videoPath = `${stamp}_video.mp4`
  const outPath = `${stamp}_merged.mp4`

  await ffmpeg.writeFile(audioPath, await asUint8(audio))
  await ffmpeg.writeFile(videoPath, await asUint8(video))
  await ffmpeg.exec(
    `-i ${videoPath} -i ${audioPath} -vcodec copy -acodec copy ${outPath}`.split(' '),
  )

  const data = (await ffmpeg.readFile(outPath)) as Uint8Array
  await Promise.allSettled([
    ffmpeg.deleteFile(audioPath),
    ffmpeg.deleteFile(videoPath),
    ffmpeg.deleteFile(outPath),
  ])

  const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  return new Blob([copy], { type: 'video/mp4' })
}
