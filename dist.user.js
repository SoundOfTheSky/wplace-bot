// ==UserScript==
// @name         wplace-bot
// @namespace    https://github.com/SoundOfTheSky
// @version      5.2.2
// @description  Bot to automate painting on website https://wplace.live
// @author       SoundOfTheSky
// @license      MPL-2.0
// @homepageURL  https://github.com/SoundOfTheSky/wplace-bot
// @updateURL    https://raw.githubusercontent.com/SoundOfTheSky/wplace-bot/refs/heads/main/dist.user.js
// @downloadURL  https://raw.githubusercontent.com/SoundOfTheSky/wplace-bot/refs/heads/main/dist.user.js
// @run-at       document-start
// @match        *://*.wplace.live/*
// @grant        none
// ==/UserScript==

// Wplace  --> https://wplace.live
// License --> https://www.mozilla.org/en-US/MPL/2.0/

// node_modules/@softsky/utils/dist/arrays.js
function swap(array, index, index2) {
  const temporary = array[index2];
  array[index2] = array[index];
  array[index] = temporary;
  return array;
}
function removeFromArray(array, value) {
  const index = array.indexOf(value);
  if (index !== -1)
    array.splice(index, 1);
  return index;
}
// node_modules/@softsky/utils/dist/objects.js
class Base {
  static lastId = 0;
  static idMap = new Map;
  static subclasses = new Map;
  runOnDestroy = [];
  _id;
  get id() {
    return this._id;
  }
  set id(value) {
    Base.idMap.delete(this._id);
    Base.idMap.set(value, this);
    this._id = value;
  }
  constructor(id = ++Base.lastId) {
    this._id = id;
    Base.idMap.set(id, this);
  }
  static registerSubclass() {
    Base.subclasses.set(this.name, this);
  }
  destroy() {
    Base.idMap.delete(this._id);
    for (let index = 0;index < this.runOnDestroy.length; index++)
      this.runOnDestroy[index]();
  }
  registerEvent(target, type, listener, options = {}) {
    options.passive ??= true;
    target.addEventListener(type, listener, options);
    this.runOnDestroy.push(() => {
      target.removeEventListener(type, listener);
    });
  }
}

// node_modules/@softsky/utils/dist/control.js
var lastIncId = Math.floor(Math.random() * 65536);
var SESSION_ID = Math.floor(Math.random() * 4503599627370496).toString(16).padStart(13, "0");
function wait(time) {
  return new Promise((r) => setTimeout(r, time));
}
function promisifyEventSource(target, resolveEvents, rejectEvents = ["error"], subName = "addEventListener") {
  return new Promise((resolve, reject) => {
    for (let index = 0;index < resolveEvents.length; index++)
      target[subName]?.(resolveEvents[index], resolve);
    for (let index = 0;index < rejectEvents.length; index++)
      target[subName]?.(rejectEvents[index], reject);
  });
}
// node_modules/@softsky/utils/dist/formatting.js
var FORMAT_NUMBER_RANGES = [
  {
    start: 31536000000,
    title: "y"
  },
  {
    start: 86400000,
    title: "d"
  },
  {
    start: 3600000,
    title: "h"
  },
  {
    start: 60000,
    title: "m"
  },
  {
    start: 1000,
    title: "s"
  },
  {
    start: 1,
    title: "ms"
  }
];
function formatNumber(time, min = 0, ranges = FORMAT_NUMBER_RANGES) {
  let output = "";
  for (const { start, delimiter, pad, title } of ranges) {
    if (start < min)
      break;
    if (time < start && !pad)
      continue;
    let value = Math.floor(time / start).toString();
    time %= start;
    if (pad)
      value = value.padStart(pad, "0");
    if (output)
      output += delimiter ?? " ";
    output += value;
    if (title)
      output += title;
  }
  return output;
}
// node_modules/@softsky/utils/dist/signals.js
var effectsMap = new WeakMap;
// src/base.ts
class Base2 {
  element = document.createElement("div");
  shadow = this.element.attachShadow({ mode: "open" });
  constructor(html, css) {
    const style = document.createElement("style");
    style.textContent = css;
    this.shadow.append(style);
    const template = document.createElement("template");
    template.innerHTML = html;
    this.shadow.append(template.content);
    document.body.append(this.element);
  }
  runOnDestroy = [];
  destroy() {
    this.element.remove();
    for (let index = 0;index < this.runOnDestroy.length; index++)
      this.runOnDestroy[index]();
  }
  populateElementsWithSelector(selectors) {
    for (const key in selectors) {
      this[key] = this.shadow.querySelector(selectors[key]);
    }
  }
  registerEvent(target, type, listener, options = {}) {
    options.passive ??= true;
    target.addEventListener(type, listener, options);
    this.runOnDestroy.push(() => {
      target.removeEventListener(type, listener);
    });
  }
}

// src/colors.ts
var COLORS = [
  [Number.NaN, Number.NaN, Number.NaN],
  [0, 0, 0],
  [0.356, 0, 0],
  [0.573, 0, 0],
  [0.864, 0, 0],
  [1, 0, 0],
  [0.31, 0.119, 0.037],
  [0.603, 0.209, 0.107],
  [0.732, 0.118, 0.137],
  [0.791, 0.039, 0.16],
  [0.895, -0.026, 0.168],
  [0.974, -0.019, 0.077],
  [0.691, -0.154, 0.075],
  [0.812, -0.185, 0.096],
  [0.898, -0.17, 0.149],
  [0.541, -0.097, 0.005],
  [0.678, -0.114, -0.018],
  [0.814, -0.15, 0.011],
  [0.447, -0.019, -0.134],
  [0.65, -0.048, -0.137],
  [0.895, -0.124, -0.027],
  [0.561, 0.054, -0.229],
  [0.771, 0, -0.11],
  [0.431, 0.145, -0.143],
  [0.557, 0.168, -0.127],
  [0.796, 0.102, -0.097],
  [0.551, 0.225, -0.023],
  [0.62, 0.238, 0],
  [0.759, 0.127, 0.006],
  [0.428, 0.036, 0.041],
  [0.552, 0.03, 0.092],
  [0.817, 0.055, 0.097],
  [0.738, 0, 0],
  [0.46, 0.163, 0.074],
  [0.735, 0.134, 0.071],
  [0.642, 0.137, 0.122],
  [0.794, 0.023, 0.054],
  [0.62, -0.005, 0.105],
  [0.747, -0.019, 0.138],
  [0.864, -0.023, 0.136],
  [0.489, -0.06, 0.058],
  [0.609, -0.092, 0.08],
  [0.76, -0.099, 0.085],
  [0.54, -0.067, -0.079],
  [0.941, -0.064, -0.007],
  [0.803, -0.05, -0.096],
  [0.438, 0.048, -0.192],
  [0.421, 0.03, -0.102],
  [0.593, 0.036, -0.119],
  [0.781, 0.031, -0.09],
  [0.757, 0.036, 0.098],
  [0.676, 0.076, 0.09],
  [0.868, 0.051, 0.061],
  [0.524, 0.087, 0.047],
  [0.684, 0.091, 0.045],
  [0.835, 0.068, 0.048],
  [0.519, 0.022, 0.034],
  [0.629, 0.017, 0.043],
  [0.342, -0.004, -0.016],
  [0.564, 0, -0.038],
  [0.789, 0.003, -0.035],
  [0.502, -0.006, 0.055],
  [0.638, -0.005, 0.047],
  [0.82, -0.007, 0.053]
];
var COLORS_RGB = [
  NaN,
  0,
  3947580,
  7895160,
  13816530,
  16777215,
  6291480,
  15539236,
  16744231,
  16165385,
  16375099,
  16775868,
  964968,
  1304187,
  8912734,
  819566,
  1093286,
  1302974,
  2642078,
  4232164,
  6354930,
  7033078,
  10072571,
  7867545,
  11155641,
  14721017,
  13303930,
  15474560,
  15961513,
  6833716,
  9791530,
  16298615,
  11184810,
  10817054,
  16416882,
  14965786,
  14071188,
  10257457,
  12954929,
  15258719,
  4877114,
  5936202,
  8701299,
  1014175,
  12319474,
  8243199,
  5059000,
  4866692,
  8024516,
  11906801,
  14394467,
  13729873,
  16762277,
  10179145,
  13729912,
  16430756,
  8086354,
  10257515,
  3356993,
  7173517,
  11778513,
  7169087,
  9735275,
  13485470
];
var COLORS_RGB_MAP = new Map;
for (let index = 0;index < COLORS_RGB.length; index++)
  COLORS_RGB_MAP.set(COLORS_RGB[index], index);
function colorToCSS(colorId) {
  if (colorId === 0)
    return "transparent";
  const color = COLORS[colorId];
  return `oklab(${color[0] * 100}% ${color[1]} ${color[2]})`;
}

// src/image.css
var image_default = `/* stylelint-disable plugin/no-low-performance-animation-properties */
/* stylelint-disable no-descending-specificity */

:host {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9;
  overflow: visible;
}

canvas {
  image-rendering: pixelated;
  width: 100%;
  box-shadow: inset var(--text) 0 0 0 2px;
  cursor: all-scroll;
}

dialog.form {
  width: clamp(256px, 60vh, 512px);
  height: 60vh;
  margin: auto;
  padding: 0;
  border: var(--text) 2px solid;
  background-color: var(--background);
  color: var(--text);
}

dialog.form::backdrop {
  background: rgb(0 0 0 / 70%);
}

input {
  border: none;
  background: transparent;
  outline: none;
}

.form .colors {
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
}

.form .colors > button {
  position: absolute;
  left: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 20px;
  border: none;
  font-size: 16px;
  cursor: ns-resize;
  transition: 0.5s top ease;
}

.form .colors > button.dark {
  color: var(--text-invert);
}

.form .colors > button:hover {
  filter: brightness(0.6);
}

.form .colors > button * {
  float: left;
}

.form .colors > button .percent {
  float: right;
}

.form .colors > button.dragging {
  z-index: 100;
}

.form .colors > button > button {
  height: 100%;
}

.topbar {
  position: absolute;
  top: -24px;
  left: 0;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 256px;
  border: var(--text) 2px solid;
  background-color: var(--main);
  color: var(--text-invert);
  cursor: all-scroll;
}

.topbar .name {
  width: 100%;
  height: 100%;
  padding: 0 4px;
}

.topbar button {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
}

.topbar button:hover {
  background-color: var(--main-hover);
}

.resize {
  position: absolute;
  width: calc(100% - var(--resize) - var(--resize));
  height: calc(100% - var(--resize) - var(--resize));
}

.resize.n {
  top: 0;
  left: var(--resize);
  height: var(--resize);
  cursor: n-resize;
}

.resize.e {
  top: var(--resize);
  right: 0;
  width: var(--resize);
  cursor: e-resize;
}

.resize.s {
  bottom: 0;
  left: var(--resize);
  height: var(--resize);
  cursor: s-resize;
}

.resize.w {
  top: var(--resize);
  left: 0;
  width: var(--resize);
  cursor: w-resize;
}

.no-pointer-events {
  height: 1px;
  pointer-events: none;
}
`;

// src/image.html
var image_default2 = `<div class="topbar">
  <input type="text" class="name" />
  <button class="open-settings" title="Open settings">✏️</button>
  <button class="export" title="Export image">📤</button>
  <button class="lock" title="Lock/unlock image movement">🔓</button>
  <button class="delete" title="Remove image from bot">❌</button>
</div>
<div class="wrapper">
  <canvas></canvas>
  <div class="resize n"></div>
  <div class="resize e"></div>
  <div class="resize s"></div>
  <div class="resize w"></div>
</div>
<dialog class="form">
  <div class="progress">
    <div></div>
    <span></span>
  </div>
  <label class="unowned-color-strategy" title="What to do with unonwned colors">
    Unowned Colors:&nbsp;<select>
      <option value="BUY" selected>Buy</option>
      <option value="SKIP">Skip</option>
      <option value="SUBSTITUTE">Substitute</option>
    </select>
  </label>
  <label>Opacity:&nbsp;<input class="opacity" type="range" min="0" max="100" /></label>
  <label>Brightness:&nbsp;<input class="brightness" type="number" step="0.1" /></label>
  <label color="How to draw">
    Strategy:&nbsp;<select class="strategy">
      <option value="RANDOM">Random</option>
      <option value="DOWN">Top to Bottom</option>
      <option value="UP">Bottom to Top</option>
      <option value="LEFT">Right to Left</option>
      <option value="RIGHT">Left to Right</option>
      <option value="SPIRAL_FROM_CENTER">Spiral out</option>
      <option value="SPIRAL_TO_CENTER" selected>Spiral in</option>
    </select>
  </label>
  <button class="reset-size">Reset size [<span></span>px]</button>
  <label> <input type="checkbox" class="draw-colors-in-order" />&nbsp;Draw colors in order </label>
  <div class="colors" title="Pixels drawn / total, drawn % (% of the image)"></div>
</dialog>
`;

// src/save.ts
var DB_NAME = "wbot";
var STORE_NAME = "saves";
var KEY_NAME = "wbot";
var DB_VERSION = 1;
var SAVE_VERSION = 4;
var dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME))
      db.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => {
    resolve(request.result);
  };
  request.onerror = () => {
    reject(request.error);
  };
});
async function idbGet(key) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}
async function idbSet(key, value) {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
  });
}
function DELETE_ALL_DATA() {
  indexedDB.deleteDatabase(DB_NAME);
}
async function loadSave() {
  try {
    await migrateSaveFromLS();
    const raw = await idbGet(KEY_NAME);
    if (typeof raw !== "object" || raw === null)
      return;
    return migrate(raw);
  } catch {
    return;
  }
}
var saveTimeout;
async function save(bot, immediate = false) {
  clearTimeout(saveTimeout);
  if (immediate)
    await idbSet(KEY_NAME, await bot.toJSON());
  else
    await new Promise((resolve) => {
      saveTimeout = setTimeout(async () => {
        await idbSet(KEY_NAME, await bot.toJSON());
        resolve();
      }, 1000);
    });
}
async function migrateSaveFromLS() {
  let legacyKey = "";
  for (let index = 0;index < localStorage.length; index++) {
    legacyKey = localStorage.key(index);
    if (legacyKey.endsWith(KEY_NAME))
      break;
  }
  if (legacyKey.endsWith(KEY_NAME)) {
    const json = localStorage.getItem(legacyKey);
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (typeof parsed === "object")
          await idbSet(KEY_NAME, parsed);
      } catch {}
    }
    localStorage.removeItem(legacyKey);
  }
}
function migrateImage(old) {
  const img = structuredClone(old);
  if (!img.version) {
    return {
      url: img.url || "",
      width: img.width || 0,
      brightness: img.brightness || 1,
      position: img.position || { globalX: 0, globalY: 0 },
      strategy: img.strategy || "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */,
      opacity: img.opacity || 0.5,
      drawColorsInOrder: img.drawColorsInOrder || true,
      colors: img.colors || [],
      disabledColors: img.disabledColors || [0],
      lock: img.lock || false,
      disabled: img.disabled || false,
      name: img.name || `Unnamed image`,
      unownedColorStrategy: img.unownedColorStrategy || "BUY" /* BUY */,
      version: SAVE_VERSION
    };
  }
  if (img.version === 2) {
    const { url, width, brightness } = old.pixels;
    return migrateImage({
      url,
      width,
      brightness,
      position: img.position || { globalX: 0, globalY: 0 },
      strategy: img.strategy || "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */,
      opacity: img.opacity || 0.5,
      drawColorsInOrder: img.drawColorsInOrder || true,
      colors: img.colors || [],
      disabledColors: img.disabledColors || [0],
      lock: img.lock || false,
      disabled: img.disabled || false,
      name: img.name || `Unnamed image`,
      unownedColorStrategy: img.unownedColorStrategy || "BUY" /* BUY */,
      version: 3
    });
  }
  if (img.version === 3) {
    if (!img.drawTransparentPixels && !img.disabledColors.includes(0)) {
      img.disabledColors.push(0);
      delete img.drawTransparentPixels;
    }
    img.version = 4;
    return migrateImage(img);
  }
  return img;
}
function migrate(old) {
  if (!old.version || old.version < SAVE_VERSION) {
    return {
      version: SAVE_VERSION,
      images: old.images.map(migrateImage),
      strategy: old.strategy,
      title: "WPlace-bot"
    };
  }
  return old;
}

// src/shared.css
var shared_default = `/* stylelint-disable declaration-no-important */
/* stylelint-disable plugin/no-low-performance-animation-properties */
/* stylelint-disable no-descending-specificity */

:host {
  --text-invert: #fff;
  --resize: 8px;
  --text: #422e2c;
  --background: #fbe3cb;
  --background-hover: #f0d1b3;
  --background-disabled: #a37648;
  --main: #66bbb4;
  --main-hover: #48a19a;

  box-sizing: border-box;
  color: var(--text);
  font-family: 'Tiny5', sans-serif;
}

:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
  font-family: 'Tiny5', sans-serif;
}

button,
input,
select,
textarea {
  margin: 0;
  border-radius: 0;
  color: inherit;
  font: inherit;
}

button {
  padding: 0;
  border: none;
  background: none;
}

:host(.hidden),
.hidden {
  display: none;
}

.p {
  padding: 0 8px;
}

.form {
  flex-grow: 1;
  overflow-y: auto;
}

.form > * {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  width: calc(100% - 8px);
  margin: 4px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form button,
.form input,
.form select,
.form textarea,
.form label:has(input[type='checkbox']) {
  padding: 0 8px;
  border: var(--text) 2px solid;
  background-color: var(--background);
  cursor: pointer;
  transition: background-color 0.2s;
}

.form input[type='range'] {
  appearance: none;
  width: 100%;
  height: 32px;
  background: linear-gradient(
    to right,
    var(--main) var(--val),
    var(--background-disabled) var(--val)
  );
  cursor: ew-resize;
}

.form input[type='range']::-moz-range-thumb {
  width: 0;
  height: 0;
  opacity: 0;
}

.form input[type='checkbox'] {
  appearance: auto;
  width: 1em;
  height: 1em;
  padding: 0;
}

.form button:hover,
.form input:hover {
  background-color: var(--background-hover);
}

.form button:disabled,
.form input:disabled {
  background-color: var(--background-disabled);
  cursor: no-drop;
}

.form label input:not([type='checkbox']) {
  width: inherit;
}

.form .progress {
  position: relative;
  width: 100%;
  margin: 0;
}

.form .progress div {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: var(--main);
  transform-origin: left;
}

.form .progress span {
  z-index: 0;
}
`;

// src/utils.ts
function formatPercent(n) {
  if (Number.isNaN(n))
    return "0%";
  return (n * 100 | 0) + "%";
}
function etaText(bot, remaining) {
  const charges = Math.floor(bot.me?.charges.count ?? 0);
  const cooldownMs = bot.me?.charges.cooldownMs ?? 30000;
  return formatNumber(Math.max(0, remaining - charges) * cooldownMs, 60000);
}

// src/worker-client.ts
var worker = new Worker(URL.createObjectURL(new Blob([`(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toCommonJS = (from) => {
    var entry = (__moduleCache ??= new WeakMap).get(from), desc;
    if (entry)
      return entry;
    entry = __defProp({}, "__esModule", { value: true });
    if (from && typeof from === "object" || typeof from === "function") {
      for (var key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(entry, key))
          __defProp(entry, key, {
            get: __accessProp.bind(from, key),
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
    }
    __moduleCache.set(from, entry);
    return entry;
  };
  var __moduleCache;

  // src/worker.ts
  var exports_worker = {};

  // src/colors.ts
  function srgbNonlinearTransformInv(c) {
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  }
  function rgbToOklab(r, g, b) {
    const lr = srgbNonlinearTransformInv(r / 255);
    const lg = srgbNonlinearTransformInv(g / 255);
    const lb = srgbNonlinearTransformInv(b / 255);
    const lp = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const mp = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const sp = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const l = 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp;
    const aa = 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp;
    const bb = 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp;
    return [l, aa, bb];
  }
  function deltaE2000(lab1, lab2, brightness) {
    const [L1, a1, b1] = lab1;
    const [L2, a2, b2] = lab2;
    const rad2deg = (rad) => rad * 180 / Math.PI;
    const deg2rad = (deg) => deg * Math.PI / 180;
    const kL = 1, kC = 1, kH = 1;
    const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
    const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
    const avgC = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);
    const C1p = Math.sqrt(a1p ** 2 + b1 ** 2);
    const C2p = Math.sqrt(a2p ** 2 + b2 ** 2);
    const h1p = b1 === 0 && a1p === 0 ? 0 : rad2deg(Math.atan2(b1, a1p)) % 360;
    const h2p = b2 === 0 && a2p === 0 ? 0 : rad2deg(Math.atan2(b2, a2p)) % 360;
    const Lp = L2 - L1;
    const Cp = C2p - C1p;
    let hp = 0;
    if (C1p * C2p !== 0) {
      hp = h2p - h1p;
      if (hp > 180) {
        hp -= 360;
      } else if (hp < -180) {
        hp += 360;
      }
    }
    const Hp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(hp) / 2);
    const avgLp = (L1 + L2) / 2;
    const avgCp = (C1p + C2p) / 2;
    let avghp = (h1p + h2p) / 2;
    if (Math.abs(h1p - h2p) > 180) {
      avghp += 180;
    }
    const T = 1 - 0.17 * Math.cos(deg2rad(avghp - 30)) + 0.24 * Math.cos(deg2rad(2 * avghp)) + 0.32 * Math.cos(deg2rad(3 * avghp + 6)) - 0.2 * Math.cos(deg2rad(4 * avghp - 63));
    const SL = 1 + 0.015 * (avgLp - 50) ** 2 / Math.sqrt(20 + (avgLp - 50) ** 2);
    const SC = 1 + 0.045 * avgCp;
    const SH = 1 + 0.015 * avgCp * T;
    const θ = 30 * Math.exp((-((avghp - 275) / 25)) ** 2);
    const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
    const RT = -RC * Math.sin(deg2rad(2 * θ));
    return Math.sqrt((Lp / (kL * SL)) ** 2 + (Cp / (kC * SC)) ** 2 + (Hp / (kH * SH)) ** 2 + RT * (Cp / (kC * SC)) * (Hp / (kH * SH))) - Lp * brightness;
  }
  var COLORS = [
    [Number.NaN, Number.NaN, Number.NaN],
    [0, 0, 0],
    [0.356, 0, 0],
    [0.573, 0, 0],
    [0.864, 0, 0],
    [1, 0, 0],
    [0.31, 0.119, 0.037],
    [0.603, 0.209, 0.107],
    [0.732, 0.118, 0.137],
    [0.791, 0.039, 0.16],
    [0.895, -0.026, 0.168],
    [0.974, -0.019, 0.077],
    [0.691, -0.154, 0.075],
    [0.812, -0.185, 0.096],
    [0.898, -0.17, 0.149],
    [0.541, -0.097, 0.005],
    [0.678, -0.114, -0.018],
    [0.814, -0.15, 0.011],
    [0.447, -0.019, -0.134],
    [0.65, -0.048, -0.137],
    [0.895, -0.124, -0.027],
    [0.561, 0.054, -0.229],
    [0.771, 0, -0.11],
    [0.431, 0.145, -0.143],
    [0.557, 0.168, -0.127],
    [0.796, 0.102, -0.097],
    [0.551, 0.225, -0.023],
    [0.62, 0.238, 0],
    [0.759, 0.127, 0.006],
    [0.428, 0.036, 0.041],
    [0.552, 0.03, 0.092],
    [0.817, 0.055, 0.097],
    [0.738, 0, 0],
    [0.46, 0.163, 0.074],
    [0.735, 0.134, 0.071],
    [0.642, 0.137, 0.122],
    [0.794, 0.023, 0.054],
    [0.62, -0.005, 0.105],
    [0.747, -0.019, 0.138],
    [0.864, -0.023, 0.136],
    [0.489, -0.06, 0.058],
    [0.609, -0.092, 0.08],
    [0.76, -0.099, 0.085],
    [0.54, -0.067, -0.079],
    [0.941, -0.064, -0.007],
    [0.803, -0.05, -0.096],
    [0.438, 0.048, -0.192],
    [0.421, 0.03, -0.102],
    [0.593, 0.036, -0.119],
    [0.781, 0.031, -0.09],
    [0.757, 0.036, 0.098],
    [0.676, 0.076, 0.09],
    [0.868, 0.051, 0.061],
    [0.524, 0.087, 0.047],
    [0.684, 0.091, 0.045],
    [0.835, 0.068, 0.048],
    [0.519, 0.022, 0.034],
    [0.629, 0.017, 0.043],
    [0.342, -0.004, -0.016],
    [0.564, 0, -0.038],
    [0.789, 0.003, -0.035],
    [0.502, -0.006, 0.055],
    [0.638, -0.005, 0.047],
    [0.82, -0.007, 0.053]
  ];
  var COLORS_RGB = [
    NaN,
    0,
    3947580,
    7895160,
    13816530,
    16777215,
    6291480,
    15539236,
    16744231,
    16165385,
    16375099,
    16775868,
    964968,
    1304187,
    8912734,
    819566,
    1093286,
    1302974,
    2642078,
    4232164,
    6354930,
    7033078,
    10072571,
    7867545,
    11155641,
    14721017,
    13303930,
    15474560,
    15961513,
    6833716,
    9791530,
    16298615,
    11184810,
    10817054,
    16416882,
    14965786,
    14071188,
    10257457,
    12954929,
    15258719,
    4877114,
    5936202,
    8701299,
    1014175,
    12319474,
    8243199,
    5059000,
    4866692,
    8024516,
    11906801,
    14394467,
    13729873,
    16762277,
    10179145,
    13729912,
    16430756,
    8086354,
    10257515,
    3356993,
    7173517,
    11778513,
    7169087,
    9735275,
    13485470
  ];
  var COLORS_RGB_MAP = new Map;
  for (let index = 0;index < COLORS_RGB.length; index++)
    COLORS_RGB_MAP.set(COLORS_RGB[index], index);

  // src/world-position.ts
  var WORLD_TILE_SIZE = 1000;
  var WORLD_TILES = 2048;
  var WORLD_PIXEL_SIZE = WORLD_TILE_SIZE * WORLD_TILES;
  var FAVORITE_LOCATIONS_POSITIONS = [];
  var FAVORITE_LOCATIONS = [];
  var lastId = Date.now();
  function addFavoriteLocation(position) {
    FAVORITE_LOCATIONS_POSITIONS.push(position);
    FAVORITE_LOCATIONS.push({
      id: lastId++,
      latitude: (2 * Math.atan(Math.exp(-(position.y / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI))) - Math.PI / 2) * 180 / Math.PI,
      longitude: (position.x / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI) * 180 / Math.PI,
      name: "WBOT_FAVORITE"
    });
  }
  addFavoriteLocation({
    x: WORLD_PIXEL_SIZE / 3 | 0,
    y: WORLD_PIXEL_SIZE / 3 | 0
  });
  addFavoriteLocation({
    x: WORLD_PIXEL_SIZE / 3 * 2 | 0,
    y: WORLD_PIXEL_SIZE / 3 * 2 | 0
  });

  // src/worker.ts
  self.onmessage = async (e) => {
    if (e.data === "CLEAR_MAP_CACHE")
      mapsCache.clear();
    else {
      const data = e.data;
      await readMap(data.id, data.globalX, data.globalY, data.width, data.height);
      pixels(data);
    }
  };
  function pixels(request) {
    const {
      id,
      data,
      nativeWidth,
      nativeHeight,
      width,
      height,
      unavailableColors,
      brightness,
      colors,
      disabledColors,
      drawColorsInOrder,
      strategy,
      unownedColorStrategy,
      globalX,
      globalY
    } = request;
    let lastProgress = 0;
    let scaled;
    if (nativeWidth === width && nativeHeight === height)
      scaled = data;
    else {
      scaled = new Uint8ClampedArray(width * height * 4);
      const xRatio = nativeWidth / width;
      const yRatio = nativeHeight / height;
      for (let y = 0;y < height; y++) {
        const sy = Math.min(nativeHeight - 1, Math.floor(y * yRatio));
        for (let x = 0;x < width; x++) {
          const sx = Math.min(nativeWidth - 1, Math.floor(x * xRatio));
          const si = (sy * nativeWidth + sx) * 4;
          const di = (y * width + x) * 4;
          scaled[di] = data[si];
          scaled[di + 1] = data[si + 1];
          scaled[di + 2] = data[si + 2];
          scaled[di + 3] = data[si + 3];
        }
        const progress = y / height * 5 | 0;
        if (progress !== lastProgress) {
          lastProgress = progress;
          sendProgress(id, 0.1 + progress / 100);
        }
      }
    }
    const SIZE = width * height;
    const pixels = new Uint8Array(SIZE);
    const isSubstitute = unownedColorStrategy === "SUBSTITUTE" /* SUBSTITUTE */;
    const realPixels = isSubstitute ? new Uint8Array(SIZE) : pixels;
    const colorStat = new Map;
    const colorCache = new Map;
    for (let index = 1;index < 64; index++)
      if (!unavailableColors.has(index))
        colorCache.set(COLORS_RGB[index], [index, index]);
    let i = 0;
    let pi = 0;
    lastProgress = 0;
    for (let y = 0;y < height; y++) {
      for (let x = 0;x < width; x++) {
        const progress = pi / SIZE * 75 | 0;
        if (progress !== lastProgress) {
          lastProgress = progress;
          sendProgress(id, 0.15 + progress / 100);
        }
        const r = scaled[i];
        const g = scaled[i + 1];
        const b = scaled[i + 2];
        const a = scaled[i + 3];
        const key = r << 16 | g << 8 | b;
        let min;
        let minReal;
        if (a < 100)
          min = minReal = 0;
        else if (colorCache.has(key))
          [min, minReal] = colorCache.get(key);
        else {
          let minDelta = Infinity;
          let minDeltaReal = Infinity;
          for (let colorIndex = 1;colorIndex < 64; colorIndex++) {
            const delta = deltaE2000(rgbToOklab(r, g, b), COLORS[colorIndex], brightness);
            if (!unavailableColors.has(colorIndex) && delta < minDelta) {
              minDelta = delta;
              min = colorIndex;
            }
            if (delta < minDeltaReal) {
              minDeltaReal = delta;
              minReal = colorIndex;
            }
          }
          colorCache.set(key, [min, minReal]);
        }
        pixels[pi] = isSubstitute ? min : minReal;
        if (isSubstitute)
          realPixels[pi] = minReal;
        const stat = colorStat.get(minReal);
        if (stat)
          stat.amount++;
        else
          colorStat.set(minReal, {
            color: min,
            amount: 1,
            left: 0,
            realColor: minReal
          });
        i += 4;
        pi++;
      }
    }
    const skipColors = new Set;
    const colorsOrderMap = new Map;
    for (let index = 0;index < colors.length; index++) {
      const drawColor = colors[index];
      if (disabledColors.has(drawColor) || unavailableColors.has(drawColor))
        skipColors.add(drawColor);
      colorsOrderMap.set(drawColor, index);
    }
    const positions = strategyPosition(strategy, height, width);
    const tasks = [];
    lastProgress = 0;
    for (let index = 0;index < positions.length; index += 2) {
      const progress = index / positions.length * 10 | 0;
      if (progress !== lastProgress) {
        lastProgress = progress;
        sendProgress(id, 0.9 + progress / 100);
      }
      const dx = positions[index];
      const dy = positions[index + 1];
      const color = pixels[dy * width + dx];
      const gx = globalX + dx;
      const gy = globalY + dy;
      const map = mapsCache.get(packTile(toTile(gx), toTile(gy)));
      const mapColor = map[toTilePosition(gy) * 1000 + toTilePosition(gx)];
      if (color === mapColor)
        continue;
      const realColor = realPixels[dy * width + dx];
      colorStat.get(realColor).left++;
      if (skipColors.has(color))
        continue;
      tasks.push({
        gx,
        gy,
        color,
        realColor
      });
    }
    if (drawColorsInOrder)
      tasks.sort((a, b) => (colorsOrderMap.get(a.color) ?? 0) - (colorsOrderMap.get(b.color) ?? 0));
    const taskPositions = new Uint32Array(tasks.length * 2);
    for (let index = 0;index < tasks.length; index++) {
      const task = tasks[index];
      const dIndex = index * 2;
      taskPositions[dIndex] = task.gx;
      taskPositions[dIndex + 1] = task.gy;
    }
    postMessage({
      id,
      taskPositions,
      colorStat,
      pixels
    }, [taskPositions.buffer, pixels.buffer]);
  }
  function strategyPosition(strategy, height, width) {
    const SIZE = width * height;
    const result = new Uint16Array(SIZE * 2);
    let index = 0;
    switch (strategy) {
      case "DOWN" /* DOWN */: {
        for (let y = 0;y < height; y++)
          for (let x = 0;x < width; x++) {
            result[index] = x;
            result[index + 1] = y;
            index += 2;
          }
        break;
      }
      case "UP" /* UP */: {
        for (let y = height - 1;y >= 0; y--)
          for (let x = 0;x < width; x++) {
            result[index] = x;
            result[index + 1] = y;
            index += 2;
          }
        break;
      }
      case "LEFT" /* LEFT */: {
        for (let x = 0;x < width; x++)
          for (let y = 0;y < height; y++) {
            result[index] = x;
            result[index + 1] = y;
            index += 2;
          }
        break;
      }
      case "RIGHT" /* RIGHT */: {
        for (let x = width - 1;x >= 0; x--)
          for (let y = 0;y < height; y++) {
            result[index] = x;
            result[index + 1] = y;
            index += 2;
          }
        break;
      }
      case "RANDOM" /* RANDOM */: {
        for (let y = 0;y < height; y++)
          for (let x = 0;x < width; x++) {
            result[index] = x;
            result[index + 1] = y;
            index += 2;
          }
        for (let index = SIZE - 1;index >= 0; index--) {
          const randIndex = Math.floor(Math.random() * (index + 1)) * 2;
          const realIndex = index * 2;
          const temporaryX = result[realIndex];
          const temporaryY = result[realIndex + 1];
          result[realIndex] = result[randIndex];
          result[realIndex + 1] = result[randIndex + 1];
          result[randIndex] = temporaryX;
          result[randIndex + 1] = temporaryY;
        }
        break;
      }
      case "SPIRAL_FROM_CENTER" /* SPIRAL_FROM_CENTER */:
      case "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */: {
        const reverse = strategy === "SPIRAL_FROM_CENTER" /* SPIRAL_FROM_CENTER */;
        let idx = reverse ? SIZE - 1 : 0;
        const step = reverse ? -1 : 1;
        let top = 0, bottom = height - 1, left = 0, right = width - 1;
        while (top <= bottom && left <= right) {
          for (let x = left;x <= right; x++) {
            result[idx * 2] = x;
            result[idx * 2 + 1] = top;
            idx += step;
          }
          top++;
          for (let y = top;y <= bottom; y++) {
            result[idx * 2] = right;
            result[idx * 2 + 1] = y;
            idx += step;
          }
          right--;
          if (top <= bottom) {
            for (let x = right;x >= left; x--) {
              result[idx * 2] = x;
              result[idx * 2 + 1] = bottom;
              idx += step;
            }
            bottom--;
          }
          if (left <= right) {
            for (let y = bottom;y >= top; y--) {
              result[idx * 2] = left;
              result[idx * 2 + 1] = y;
              idx += step;
            }
            left++;
          }
        }
        break;
      }
    }
    return result;
  }
  var mapsCache = new Map;
  function readMap(id, x, y, width, height) {
    const imagesToDownload = [];
    const tileXEnd = toTile(x + width);
    const tileYEnd = toTile(y + height);
    const tileYStart = toTile(y);
    for (let tileX = toTile(x);tileX <= tileXEnd; tileX++)
      for (let tileY = tileYStart;tileY <= tileYEnd; tileY++)
        if (!mapsCache.has(packTile(tileX, tileY)))
          imagesToDownload.push({ tileX, tileY });
    let done = 0;
    return Promise.all([...imagesToDownload].map(async ({ tileX, tileY }) => {
      await updateMapPixels(tileX, tileY);
      done++;
      sendProgress(id, done / imagesToDownload.length * 0.1);
    }));
  }
  async function updateMapPixels(tileX, tileY) {
    const res = await fetch(\`https://backend.wplace.live/files/s0/tiles/\${tileX}/\${tileY}.png\`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const SIZE = bitmap.height * bitmap.width;
    const pixels = new Uint8Array(SIZE);
    for (let i = 0, pi = 0;i < data.length; i += 4, pi++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const key = r << 16 | g << 8 | b;
      pixels[pi] = a < 100 ? 0 : COLORS_RGB_MAP.get(key) ?? 0;
    }
    mapsCache.set(packTile(tileX, tileY), pixels);
    return pixels;
  }
  var packTile = (tileX, tileY) => tileX << 11 | tileY;
  var toTile = (n) => n / WORLD_TILE_SIZE | 0;
  var toTilePosition = (n) => n % WORLD_TILE_SIZE;
  function sendProgress(id, progress) {
    postMessage({
      id,
      progress
    });
  }
})();
`], { type: "application/javascript" })), {
  type: "module"
});
var pending = new Map;
var nextId = 0;
worker.onmessage = (e) => {
  const data = pending.get(e.data.id);
  if (data) {
    if ("progress" in e.data)
      data.progress?.(e.data.progress);
    else if ("error" in e.data)
      data.reject(new Error(e.data.error));
    else {
      pending.delete(e.data.id);
      data.resolve(e.data);
    }
  }
};
worker.onerror = (e) => {
  console.error("[WORKER ERRROR]", e);
};
worker.onmessageerror = (e) => {
  console.error("[WORKER MESSAGE ERRROR]", e);
};
function workerPixels(_request, progress) {
  const request = _request;
  return new Promise((resolve, reject) => {
    request.id = nextId++;
    worker.postMessage(request);
    pending.set(request.id, { resolve, progress, reject });
  });
}
function workerClearMapCache() {
  worker.postMessage("CLEAR_MAP_CACHE");
}

// src/errors.ts
class WPlaceBotError extends Error {
  name = "WPlaceBotError";
}

class NoImageError extends WPlaceBotError {
  name = "NoImageError";
  constructor() {
    super("No image is selected");
  }
}

class NoAnchorError extends WPlaceBotError {
  name = "NoAnchorError";
  constructor() {
    super("Anchors are missing. Reload the page.");
  }
}

// src/world-position.ts
var WORLD_TILE_SIZE = 1000;
var WORLD_TILES = 2048;
var WORLD_PIXEL_SIZE = WORLD_TILE_SIZE * WORLD_TILES;
var FAVORITE_LOCATIONS_POSITIONS = [];
var FAVORITE_LOCATIONS = [];
var lastId = Date.now();
function addFavoriteLocation(position) {
  FAVORITE_LOCATIONS_POSITIONS.push(position);
  FAVORITE_LOCATIONS.push({
    id: lastId++,
    latitude: (2 * Math.atan(Math.exp(-(position.y / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI))) - Math.PI / 2) * 180 / Math.PI,
    longitude: (position.x / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI) * 180 / Math.PI,
    name: "WBOT_FAVORITE"
  });
}
addFavoriteLocation({
  x: WORLD_PIXEL_SIZE / 3 | 0,
  y: WORLD_PIXEL_SIZE / 3 | 0
});
addFavoriteLocation({
  x: WORLD_PIXEL_SIZE / 3 * 2 | 0,
  y: WORLD_PIXEL_SIZE / 3 * 2 | 0
});
function extractScreenPositionFromStar($star) {
  if (!$star)
    throw new NoAnchorError;
  const [x, y] = $star.style.transform.slice(32, -31).split(", ").map((x) => Number.parseFloat(x));
  return { x, y };
}

class WorldPosition {
  bot;
  static fromJSON(bot, data) {
    return new WorldPosition(bot, ...data);
  }
  static fromScreenPosition(bot, position) {
    const { anchorScreenPosition, pixelSize, anchorWorldPosition } = bot.findAnchorsForScreen(position);
    return new WorldPosition(bot, anchorWorldPosition.x + (position.x - anchorScreenPosition.x) / pixelSize | 0, anchorWorldPosition.y + (position.y - anchorScreenPosition.y) / pixelSize | 0);
  }
  globalX = 0;
  globalY = 0;
  get tileX() {
    return this.globalX / WORLD_TILE_SIZE | 0;
  }
  set tileX(value) {
    this.globalX = value * WORLD_TILE_SIZE + this.x;
  }
  get tileY() {
    return this.globalY / WORLD_TILE_SIZE | 0;
  }
  set tileY(value) {
    this.globalY = value * WORLD_TILE_SIZE + this.y;
  }
  get x() {
    return this.globalX % WORLD_TILE_SIZE;
  }
  set x(value) {
    this.globalX = this.tileX * WORLD_TILE_SIZE + value;
  }
  get y() {
    return this.globalY % WORLD_TILE_SIZE;
  }
  set y(value) {
    this.globalY = this.tileY * WORLD_TILE_SIZE + value;
  }
  anchor1Index;
  anchor2Index;
  get pixelSize() {
    return (extractScreenPositionFromStar(this.bot.$stars[this.anchor2Index]).x - extractScreenPositionFromStar(this.bot.$stars[this.anchor1Index]).x) / (FAVORITE_LOCATIONS_POSITIONS[this.anchor2Index].x - FAVORITE_LOCATIONS_POSITIONS[this.anchor1Index].x);
  }
  constructor(bot, tileorGlobalX, tileorGlobalY, x, y) {
    this.bot = bot;
    if (x === undefined || y === undefined) {
      this.globalX = tileorGlobalX;
      this.globalY = tileorGlobalY;
    } else {
      this.globalX = tileorGlobalX * WORLD_TILE_SIZE + x;
      this.globalY = tileorGlobalY * WORLD_TILE_SIZE + y;
    }
    this.updateAnchor();
  }
  updateAnchor() {
    this.anchor1Index = 0;
    this.anchor2Index = 1;
    let min1 = Infinity;
    let min2 = Infinity;
    for (let index = 0;index < FAVORITE_LOCATIONS_POSITIONS.length; index++) {
      const { x, y } = FAVORITE_LOCATIONS_POSITIONS[index];
      if (x < this.globalX && y < this.globalY) {
        const delta = this.globalX - x + (this.globalY - y);
        if (delta < min1) {
          min1 = delta;
          this.anchor1Index = index;
        }
      } else if (x > this.globalX && y > this.globalY) {
        const delta = x - this.globalX + (y - this.globalY);
        if (delta < min2) {
          min2 = delta;
          this.anchor2Index = index;
        }
      }
    }
  }
  toScreenPosition() {
    const worldPosition = FAVORITE_LOCATIONS_POSITIONS[this.anchor1Index];
    const screenPosition = extractScreenPositionFromStar(this.bot.$stars[this.anchor1Index]);
    return {
      x: (this.globalX - worldPosition.x) * this.pixelSize + screenPosition.x,
      y: (this.globalY - worldPosition.y) * this.pixelSize + screenPosition.y
    };
  }
  moveScreenTo() {
    const { x, y } = this.toScreenPosition();
    this.bot.moveMap({
      x: x - window.innerWidth / 3,
      y: y - window.innerHeight / 3
    });
  }
  clone() {
    return new WorldPosition(this.bot, this.tileX, this.tileY, this.x, this.y);
  }
  toJSON() {
    return [this.globalX, this.globalY];
  }
}

// src/image.ts
class BotImage extends Base2 {
  bot;
  position;
  image;
  width;
  brightness;
  strategy;
  opacity;
  drawColorsInOrder;
  colors;
  disabledColors;
  lock;
  disabled;
  name;
  unownedColorStrategy;
  static async fromJSON(bot, data, progress) {
    const image = new Image;
    image.src = data.url.startsWith("http") ? await fetch(data.url, { cache: "no-store" }).then((x) => x.blob()).then((x) => URL.createObjectURL(x)) : data.url;
    await promisifyEventSource(image, ["load"], ["error"]);
    const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    const botImage = new BotImage(bot, data.position ? WorldPosition.fromJSON(bot, data.position) : undefined, canvas, data.width, data.brightness, data.strategy, data.opacity, data.drawColorsInOrder, data.colors, new Set(data.disabledColors ?? [0]), data.lock, data.disabled, data.name, data.unownedColorStrategy);
    await botImage.updatePixels(progress);
    return botImage;
  }
  pixels = new Uint8Array(0);
  resolution;
  colorsStat = new Map;
  get height() {
    return this.width / this.resolution | 0;
  }
  set height(value) {
    this.width = value * this.resolution | 0;
  }
  tasks = new Uint32Array(0);
  moveInfo;
  imageData;
  $canvas;
  context;
  $brightness;
  $colors;
  $delete;
  $drawColorsInOrder;
  $drawTransparent;
  $export;
  $lock;
  $opacity;
  $progressLine;
  $progressText;
  $resetSize;
  $resetSizeSpan;
  $settings;
  $strategy;
  $topbar;
  $wrapper;
  $name;
  $unownedColorStrategyLabel;
  $unownedColorStrategy;
  $openSettings;
  $dialog;
  constructor(bot, position = WorldPosition.fromScreenPosition(bot, {
    x: 256,
    y: 32
  }), image, width = image.width, brightness = 0, strategy = "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */, opacity = 50, drawColorsInOrder = true, colors = [], disabledColors = new Set([0]), lock = false, disabled = false, name = `${image.width}x${image.height}`, unownedColorStrategy = "BUY" /* BUY */) {
    super(image_default2, `${shared_default}
${image_default}`);
    this.bot = bot;
    this.position = position;
    this.image = image;
    this.width = width;
    this.brightness = brightness;
    this.strategy = strategy;
    this.opacity = opacity;
    this.drawColorsInOrder = drawColorsInOrder;
    this.colors = colors;
    this.disabledColors = disabledColors;
    this.lock = lock;
    this.disabled = disabled;
    this.name = name;
    this.unownedColorStrategy = unownedColorStrategy;
    this.populateElementsWithSelector({
      $brightness: ".brightness",
      $colors: ".colors",
      $delete: ".delete",
      $drawColorsInOrder: ".draw-colors-in-order",
      $drawTransparent: ".draw-transparent",
      $export: ".export",
      $lock: ".lock",
      $opacity: ".opacity",
      $progressLine: ".progress div",
      $progressText: ".progress span",
      $resetSize: ".reset-size",
      $settings: ".form",
      $strategy: ".strategy",
      $topbar: ".topbar",
      $wrapper: ".wrapper",
      $name: ".name",
      $unownedColorStrategyLabel: ".unowned-color-strategy",
      $openSettings: ".open-settings",
      $dialog: "dialog",
      $canvas: "canvas"
    });
    this.bot.images.push(this);
    this.resolution = image.width / image.height;
    this.imageData = this.image.getContext("2d").getImageData(0, 0, image.width, image.height).data;
    this.context = this.$canvas.getContext("2d");
    this.$unownedColorStrategy = this.$unownedColorStrategyLabel.querySelector("select");
    this.$resetSizeSpan = this.$resetSize.querySelector("span");
    this.$openSettings.addEventListener("click", () => {
      this.$dialog.showModal();
    });
    this.$dialog.addEventListener("click", (event) => {
      if (event.target === this.$dialog)
        this.$dialog.close();
    });
    this.$unownedColorStrategy.addEventListener("change", () => {
      this.unownedColorStrategy = this.$unownedColorStrategy.value;
      this.updateColors();
      save(this.bot);
    });
    this.$strategy.addEventListener("change", () => {
      this.strategy = this.$strategy.value;
      save(this.bot);
    });
    this.$opacity.addEventListener("input", () => {
      this.opacity = this.$opacity.valueAsNumber;
      this.$opacity.style.setProperty("--val", this.opacity + "%");
      this.updateUI();
      save(this.bot);
    });
    this.$opacity.style.setProperty("--val", this.opacity + "%");
    let timeout;
    this.$brightness.addEventListener("change", () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        this.brightness = this.$brightness.valueAsNumber;
        await this.updatePixels();
        await save(this.bot);
      }, 1000);
    });
    this.$resetSize.addEventListener("click", async () => {
      this.width = this.image.width;
      await this.updatePixels();
      await save(this.bot);
    });
    this.$drawColorsInOrder.addEventListener("click", () => {
      this.drawColorsInOrder = this.$drawColorsInOrder.checked;
      this.updateColors();
      save(this.bot);
    });
    this.$lock.addEventListener("click", () => {
      this.lock = !this.lock;
      this.updateUI();
      save(this.bot);
    });
    this.$delete.addEventListener("click", this.destroy.bind(this));
    this.$export.addEventListener("click", this.export.bind(this));
    this.$name.addEventListener("change", () => {
      this.name = this.$name.value;
      this.updateUI();
      this.bot.widget.update();
      save(this.bot);
    });
    this.bot.fixSpaceInInput(this.$name);
    this.$canvas.addEventListener("mousedown", this.moveStart.bind(this));
    this.$wrapper.addEventListener("wheel", (event) => document.querySelector(".maplibregl-canvas").dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      clientX: event.clientX,
      clientY: event.clientY
    })));
    this.registerEvent(document, "mouseup", this.moveStop.bind(this));
    this.registerEvent(document, "mousemove", this.move.bind(this));
    for (const $resize of this.shadow.querySelectorAll(".resize"))
      $resize.addEventListener("mousedown", this.resizeStart.bind(this));
  }
  async toJSON() {
    const blob = await this.image.convertToBlob({
      type: "image/webp",
      quality: 1
    });
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return {
      url,
      width: this.width,
      brightness: this.brightness,
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      disabledColors: Array.from(this.disabledColors),
      lock: this.lock,
      disabled: this.disabled,
      name: this.name,
      unownedColorStrategy: this.unownedColorStrategy,
      version: SAVE_VERSION
    };
  }
  async updatePixels(progress) {
    const progress2 = progress ?? ((p) => {
      this.bot.widget.status = `⌛ Loading ${formatPercent(p)}`;
    });
    const height = this.height;
    const width = this.width;
    const result = await workerPixels({
      data: this.imageData,
      brightness: this.brightness,
      colors: this.colors,
      disabledColors: this.disabledColors,
      drawColorsInOrder: this.drawColorsInOrder,
      globalX: this.position.globalX,
      globalY: this.position.globalY,
      height,
      width,
      nativeHeight: this.image.height,
      nativeWidth: this.image.width,
      strategy: this.strategy,
      unavailableColors: this.bot.unavailableColors,
      unownedColorStrategy: this.unownedColorStrategy
    }, progress2);
    this.colorsStat = result.colorStat;
    this.tasks = this.disabled ? new Uint32Array(0) : result.taskPositions;
    this.pixels = result.pixels;
    this.$canvas.width = width;
    this.$canvas.height = height;
    this.context.clearRect(0, 0, width, height);
    const rgbPixels = new Uint8ClampedArray(this.pixels.length * 4);
    for (let index = 0;index < this.pixels.length; index++) {
      const pixel = this.pixels[index];
      if (pixel === 0)
        continue;
      const qIndex = index * 4;
      const color = COLORS_RGB[pixel];
      rgbPixels[qIndex] = color >> 16;
      rgbPixels[qIndex + 1] = color >> 8 & 255;
      rgbPixels[qIndex + 2] = color & 255;
      rgbPixels[qIndex + 3] = 255;
    }
    this.context.putImageData(new ImageData(rgbPixels, width, height), 0, 0);
    this.updateUI();
    this.updateColors();
    if (!progress)
      this.bot.widget.status = "";
    this.bot.widget.update();
  }
  updateUI() {
    const { x, y } = this.position.toScreenPosition();
    this.element.style.transform = `translate(${x}px, ${y}px)`;
    this.element.style.width = `${this.position.pixelSize * this.width}px`;
    this.$wrapper.style.opacity = this.disabled ? "0.4" : "1";
    this.$canvas.style.opacity = `${this.opacity}%`;
    this.element.classList.remove("hidden");
    this.$resetSizeSpan.textContent = this.width.toString();
    this.$brightness.valueAsNumber = this.brightness;
    this.$strategy.value = this.strategy;
    this.$opacity.valueAsNumber = this.opacity;
    this.$drawColorsInOrder.checked = this.drawColorsInOrder;
    this.$name.value = this.name;
    const maxTasks = this.getMaxTasks();
    const doneTasks = maxTasks - this.tasks.length / 2;
    const percent = formatPercent(doneTasks / maxTasks);
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent} ETA: ${etaText(this.bot, this.tasks.length / 2)}`;
    this.$progressLine.style.transform = `scaleX(${percent})`;
    this.$wrapper.classList.toggle("no-pointer-events", this.lock);
    this.$lock.textContent = this.lock ? "\uD83D\uDD12" : "\uD83D\uDD13";
  }
  getMaxTasks() {
    let max = 0;
    for (const [color, stat] of this.colorsStat.entries())
      if (!this.disabledColors.has(color))
        max += stat.amount;
    return max;
  }
  destroy() {
    super.destroy();
    this.element.remove();
    removeFromArray(this.bot.images, this);
    this.bot.widget.update();
    save(this.bot);
  }
  updateColors() {
    const LINE_HEIGHT = 20;
    this.$unownedColorStrategyLabel.classList.toggle("hidden", this.bot.unavailableColors.size === 0);
    this.$colors.innerHTML = "";
    let pixelsSum = 0;
    for (const stat of this.colorsStat.values())
      pixelsSum += stat.amount;
    if (this.colors.length !== this.colorsStat.size || this.colors.some((x) => !this.colorsStat.has(x))) {
      this.colors = this.colorsStat.values().toArray().sort((a, b) => b.amount - a.amount).map((color) => color.realColor);
      save(this.bot);
    }
    this.$colors.style.height = `${LINE_HEIGHT * this.colors.length}px`;
    for (let index = 0;index < this.colors.length; index++) {
      const drawColor = this.colors[index];
      const css = (color) => color === 0 ? `repeating-linear-gradient(32deg, #ccc 0 8px, transparent 8px 16px)` : colorToCSS(color);
      const colorStat = this.colorsStat.get(drawColor);
      const $button = document.createElement("button");
      if (COLORS[drawColor][0] < 0.6)
        $button.classList.add("dark");
      $button.title = "Drag to reorder. Click to disable.";
      $button.style.top = `${index * LINE_HEIGHT}px`;
      if (this.disabledColors.has(drawColor)) {
        const $warning = document.createElement("div");
        $warning.innerText = "❌";
        $warning.title = "Disabled and will be skipped.";
        $button.appendChild($warning);
      }
      switch (this.unownedColorStrategy) {
        case "SUBSTITUTE" /* SUBSTITUTE */:
          $button.style.background = css(colorStat.color);
          if (colorStat.color !== colorStat.realColor) {
            const $warning = document.createElement("button");
            $warning.style.backgroundColor = css(colorStat.realColor);
            $warning.title = "This is the best color. Click to buy.";
            $warning.addEventListener("click", async () => {
              await this.bot.updateColorsData();
              document.getElementById("color-" + colorStat.realColor)?.click();
            });
            $button.appendChild($warning);
          }
          break;
        case "BUY" /* BUY */:
          $button.style.background = css(colorStat.realColor);
          if (this.bot.unavailableColors.has(colorStat.realColor)) {
            const $warning = document.createElement("div");
            $warning.innerText = "⌛";
            $warning.title = "This color be automatically bought.";
            $button.appendChild($warning);
          }
          break;
        case "SKIP" /* SKIP */:
          $button.style.background = css(colorStat.realColor);
          if (this.bot.unavailableColors.has(colorStat.realColor)) {
            const $warning = document.createElement("div");
            $warning.innerText = "⏩";
            $warning.title = "Unowned colors will be skipped.";
            $button.appendChild($warning);
          }
          break;
      }
      const $percent = document.createElement("span");
      $percent.classList.add("percent");
      const donePixels = colorStat.amount - colorStat.left;
      const donePercent = donePixels / colorStat.amount;
      const share = colorStat.amount / pixelsSum;
      $percent.innerText = `${donePixels}/${colorStat.amount}px ${formatPercent(donePercent)} (${formatPercent(share)})`;
      $button.appendChild($percent);
      this.$colors.append($button);
      let dragging = false;
      const startDrag = (startEvent) => {
        $button.classList.add("dragging");
        let newIndex = index;
        const mouseMoveHandler = (event) => {
          newIndex = Math.min(this.colors.length - 1, Math.max(0, Math.round(index + (event.clientY - startEvent.clientY) / LINE_HEIGHT)));
          if (newIndex !== index)
            dragging = true;
          let childIndex = 0;
          for (const $child of this.$colors.children) {
            if ($child === $button)
              continue;
            if (childIndex === newIndex)
              childIndex++;
            $child.style.top = `${LINE_HEIGHT * childIndex}px`;
            childIndex++;
          }
          $button.style.top = `${LINE_HEIGHT * newIndex}px`;
        };
        this.registerEvent(document, "mousemove", mouseMoveHandler);
        this.registerEvent(document, "mouseup", () => {
          $button.classList.remove("dragging");
          document.removeEventListener("mousemove", mouseMoveHandler);
          if (newIndex !== index)
            this.colors.splice(newIndex, 0, ...this.colors.splice(index, 1));
          save(this.bot);
          $button.removeEventListener("mousedown", startDrag);
          setTimeout(() => {
            this.updateColors();
          }, 200);
        }, {
          once: true
        });
      };
      $button.addEventListener("mousedown", startDrag);
      $button.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (dragging)
          return;
        if (this.disabledColors.has(drawColor))
          this.disabledColors.delete(drawColor);
        else
          this.disabledColors.add(drawColor);
        $button.classList.toggle("color-disabled");
        await this.updatePixels();
        await save(this.bot);
      });
    }
  }
  moveStart(event) {
    if (!this.lock)
      this.moveInfo = {
        globalX: this.position.globalX,
        globalY: this.position.globalY,
        clientX: event.clientX,
        clientY: event.clientY
      };
  }
  async moveStop() {
    if (this.moveInfo) {
      this.moveInfo = undefined;
      this.position.updateAnchor();
      await this.updatePixels();
    }
  }
  move(event) {
    if (!this.moveInfo)
      return;
    const deltaX = Math.round((event.clientX - this.moveInfo.clientX) / this.position.pixelSize);
    const deltaY = Math.round((event.clientY - this.moveInfo.clientY) / this.position.pixelSize);
    if (this.moveInfo.globalX !== undefined) {
      this.position.globalX = deltaX + this.moveInfo.globalX;
      if (this.moveInfo.width !== undefined)
        this.width = Math.max(1, this.moveInfo.width - deltaX);
    } else if (this.moveInfo.width !== undefined)
      this.width = Math.max(1, deltaX + this.moveInfo.width);
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY;
      if (this.moveInfo.height !== undefined)
        this.height = Math.max(1, this.moveInfo.height - deltaY);
    } else if (this.moveInfo.height !== undefined)
      this.height = Math.max(1, deltaY + this.moveInfo.height);
    this.updateUI();
    save(this.bot);
  }
  resizeStart(event) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    const $resize = event.target;
    if ($resize.classList.contains("n")) {
      this.moveInfo.height = this.height;
      this.moveInfo.globalY = this.position.globalY;
    }
    if ($resize.classList.contains("e"))
      this.moveInfo.width = this.width;
    if ($resize.classList.contains("s"))
      this.moveInfo.height = this.height;
    if ($resize.classList.contains("w")) {
      this.moveInfo.width = this.width;
      this.moveInfo.globalX = this.position.globalX;
    }
  }
  async export() {
    const a = document.createElement("a");
    document.body.append(a);
    a.href = URL.createObjectURL(new Blob([JSON.stringify(await this.toJSON())], {
      type: "application/json"
    }));
    a.download = `${this.name}.wbot`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.href = this.$canvas.toDataURL("image/webp", 1);
    a.download = `${this.name}.webp`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
}

// src/style.css
var style_default = `/* stylelint-disable declaration-no-important */
@import 'https://fonts.googleapis.com/css2?family=Tiny5&display=swap';

:root {
  --text-invert: #fff;
  --resize: 8px;
  --text: #422e2c;
  --background: #fbe3cb;
  --background-hover: #f0d1b3;
  --background-disabled: #a37648;
  --main: #66bbb4;
  --main-hover: #48a19a;
}

.maplibregl-marker[aria-label='WBOT_FAVORITE'] {
  display: none !important;
}
`;

// src/widget.css
var widget_default = `:host {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: visible;
  width: 256px;
  height: 100dvh;
  border-right: var(--text) 2px solid;
  background-color: var(--background);
  transition: transform 0.5s;
  transform: translateX(-100%);
}

:host(.open) {
  box-shadow: 8px 0 16px -8px var(--main);
  transform: translateX(0);
}

.title {
  display: block;
  width: 100%;
  border: none;
  border-bottom: var(--text) 2px solid;
  background-color: var(--main);
  color: var(--text);
  font-size: 32px;
  text-align: center;
}

.open-button {
  position: absolute;
  top: calc(50% - 24px);
  right: -24px;
  width: 24px;
  height: 48px;
  border: var(--text) 2px solid;
  border-left: none;
  background-color: var(--background);
  color: var(--text);
  cursor: pointer;
}

.open-button div {
  transition: transform 0.5s;
}

:host(.open) .open-button div {
  transform: rotate(180deg);
}

.form > .images {
  display: block;
  overflow: auto;
  height: auto;
  white-space: normal;
}

.images .item {
  display: grid;
  grid-template-areas:
    'canvas name name name'
    'canvas toggle up down';
  grid-template-columns: 48px 1fr auto auto;
  gap: 4px;
  width: 100%;
  height: 64px;
  margin-bottom: 4px;
}

.images .item canvas {
  grid-area: canvas;
  margin-right: 4px;
  cursor: pointer;
}

.images .item .name {
  display: block;
  grid-area: name;
}

.images .item .toggle {
  display: flex;
  grid-area: toggle;
  gap: 4px;
  justify-content: center;
  align-items: center;
  font-size: 18px;
}

.images .item .up {
  grid-area: up;
  font-weight: bolder;
  font-size: 24px;
  line-height: 100%;
}

.images .item .down {
  grid-area: down;
  font-weight: bolder;
  font-size: 24px;
  line-height: 100%;
}
`;

// src/widget.html
var widget_default2 = `<button class="open-button"><div>></div></button>
<input class="title" type="text" />
<div class="form">
  <div class="progress">
    <div></div>
    <span></span>
  </div>
  <div class="p status"></div>
  <button class="draw" disabled>Draw</button>
  <button class="auto-draw" disabled>Auto-Draw</button>
  <label
    >Strategy:&nbsp;<select class="strategy">
      <option value="SEQUENTIAL" selected>Sequential</option>
      <option value="ALL">All</option>
      <option value="PERCENTAGE">Percentage</option>
    </select></label
  >
  <button class="add-image" disabled>Add image</button>
  <!-- <button class="pumpkin-hunt" disabled>Pumpkin Hunt!</button> -->
  <div class="images"></div>
</div>
`;

// src/widget.ts
class Widget extends Base2 {
  bot;
  get status() {
    return this.$status.innerHTML;
  }
  set status(value) {
    this.$status.innerHTML = value;
  }
  get open() {
    return this.element.classList.contains("open");
  }
  set open(value) {
    this.element.classList.toggle("open", value);
  }
  $settings;
  $status;
  $minimize;
  $topbar;
  $title;
  $draw;
  $addImage;
  $strategy;
  $progressLine;
  $progressText;
  $images;
  $openButton;
  $autoDraw;
  constructor(bot) {
    super(widget_default2, `${shared_default}
${widget_default}`);
    this.bot = bot;
    this.populateElementsWithSelector({
      $openButton: ".open-button",
      $settings: ".form",
      $status: ".status",
      $minimize: ".minimize",
      $topbar: ".topbar",
      $title: ".title",
      $draw: ".draw",
      $addImage: ".add-image",
      $strategy: ".strategy",
      $progressLine: ".progress div",
      $progressText: ".progress span",
      $images: ".images",
      $autoDraw: ".auto-draw"
    });
    this.$openButton.addEventListener("click", () => this.open = !this.open);
    this.$title.addEventListener("change", () => {
      this.bot.title = this.$title.value.trim();
      save(this.bot);
    });
    this.bot.fixSpaceInInput(this.$title);
    this.$draw.addEventListener("click", () => this.bot.draw());
    this.$addImage.addEventListener("click", () => this.addImage());
    this.$strategy.addEventListener("change", () => {
      this.bot.strategy = this.$strategy.value;
      save(this.bot);
    });
    this.$autoDraw.addEventListener("click", () => this.bot.autoDraw());
    this.update();
    this.open = true;
  }
  addImage() {
    this.setDisabled("add-image", true);
    return this.run("Adding image", async () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,.wbot";
      input.hidden = true;
      const load = promisifyEventSource(input, ["change"], ["cancel", "error"]);
      input.click();
      await load;
      const file = input.files?.[0];
      if (!file)
        throw new NoImageError;
      await this.bot.updateColorsData();
      this.bot.updateStars();
      if (file.name.endsWith(".wbot")) {
        await BotImage.fromJSON(this.bot, migrateImage(JSON.parse(await file.text())));
      } else {
        const reader = new FileReader;
        const loaded = promisifyEventSource(reader, ["load"], ["error"]);
        reader.readAsDataURL(file);
        await loaded;
        await BotImage.fromJSON(this.bot, {
          url: reader.result
        });
      }
      await save(this.bot, true);
      document.location.reload();
    }, () => {
      this.setDisabled("add-image", false);
    });
  }
  update() {
    this.$title.value = this.bot.title;
    this.$strategy.value = this.bot.strategy;
    let maxTasks = 0;
    let totalTasks = 0;
    for (let index = 0;index < this.bot.images.length; index++) {
      const image = this.bot.images[index];
      if (image.disabled)
        continue;
      maxTasks += image.getMaxTasks();
      totalTasks += image.tasks.length / 2;
    }
    const doneTasks = maxTasks - totalTasks;
    const percent = formatPercent(doneTasks / maxTasks);
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent} ETA: ${etaText(this.bot, totalTasks)}`;
    this.$progressLine.style.transform = `scaleX(${percent})`;
    this.$images.innerHTML = "";
    for (let index = 0;index < this.bot.images.length; index++) {
      const image = this.bot.images[index];
      const $image = document.createElement("div");
      this.$images.append($image);
      $image.className = "item";
      $image.innerHTML = `
<canvas></canvas>
<input type="text" class="name">
<label class="toggle">
  <input type="checkbox" class="enabled" ${image.disabled ? "" : "checked"}>
  <span>${image.disabled ? "Disabled" : "Enabled"}</span>
</label>
<button class="up" title="Move up" ${index === 0 ? "disabled" : ""}>▴</button>
<button class="down" title="Move down" ${index === this.bot.images.length - 1 ? "disabled" : ""}>▾</button>`;
      const $canvas = $image.querySelector("canvas");
      $canvas.width = 48;
      $canvas.height = 64;
      const scale = Math.min(48 / image.width, 64 / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      $canvas.getContext("2d").drawImage(image.$canvas, (48 - w) / 2, (64 - h) / 2, w, h);
      $canvas.addEventListener("click", () => {
        image.position.moveScreenTo();
      });
      const $name = $image.querySelector(".name");
      $name.value = image.name;
      $name.addEventListener("change", () => {
        image.name = $name.value;
        image.updateUI();
        this.update();
        save(this.bot);
      });
      const $enabled = $image.querySelector(".enabled");
      $enabled.addEventListener("change", async () => {
        image.disabled = !$enabled.checked;
        await image.updatePixels();
        await save(this.bot);
      });
      this.bot.fixSpaceInInput($name);
      $image.querySelector(".up").addEventListener("click", () => {
        swap(this.bot.images, index, index - 1);
        this.update();
        save(this.bot);
      });
      $image.querySelector(".down").addEventListener("click", () => {
        swap(this.bot.images, index, index + 1);
        this.update();
        save(this.bot);
      });
    }
  }
  setDisabled(name, disabled) {
    this.shadow.querySelector("." + name).disabled = disabled;
  }
  async run(status, run, fin, emoji = "⌛") {
    const originalStatus = this.status;
    try {
      const result = await run((p) => {
        this.status = `${emoji} ${status} ${formatPercent(p)}`;
      });
      this.status = originalStatus;
      return result;
    } catch (error) {
      if (error instanceof WPlaceBotError)
        this.status = `${error instanceof WPlaceBotError ? "⚠️" : "❌"} ${status}`;
      console.error(error);
      throw error;
    } finally {
      await fin?.();
    }
  }
  minimize() {
    this.$settings.classList.toggle("hidden");
  }
}

// src/bot.ts
class WPlaceBot {
  static async create() {
    const bot = new WPlaceBot;
    return bot.widget.run("Initializing", async (progress) => {
      const save = await loadSave();
      if (save) {
        for (let index = 0;index < save.images.length; index++) {
          const image = save.images[index];
          addFavoriteLocation({
            x: image.position[0] - 1000,
            y: image.position[1] - 1000
          });
          addFavoriteLocation({
            x: image.position[0] + 1000,
            y: image.position[1] + 1000
          });
        }
        bot.strategy = save.strategy;
        bot.title = save.title;
      } else
        bot.title = "WPlace-bot";
      bot.registerFetchInterceptor();
      const style = document.createElement("style");
      style.textContent = style_default;
      document.head.append(style);
      progress(0.01);
      await bot.waitForElement(".avatar.center-absolute.absolute");
      progress(0.02);
      await bot.waitForElement(".btn.btn-primary.btn-lg.relative.z-30");
      progress(0.03);
      new MutationObserver((mutations) => {
        for (let index = 0;index < mutations.length; index++)
          if (mutations[index].removedNodes.length !== 0) {
            bot.updateStars();
            break;
          }
        for (let index = 0;index < bot.images.length; index++)
          bot.images[index].updateUI();
      }).observe(await bot.waitForElement(".maplibregl-canvas-container"), {
        attributes: true,
        childList: true,
        subtree: true
      });
      bot.updateStars();
      await wait(500);
      progress(0.04);
      await bot.updateColorsData();
      progress(0.05);
      if (save) {
        const batchSize = 1 / save.images.length;
        for (let index = 0;index < save.images.length; index++) {
          await BotImage.fromJSON(bot, save.images[index], (p) => {
            progress(0.05 + (index * batchSize + p * batchSize) * 0.95);
          });
        }
      }
      bot.widget.setDisabled("draw", false);
      bot.widget.setDisabled("auto-draw", false);
      bot.widget.setDisabled("add-image", false);
    }).catch(async (error) => {
      if (!window.confirm(`WPlace-bot couldn't load!
Do you want to DELETE ALL DATA to fix it?

ERROR: ` + error))
        throw error;
      try {
        const a = document.createElement("a");
        document.body.append(a);
        a.href = URL.createObjectURL(new Blob([JSON.stringify(await loadSave())], {
          type: "application/json"
        }));
        a.download = `Wplace-Bot-Broken-Save.txt`;
        a.click();
        window.alert(`Wplace-Bot-Broken-Save.txt is your broken save. If you ACTUALLY need data from this save, create issue on https://github.com/SoundOfTheSky/wplace-bot/issues

Developer will try to fix your save. Be vary that github issues are public, and save file contains your images and their positions in world.`);
      } finally {
        DELETE_ALL_DATA();
        document.location.reload();
      }
    });
  }
  title = "";
  unavailableColors = new Set;
  mapsCacheKeys = new Uint32Array(0);
  mapsCache = new Uint8Array(0);
  me;
  $stars = [];
  strategy = "SEQUENTIAL" /* SEQUENTIAL */;
  images = [];
  autoDrawInterval;
  widget = new Widget(this);
  markerPixelPositionResolvers = [];
  lastColor;
  draw() {
    this.widget.setDisabled("draw", true);
    this.widget.status = "";
    const $canvas = document.querySelector(".maplibregl-canvas");
    const prevent = (event) => {
      if (!event.shiftKey)
        event.stopPropagation();
    };
    return this.widget.run("Drawing", async (progress) => {
      const firstImage = this.images[0];
      if (!firstImage)
        return;
      globalThis.addEventListener("mousemove", prevent, true);
      $canvas.addEventListener("wheel", prevent, true);
      await this.widget.run("Loading", (progress) => Promise.all([
        this.updateColorsData().then(async () => {
          workerClearMapCache();
          await wait(100);
          const batchSize = 1 / this.images.length;
          for (let index = 0;index < this.images.length; index++)
            await this.images[index].updatePixels((p) => {
              progress(index * batchSize + p * batchSize);
            });
        }),
        this.zoomIn(4, $canvas),
        fetch("https://backend.wplace.live/me", {
          credentials: "include"
        }).then((x) => x.json()).then((x) => {
          this.me = x;
        })
      ]));
      const initialCharges = Math.floor(this.me.charges.count);
      let charges = initialCharges;
      let tasksLength = 0;
      const colorsToBuyMap = new Map;
      for (let index = 0;index < this.images.length; index++) {
        const image = this.images[index];
        if (image.disabled)
          continue;
        tasksLength += image.tasks.length / 2;
        if (image.unownedColorStrategy === "BUY" /* BUY */) {
          for (let index = 0;index < image.colors.length; index++) {
            const color = image.colors[index];
            if (image.disabledColors.has(color) || !this.unavailableColors.has(color))
              continue;
            const amount = image.colorsStat.get(color).amount;
            if (!colorsToBuyMap.has(color))
              colorsToBuyMap.set(color, {
                color,
                amount
              });
            else
              colorsToBuyMap.get(color).amount += amount;
          }
        }
      }
      const colorToBuy = [...colorsToBuyMap.values()].sort((a, b) => b.amount - a.amount)[0]?.color;
      if (this.me.droplets >= 2000 && colorToBuy !== undefined) {
        document.getElementById("color-" + colorToBuy)?.click();
        await wait(500);
        document.querySelector(".modal-box .flex.w-max.flex-col button")?.click();
        await wait(1000);
        await this.closeAll();
        await wait(500);
        return this.draw();
      }
      const indexes = new Map;
      const drawTask = async (image) => {
        let index = indexes.get(image);
        if (index === undefined)
          indexes.set(image, index = 0);
        const dIndex = index * 2;
        if (dIndex === image.tasks.length)
          return false;
        indexes.set(image, index + 1);
        const worldPosition = new WorldPosition(this, image.tasks[dIndex], image.tasks[dIndex + 1]);
        const color = image.pixels[(worldPosition.globalY - image.position.globalY) * image.width + (worldPosition.globalX - image.position.globalX)];
        if (this.lastColor !== color) {
          document.getElementById("color-" + color).click();
          this.lastColor = color;
        }
        const halfPixel = worldPosition.pixelSize / 2;
        const position = worldPosition.toScreenPosition();
        document.documentElement.dispatchEvent(new MouseEvent("mousemove", {
          bubbles: true,
          clientX: position.x + halfPixel,
          clientY: position.y + halfPixel,
          shiftKey: true
        }));
        document.documentElement.dispatchEvent(new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          keyCode: 32,
          which: 32,
          bubbles: true,
          cancelable: true
        }));
        document.documentElement.dispatchEvent(new KeyboardEvent("keyup", {
          key: " ",
          code: "Space",
          keyCode: 32,
          which: 32,
          bubbles: true,
          cancelable: true
        }));
        charges--;
        progress((initialCharges - charges) / initialCharges);
        await wait(1);
        return true;
      };
      switch (this.strategy) {
        case "ALL" /* ALL */: {
          while (charges > 0) {
            let end = true;
            for (let imageIndex = 0;imageIndex < this.images.length; imageIndex++) {
              const image = this.images[imageIndex];
              if (image.disabled)
                continue;
              if (await drawTask(image))
                end = false;
            }
            if (end)
              break;
          }
          break;
        }
        case "PERCENTAGE" /* PERCENTAGE */: {
          for (let taskIndex = 0;taskIndex < tasksLength && charges > 0; taskIndex++) {
            let minPercent = 1;
            let minImage;
            for (let imageIndex = 0;imageIndex < this.images.length; imageIndex++) {
              const image = this.images[imageIndex];
              if (image.disabled)
                continue;
              const percent = 1 - image.tasks.length / 2 / (image.width * image.height);
              if (percent < minPercent) {
                minPercent = percent;
                minImage = image;
              }
            }
            if (minImage)
              await drawTask(minImage);
          }
          break;
        }
        case "SEQUENTIAL" /* SEQUENTIAL */: {
          for (let imageIndex = 0;imageIndex < this.images.length; imageIndex++) {
            const image = this.images[imageIndex];
            if (image.disabled)
              continue;
            for (let i = 0;i < image.tasks.length / 2 && charges > 0; i++)
              await drawTask(image);
          }
        }
      }
      for (const [image, value] of indexes)
        image.tasks = image.tasks.subarray(value * 2);
      this.me.charges.count = 0;
      this.widget.update();
    }, () => {
      globalThis.removeEventListener("mousemove", prevent, true);
      $canvas.removeEventListener("wheel", prevent, true);
      this.widget.setDisabled("draw", false);
    });
  }
  autoDraw() {
    if (this.autoDrawInterval) {
      this.widget.$autoDraw.innerText = "Auto-Draw";
      clearInterval(this.autoDrawInterval);
      this.autoDrawInterval = undefined;
      return false;
    }
    this.widget.$autoDraw.innerText = "Auto-Draw is starting...";
    let errorCount = 0;
    let drawTime = 0;
    this.autoDrawInterval = setInterval(async () => {
      const deltaTime = drawTime - Date.now();
      if (deltaTime > 0)
        this.widget.$autoDraw.innerText = `Auto-Draw in (${formatNumber(deltaTime, 60000)})!`;
      else {
        drawTime = Date.now() + (this.me?.charges.max ?? 100) * 0.9 * 30000;
        try {
          await this.draw();
          document.querySelector(".paint-actions > *:nth-child(2) button")?.click();
          errorCount = 0;
        } catch {
          errorCount++;
          if (errorCount === 4)
            throw new Error("Error");
        }
      }
    }, 1000);
    return true;
  }
  async toJSON() {
    return {
      version: SAVE_VERSION,
      images: await Promise.all(this.images.map((x) => x.toJSON())),
      strategy: this.strategy,
      title: this.title
    };
  }
  async updateColorsData() {
    await this.openColors();
    this.unavailableColors.clear();
    const buttons = [...document.querySelectorAll("button.btn.relative.w-full")];
    if (buttons.length !== 64)
      throw new Error(`Expected 64 colors, but got ${buttons.length}`);
    for (let index = 0;index < buttons.length; index++) {
      const $button = buttons[index];
      if ($button.children.length !== 0)
        this.unavailableColors.add(Number.parseInt($button.id.slice(6)));
    }
  }
  moveMap(delta) {
    const canvas = document.querySelector(".maplibregl-canvas");
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    const endX = startX - delta.x;
    const endY = startY - delta.y;
    function fire(type, x, y) {
      canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        buttons: 1
      }));
    }
    fire("mousedown", startX, startY);
    fire("mousemove", endX, endY);
    fire("mouseup", endX, endY);
  }
  findAnchorsForScreen(position) {
    let anchorIndex = 0;
    let minI2 = 1;
    let min1 = Infinity;
    let min2 = Infinity;
    for (let index = 0;index < this.$stars.length; index++) {
      const { x, y } = extractScreenPositionFromStar(this.$stars[index]);
      if (x < position.x && y < position.y) {
        const delta = position.x - x + (position.y - y);
        if (delta < min1) {
          min1 = delta;
          anchorIndex = index;
        }
      } else if (x > position.x && y > position.y) {
        const delta = x - position.x + (y - position.y);
        if (delta < min2) {
          min2 = delta;
          minI2 = index;
        }
      }
    }
    const anchorScreenPosition = extractScreenPositionFromStar(this.$stars[anchorIndex]);
    const anchorWorldPosition = FAVORITE_LOCATIONS_POSITIONS[anchorIndex];
    return {
      anchorScreenPosition,
      anchorWorldPosition,
      pixelSize: (extractScreenPositionFromStar(this.$stars[minI2]).x - anchorScreenPosition.x) / (FAVORITE_LOCATIONS_POSITIONS[minI2].x - anchorWorldPosition.x)
    };
  }
  fixSpaceInInput(input) {
    input.addEventListener("focus", () => this.closeAll());
  }
  async openColors() {
    this.lastColor = undefined;
    document.querySelector(".flex.gap-2.px-3 > .btn-circle")?.click();
    await wait(1);
    document.querySelector(".btn.btn-primary.btn-lg.relative.z-30")?.click();
    await wait(1);
    const unfoldColors = document.querySelector("button.bottom-0");
    if (unfoldColors?.innerHTML === '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5"><path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z"></path></svg><!---->') {
      unfoldColors.click();
      await wait(1);
    }
    await this.waitForElement("button.btn.relative.w-full");
  }
  async closeAll() {
    for (const button of document.querySelectorAll("button")) {
      if (button.innerHTML === "✕" || button.innerHTML === `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"></path></svg><!---->`) {
        button.click();
        await wait(1);
      }
    }
  }
  waitForElement(selector) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  }
  updateStars() {
    this.$stars = [
      ...document.querySelectorAll(".maplibregl-marker[aria-label='WBOT_FAVORITE']")
    ].slice(0, FAVORITE_LOCATIONS.length);
  }
  async zoomIn(zoom, canvas = document.querySelector(".maplibregl-canvas")) {
    const position = this.images[0].position;
    if (position.pixelSize >= zoom)
      return;
    const event = new WheelEvent("wheel", {
      deltaY: -10,
      clientX: canvas.clientWidth / 2,
      clientY: canvas.clientHeight / 2,
      bubbles: true,
      shiftKey: true
    });
    return new Promise((resolve) => {
      function scroll() {
        if (position.pixelSize >= zoom)
          resolve();
        else
          requestAnimationFrame(scroll);
        canvas.dispatchEvent(event);
      }
      scroll();
    });
  }
  registerFetchInterceptor() {
    const originalFetch = globalThis.fetch;
    const pixelRegExp = /https:\/\/backend.wplace.live\/s\d+\/pixel\/(-?\d+)\/(-?\d+)\?x=(-?\d+)&y=(-?\d+)/;
    globalThis.fetch = async (request, options) => {
      const response = await originalFetch(request, options);
      const cloned = response.clone();
      let url = "";
      if (typeof request == "string")
        url = request;
      else if (request instanceof Request)
        url = request.url;
      else if (request instanceof URL)
        url = request.href;
      if (response.url === "https://backend.wplace.live/me") {
        this.me = await cloned.json();
        this.me.favoriteLocations.unshift(...FAVORITE_LOCATIONS);
        this.me.maxFavoriteLocations = Infinity;
        response.json = () => Promise.resolve(this.me);
      }
      const pixelMatch = pixelRegExp.exec(url);
      if (pixelMatch) {
        for (let index = 0;index < this.markerPixelPositionResolvers.length; index++)
          this.markerPixelPositionResolvers[index](new WorldPosition(this, +pixelMatch[1], +pixelMatch[2], +pixelMatch[3], +pixelMatch[4]));
        this.markerPixelPositionResolvers.length = 0;
      }
      return response;
    };
  }
}
globalThis.wbot = WPlaceBot.create();
{
  WPlaceBot
};
