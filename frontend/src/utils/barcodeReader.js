// Reading food barcodes from the camera's picture. The browser's own BarcodeDetector does it where
// there is one (Chrome on Android). Everywhere else ZXing does, compiled to WebAssembly: about
// 1 MB, fetched from this app's own files the first time a scanner opens without the browser's.
// Either way a reader is (video) => Promise<{ rawValue, format } | null>, the format named as
// BarcodeDetector names it.

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const ZXING_FORMATS = ["EAN13", "EAN8", "UPCA", "UPCE"];
const FORMAT_NAMES = { EAN13: "ean_13", EAN8: "ean_8", UPCA: "upc_a", UPCE: "upc_e" };
// Wider frames are scaled down before ZXing reads them: a barcode needs no more, and a phone
// reads a smaller picture faster.
const MAX_FRAME_WIDTH = 1024;

async function nativeReader() {
  if (!("BarcodeDetector" in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((format) => supported.includes(format));
    if (formats.length === 0) return null;
    const detector = new window.BarcodeDetector({ formats });
    return async (video) => {
      const [barcode] = await detector.detect(video);
      return barcode ? { rawValue: barcode.rawValue, format: barcode.format } : null;
    };
  } catch {
    return null;
  }
}

// ZXing's module, loaded once for the whole app.
let zxingLoading = null;

function loadZxing() {
  zxingLoading ??= (async () => {
    const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([
      import("zxing-wasm/reader"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);
    // Its .wasm comes from the app's own files, not from a CDN, and loads now, so a failure
    // shows before the camera starts.
    await prepareZXingModule({
      overrides: {
        locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
      },
      fireImmediately: true,
    });
    return readBarcodes;
  })().catch((err) => {
    zxingLoading = null;
    throw err;
  });
  return zxingLoading;
}

async function zxingReader() {
  const readBarcodes = await loadZxing();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return null;
    const scale = Math.min(1, MAX_FRAME_WIDTH / videoWidth);
    canvas.width = Math.round(videoWidth * scale);
    canvas.height = Math.round(videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const [result] = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
      formats: ZXING_FORMATS,
      tryHarder: true,
      maxNumberOfSymbols: 1,
    });
    return result?.isValid ? { rawValue: result.text, format: FORMAT_NAMES[result.format] } : null;
  };
}

// A reader for this browser: its own if it has one for food barcodes, else ZXing.
export async function createBarcodeReader() {
  return (await nativeReader()) ?? zxingReader();
}
