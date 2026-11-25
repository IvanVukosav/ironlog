// A minimal driver for headless Chrome over the DevTools protocol: no dependencies.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

// CHROME=<path to chrome.exe> when Chrome is installed somewhere else.
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helpers available to every page as window.__e2e.
const PAGE_HELPERS = `window.__e2e = {
  visible(el) { return !!el && el.getClientRects().length > 0; },
  byText(selector, text, root) {
    return [...(root || document).querySelectorAll(selector)].find(
      (el) => el.textContent.trim() === text && this.visible(el)) || null;
  },
  containing(selector, text, root) {
    return [...(root || document).querySelectorAll(selector)].filter(
      (el) => el.textContent.includes(text) && this.visible(el));
  },
  card(name) {
    const heading = this.byText('[data-drag-id] :is(h2, h3)', name);
    return heading ? heading.closest('[data-drag-list]') : null;
  },
  cardNames() {
    return [...document.querySelectorAll('[data-drag-id] :is(h2, h3)')].map((h) => h.textContent.trim());
  },
  rows(card) { return [...card.querySelectorAll('[data-drag-id]')].filter((row) => row !== card); },
  center(el) {
    el.scrollIntoView({ block: 'center' });
    const box = el.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  },
};`;

// `extraArgs` go to Chrome as they are, e.g. a fake camera for the barcode scanner.
export async function launch({
  port,
  profile: profileBase,
  width = 1280,
  height = 1900,
  mobile = false,
  extraArgs = [],
}) {
  // A fresh folder each time: a Chrome that has just been closed can still hold the last one.
  const profile = `${profileBase}-${Date.now()}`;
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Nothing to clear.
  }
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      ...extraArgs,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let url;
  for (let attempt = 0; attempt < 60 && !url; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
        method: "PUT",
      });
      url = (await response.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  if (!url) {
    chrome.kill();
    throw new Error("Chrome did not open its debugging port");
  }

  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  // `sessionId` sends to a target attached with Target.attachToTarget({ flatten: true }), such as
  // the page's service worker.
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  const on = (event, handler) => listeners.set(event, handler);
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.id) {
      const call = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) call.reject(new Error(`${call.method}: ${data.error.message}`));
      else call.resolve(data.result);
    } else {
      listeners.get(data.method)?.(data.params);
    }
  });

  const problems = [];
  const dialogs = [];
  // A browser extension's own content script logs errors on every page; they are not the app's.
  const note = (text) => {
    if (!text.includes("chrome-extension://")) problems.push(text);
  };
  // The script's address goes in too, so an extension's own rejections ("Uncaught (in promise)"
  // from its content script) are recognised as not the app's.
  on("Runtime.exceptionThrown", ({ exceptionDetails }) =>
    note(
      `exception: ${exceptionDetails.exception?.description ?? exceptionDetails.text} ${exceptionDetails.url ?? ""}`,
    ),
  );
  on("Runtime.consoleAPICalled", ({ type, args, stackTrace }) => {
    if (type !== "error" && type !== "warning") return;
    const from = stackTrace?.callFrames?.[0]?.url ?? "";
    note(`console.${type}: ${args.map((arg) => arg.value ?? arg.description).join(" ")} ${from}`);
  });
  // confirm() and alert() are accepted, and remembered.
  on("Page.javascriptDialogOpening", ({ message }) => {
    dialogs.push(message);
    send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: PAGE_HELPERS });
  // E2E_NO_IDLE=1: idle callbacks never run (to tell apart what the app does when idle).
  if (process.env.E2E_NO_IDLE) {
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: "window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {};",
    });
  }
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: false });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(
        `evaluate failed: ${exceptionDetails.exception?.description ?? exceptionDetails.text}\n${expression}`,
      );
    }
    return result.value;
  };

  const frames = () =>
    evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");

  // Polls until `expression` is truthy; the value it had, or an error naming what was awaited.
  const waitFor = async (expression, label = expression, timeout = 6000) => {
    const started = Date.now();
    for (;;) {
      // Boolean, because an element (what most waits are for) cannot be sent back by value. A
      // promise in the page that never settles must not hang the run: the wait gives up with it.
      const left = Math.max(timeout - (Date.now() - started), 0) + 1000;
      const value = await Promise.race([
        evaluate(`Promise.resolve(${expression}).then(Boolean)`),
        sleep(left).then(() => {
          throw new Error(`timed out waiting for: ${label} (the page never answered)`);
        }),
      ]);
      if (value) return value;
      if (Date.now() - started > timeout) throw new Error(`timed out waiting for: ${label}`);
      await sleep(100);
      await frames();
    }
  };

  const mouse = (type, x, y, extra = {}) =>
    send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });

  // `element` is an expression for one element; it is scrolled into view and clicked for real.
  const click = async (element, label = element) => {
    const point = await evaluate(`(() => { const el = ${element}; return el ? __e2e.center(el) : null; })()`);
    if (!point) throw new Error(`nothing to click: ${label}`);
    await mouse("mouseMoved", point.x, point.y, { button: "none" });
    await mouse("mousePressed", point.x, point.y, { clickCount: 1 });
    await mouse("mouseReleased", point.x, point.y, { clickCount: 1 });
    await frames();
  };

  // Clicks into a text field, replaces what is there and leaves the field focused.
  const type = async (element, text, label = element) => {
    await click(element, label);
    await evaluate("document.activeElement.select && document.activeElement.select()");
    if (text === "") {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
    } else {
      await send("Input.insertText", { text });
    }
    await frames();
  };

  const blur = async () => {
    await evaluate("document.activeElement && document.activeElement.blur()");
    await frames();
  };

  const press = async (key, code, keyCode) => {
    // Enter needs its text too, or the browser never submits the form it was pressed in.
    const text = key === "Enter" ? "\r" : undefined;
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, text });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
    await frames();
  };

  // Presses on `from`, moves to a point given by `toPoint` (an expression for { x, y }) and lets go.
  const drag = async (from, toPoint) => {
    const start = await evaluate(`__e2e.center(${from})`);
    await mouse("mouseMoved", start.x, start.y, { button: "none" });
    await mouse("mousePressed", start.x, start.y, { clickCount: 1 });
    const end = await evaluate(toPoint);
    for (let step = 1; step <= 6; step++) {
      await mouse("mouseMoved", start.x + ((end.x - start.x) * step) / 6, start.y + ((end.y - start.y) * step) / 6);
      await sleep(30);
    }
    await mouse("mouseReleased", end.x, end.y, { clickCount: 1 });
    await frames();
  };

  const screenshot = async (file, fullPage = true) => {
    const { writeFileSync } = await import("node:fs");
    let params = { format: "png" };
    if (fullPage) {
      await evaluate("window.scrollTo(0, 0)");
      await frames();
      const { cssContentSize } = await send("Page.getLayoutMetrics");
      params = {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
      };
    }
    const { data } = await send("Page.captureScreenshot", params);
    writeFileSync(file, Buffer.from(data, "base64"));
  };

  return {
    send,
    on,
    evaluate,
    frames,
    waitFor,
    click,
    type,
    blur,
    press,
    drag,
    mouse,
    screenshot,
    problems,
    dialogs,
    navigate: async (target) => {
      await send("Page.navigate", { url: target });
      await sleep(300);
    },
    setScheme: (value) =>
      send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] }),
    close: async () => {
      socket.close();
      chrome.kill();
      // Let the next launch find the port free.
      await sleep(500);
    },
  };
}
