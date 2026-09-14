const CORE_VERSION = "0.12.1";
const DEFAULT_CORE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`;
const workerSelf = self;
let ffmpeg;
const load = async ({
  coreURL = DEFAULT_CORE_URL,
  wasmURL,
  workerURL
}) => {
  const first = !ffmpeg;
  const resolvedWasm = wasmURL || coreURL.replace(/\.js$/g, ".wasm");
  const resolvedWorker = workerURL || coreURL.replace(/\.js$/g, ".worker.js");
  try {
    importScripts(coreURL);
  } catch {
    const mod = await import(
      /* @vite-ignore */
      coreURL
    );
    workerSelf.createFFmpegCore = mod.default;
    if (!workerSelf.createFFmpegCore) {
      throw new Error("failed to import ffmpeg-core.js");
    }
  }
  ffmpeg = await workerSelf.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(
      JSON.stringify({ wasmURL: resolvedWasm, workerURL: resolvedWorker })
    )}`
  });
  ffmpeg.setLogger(
    (n) => workerSelf.postMessage({ type: "LOG", data: n })
  );
  ffmpeg.setProgress(
    (n) => workerSelf.postMessage({ type: "PROGRESS", data: n })
  );
  return first;
};
const exec = ({ args, timeout = -1 }) => {
  if (!ffmpeg) throw new Error("ffmpeg is not loaded");
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
};
workerSelf.onmessage = async ({ data: { id, type, data } }) => {
  const transfer = [];
  let result;
  try {
    if (type !== "LOAD" && !ffmpeg) {
      throw new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
    }
    switch (type) {
      case "LOAD":
        result = await load(data);
        break;
      case "EXEC":
        result = exec(data);
        break;
      case "WRITE_FILE":
        ffmpeg.FS.writeFile(data.path, data.data);
        result = true;
        break;
      case "READ_FILE":
        result = ffmpeg.FS.readFile(data.path, { encoding: data.encoding });
        break;
      case "DELETE_FILE":
        ffmpeg.FS.unlink(data.path);
        result = true;
        break;
      case "RENAME":
        ffmpeg.FS.rename(data.oldPath, data.newPath);
        result = true;
        break;
      case "CREATE_DIR":
        ffmpeg.FS.mkdir(data.path);
        result = true;
        break;
      case "LIST_DIR": {
        const names = ffmpeg.FS.readdir(data.path);
        result = names.map((name) => {
          const stat = ffmpeg.FS.stat(`${data.path}/${name}`);
          return { name, isDir: ffmpeg.FS.isDir(stat.mode) };
        });
        break;
      }
      case "DELETE_DIR":
        ffmpeg.FS.rmdir(data.path);
        result = true;
        break;
      default:
        throw new Error("unknown message type");
    }
  } catch (err) {
    workerSelf.postMessage({ id, type: "ERROR", data: String(err) });
    return;
  }
  if (result instanceof Uint8Array) {
    transfer.push(result.buffer);
  }
  workerSelf.postMessage({ id, type, data: result }, transfer);
};
//# sourceMappingURL=ffmpeg.worker.js.map
