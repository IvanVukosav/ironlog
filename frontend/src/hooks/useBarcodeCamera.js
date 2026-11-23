import { useEffect, useEffectEvent, useRef, useState } from "react";

// The barcodes on food packages, as the browser's BarcodeDetector names them.
const FOOD_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const SCAN_EVERY_MS = 200;

// The camera needs a secure page (https, or localhost) and the browser's own barcode reading,
// which Chrome on Android has and Safari, Firefox and Chrome on a computer don't.
function canScan() {
  return (
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    "BarcodeDetector" in window
  );
}

async function foodDetector() {
  const supported = await window.BarcodeDetector.getSupportedFormats();
  const formats = FOOD_FORMATS.filter((format) => supported.includes(format));
  return formats.length > 0 ? new window.BarcodeDetector({ formats }) : null;
}

/**
 * The back camera shown in `videoRef`'s video and read for food barcodes while `isScanning`.
 * `onRead({ rawValue, format })` hears of each barcode read; returning false (not one it can
 * use) keeps scanning, anything else stops until scanning is asked for again.
 *
 * `status` is "starting", "on", or why there is no scanning: "unsupported" (no camera here, or
 * no barcode reading in this browser), "denied" (the camera wasn't allowed) or "nocamera".
 * `torch` is null while the camera has no light, else { on, toggle }.
 */
export function useBarcodeCamera({ videoRef, isScanning, onRead }) {
  const [status, setStatus] = useState(() => (canScan() ? "starting" : "unsupported"));
  const [torchOn, setTorchOn] = useState(null);
  const detectorRef = useRef(null);
  const trackRef = useRef(null);
  const read = useEffectEvent((barcode) => onRead(barcode));

  useEffect(() => {
    if (!canScan()) return undefined;
    let isStopped = false;
    let stream = null;

    (async () => {
      try {
        const detector = await foodDetector();
        if (!detector) throw Object.assign(new Error("No food barcodes"), { name: "Unsupported" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (isStopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});
        detectorRef.current = detector;
        trackRef.current = stream.getVideoTracks()[0];
        const capabilities = trackRef.current?.getCapabilities?.() ?? {};
        setTorchOn(capabilities.torch ? false : null);
        setStatus("on");
      } catch (err) {
        if (isStopped) return;
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") setStatus("denied");
        else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
          setStatus("nocamera");
        } else setStatus("unsupported");
      }
    })();

    return () => {
      isStopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on" || !isScanning) return undefined;
    let isStopped = false;
    let timer;
    const scan = async () => {
      try {
        const [barcode] = await detectorRef.current.detect(videoRef.current);
        if (isStopped) return;
        if (barcode && read({ rawValue: barcode.rawValue, format: barcode.format }) !== false) {
          return;
        }
      } catch {
        // A frame that couldn't be read (the video not playing yet): try the next one.
      }
      if (!isStopped) timer = setTimeout(scan, SCAN_EVERY_MS);
    };
    timer = setTimeout(scan, SCAN_EVERY_MS);
    return () => {
      isStopped = true;
      clearTimeout(timer);
    };
  }, [status, isScanning, videoRef]);

  const toggleTorch = async () => {
    const on = !torchOn;
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: on }] });
      setTorchOn(on);
    } catch {
      setTorchOn(null);
    }
  };

  return { status, torch: torchOn === null ? null : { on: torchOn, toggle: toggleTorch } };
}
