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
// src/idb.ts
class IDB {
  db;
  constructor(db) {
    this.db = db;
  }
  static open(name, version, onUpgrade) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = (event) => {
        onUpgrade(req.result, event.oldVersion, event.newVersion);
      };
      req.onsuccess = () => {
        resolve(new IDB(req.result));
      };
      req.onerror = () => {
        reject(req.error ?? new Error("Unknown IDB error"));
      };
      req.onblocked = () => {
        reject(new Error(`IDB open blocked: ${name}`));
      };
    });
  }
  static delete(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => {
        resolve();
      };
      req.onerror = () => {
        reject(req.error ?? new Error("Unknown IDB error"));
      };
      req.onblocked = () => {
        reject(new Error(`IDB delete blocked: ${name}`));
      };
    });
  }
  get(store, key) {
    return this.wrap(this.t(store, "readonly").get(key));
  }
  getAll(store, query) {
    return this.wrap(this.t(store, "readonly").getAll(query));
  }
  getAllKeys(store) {
    return this.wrap(this.t(store, "readonly").getAllKeys());
  }
  put(store, value, key) {
    return this.wrap(this.t(store, "readwrite").put(value, key));
  }
  add(store, value, key) {
    return this.wrap(this.t(store, "readwrite").add(value, key));
  }
  delete(store, key) {
    return this.wrap(this.t(store, "readwrite").delete(key));
  }
  clear(store) {
    return this.wrap(this.t(store, "readwrite").clear());
  }
  count(store) {
    return this.wrap(this.t(store, "readonly").count());
  }
  close() {
    this.db.close();
  }
  t(store, mode) {
    return this.db.transaction(store, mode).objectStore(store);
  }
  wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        resolve(req.result);
      };
      req.onerror = () => {
        reject(req.error ?? new Error("Unknown IDB error"));
      };
    });
  }
}

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
var unpackRGB = (packed) => ({
  r: packed >> 16 & 255,
  g: packed >> 8 & 255,
  b: packed & 255
});
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
for (let i = 0;i < COLORS_RGB.length; i++)
  COLORS_RGB_MAP.set(COLORS_RGB[i], i);
var SRGB_TO_LINEAR = new Float64Array(256);
for (let i = 0;i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
}
var COLORS_LAB = new Array(64);
COLORS_LAB[0] = { l: 0, a: 0, b: 0 };
for (let i = 1;i < 64; i++)
  COLORS_LAB[i] = rgbToLab(unpackRGB(COLORS_RGB[i]));
function rgbToLab(rgb) {
  const rl = SRGB_TO_LINEAR[rgb.r], gl = SRGB_TO_LINEAR[rgb.g], bl = SRGB_TO_LINEAR[rgb.b];
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}
function colorToCSS(colorId) {
  if (colorId === 0)
    return "transparent";
  const color = COLORS_LAB[colorId];
  return `oklab(${color.l * 100}% ${color.a} ${color.b})`;
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
  <label class="auto-buy-colors"> <input type="checkbox" />&nbsp;Auto buy colors </label>
  <label>Opacity:&nbsp;<input class="opacity" type="range" min="0" max="100" /></label>
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
function isColorAvailable(bitmap, color) {
  return color < 32 || (bitmap & 1 << color - 32) !== 0;
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
    name: "WBOT_FAVORITE",
    longitude: posToLng(position.x),
    latitude: posToLat(position.y)
  });
}
var lngToPos = (x) => Math.round(WORLD_PIXEL_SIZE * ((x * Math.PI / 180 + Math.PI) / (2 * Math.PI)));
var latToPos = (x) => Math.round(WORLD_PIXEL_SIZE / (2 * Math.PI) * (Math.PI - Math.log(Math.tan(Math.PI / 4 + x * Math.PI / 180 / 2))));
var posToLng = (x) => (x / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI) * 180 / Math.PI;
var posToLat = (y) => (2 * Math.atan(Math.exp(-(y / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI))) - Math.PI / 2) * 180 / Math.PI;
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
  static fromTiledPosition(bot, tileX, tileY, x, y) {
    return new WorldPosition(bot, tileX * WORLD_TILE_SIZE + x, tileY * WORLD_TILE_SIZE + y);
  }
  static fromLngLat(bot, lng, lat) {
    return new WorldPosition(bot, lngToPos(lng), latToPos(lat));
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
  constructor(bot, globalX, globalY) {
    this.bot = bot;
    this.globalX = globalX;
    this.globalY = globalY;
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
  toJSON() {
    return [this.globalX, this.globalY];
  }
}

// src/image.ts
class BotImage extends Base2 {
  bot;
  template;
  image;
  strategy;
  drawColorsInOrder;
  colors;
  disabledColors;
  lock;
  disabled;
  autoBuyColors;
  static async fromJSON(bot, data) {
    let image;
    let blob;
    if (typeof data.url === "string") {
      image = new Image;
      image.src = data.url.startsWith("http") ? await fetch(data.url, { cache: "no-store" }).then((x) => x.blob()).then((x) => {
        blob = x;
        return URL.createObjectURL(x);
      }) : data.url;
      await promisifyEventSource(image, ["load"], ["error"]);
    } else {
      image = await createImageBitmap(data.url);
      blob = data.url;
    }
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    if (Number.isNaN(data.template.originalWidth))
      data.template.originalWidth = image.width;
    if (Number.isNaN(data.template.originalHeight))
      data.template.originalHeight = image.height;
    if (Number.isNaN(data.template.bounds.south))
      data.template.bounds.south = posToLat(latToPos(data.template.bounds.north) + data.template.originalHeight);
    if (Number.isNaN(data.template.bounds.east))
      data.template.bounds.east = posToLng(lngToPos(data.template.bounds.west) + data.template.originalWidth);
    const botImage = new BotImage(bot, data.template, canvas, data.strategy, data.drawColorsInOrder, data.colors, new Set(data.disabledColors ?? [0]), data.lock, data.disabled, data.autoBuyColors);
    await bot.worker.register(data.template.id, blob);
    await botImage.updatePixels();
    return botImage;
  }
  pixels = new Uint8Array(0);
  colorsCount = new Uint32Array(64);
  colorsLeft = new Uint32Array(64);
  get width() {
    const bounds = this.template.bounds;
    return lngToPos(bounds.east) - lngToPos(bounds.west);
  }
  set width(value) {
    this.template.bounds.east = posToLng(value);
  }
  get height() {
    const bounds = this.template.bounds;
    return latToPos(bounds.south) - latToPos(bounds.north);
  }
  set height(value) {
    this.template.bounds.south = posToLat(value);
  }
  tasksX = new Uint32Array(0);
  tasksY = new Uint32Array(0);
  position;
  moveInfo;
  imageData;
  $canvas;
  context;
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
  $autoBuyColorsLabel;
  $autoBuyColors;
  $openSettings;
  $dialog;
  constructor(bot, template, image, strategy = "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */, drawColorsInOrder = true, colors = [], disabledColors = new Set([0]), lock = false, disabled = false, autoBuyColors = true) {
    super(image_default2, `${shared_default}
${image_default}`);
    this.bot = bot;
    this.template = template;
    this.image = image;
    this.strategy = strategy;
    this.drawColorsInOrder = drawColorsInOrder;
    this.colors = colors;
    this.disabledColors = disabledColors;
    this.lock = lock;
    this.disabled = disabled;
    this.autoBuyColors = autoBuyColors;
    this.populateElementsWithSelector({
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
      $autoBuyColorsLabel: ".auto-buy-colors",
      $openSettings: ".open-settings",
      $dialog: "dialog",
      $canvas: "canvas"
    });
    this.bot.images.push(this);
    this.position = new WorldPosition(bot, lngToPos(this.template.bounds.west), latToPos(this.template.bounds.north));
    this.imageData = this.image.getContext("2d").getImageData(0, 0, image.width, image.height).data;
    this.context = this.$canvas.getContext("2d");
    this.$autoBuyColors = this.$autoBuyColorsLabel.querySelector("input");
    this.$resetSizeSpan = this.$resetSize.querySelector("span");
    this.$openSettings.addEventListener("click", () => {
      this.$dialog.showModal();
    });
    this.$dialog.addEventListener("click", (event) => {
      if (event.target === this.$dialog)
        this.$dialog.close();
    });
    this.$autoBuyColors.addEventListener("change", () => {
      this.autoBuyColors = this.$autoBuyColors.checked;
      this.updateColors();
      this.bot.save.save();
    });
    this.$strategy.addEventListener("change", () => {
      this.strategy = this.$strategy.value;
      this.bot.save.save();
    });
    this.$opacity.addEventListener("input", () => {
      this.template.opacity = this.$opacity.valueAsNumber;
      this.$opacity.style.setProperty("--val", this.template.opacity + "%");
      this.updateUI();
      this.bot.save.save();
    });
    this.$opacity.style.setProperty("--val", this.template.opacity + "%");
    this.$resetSize.addEventListener("click", async () => {
      this.width = this.template.originalWidth;
      this.height = this.template.originalHeight;
      await this.updatePixels();
      await this.bot.save.save();
    });
    this.$drawColorsInOrder.addEventListener("click", () => {
      this.drawColorsInOrder = this.$drawColorsInOrder.checked;
      this.updateColors();
      this.bot.save.save();
    });
    this.$lock.addEventListener("click", () => {
      this.lock = !this.lock;
      this.updateUI();
      this.bot.save.save();
    });
    this.$delete.addEventListener("click", this.destroy.bind(this));
    this.$export.addEventListener("click", this.exportSaveFile.bind(this));
    this.$name.addEventListener("change", () => {
      this.template.name = this.$name.value;
      this.updateUI();
      this.bot.widget.update();
      this.bot.save.save();
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
  async toJSON(exportBlob) {
    const blob = await this.image.convertToBlob({ type: "image/png", quality: 1 });
    let url = blob;
    if (!exportBlob) {
      url = await new Promise((resolve, reject) => {
        const reader = new FileReader;
        reader.onload = () => {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return {
      id: this.template.id,
      url,
      template: this.template,
      strategy: this.strategy,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      disabledColors: Array.from(this.disabledColors),
      lock: this.lock,
      disabled: this.disabled,
      autoBuyColors: this.autoBuyColors,
      version: SAVE_VERSION
    };
  }
  async updatePixels() {
    const result = await this.bot.worker.process({
      colorMetric: this.template.colorMetric,
      dithering: this.template.dithering,
      globalX: this.position.globalX,
      globalY: this.position.globalY,
      sourceName: this.template.id,
      strategy: this.strategy,
      targetHeight: this.height,
      targetWidth: this.width,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      extraColorsBitmap: this.template.colorPaletteMode === "unlocked" ? this.bot.me.extraColorsBitmap : this.template.colorPaletteMode === "free" ? 0 : 4294967295
    });
    this.colorsCount = result.colorsCount;
    this.colorsLeft = result.colorsLeft;
    this.pixels = result.pixels;
    this.tasksX = result.x;
    this.tasksY = result.y;
    this.$canvas.width = this.width;
    this.$canvas.height = this.height;
    this.context.clearRect(0, 0, this.width, this.height);
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
    this.context.putImageData(new ImageData(rgbPixels, this.width, this.height), 0, 0);
    this.updateUI();
    this.updateColors();
    this.bot.widget.update();
  }
  updateUI() {
    const { x, y } = this.position.toScreenPosition();
    this.element.style.transform = `translate(${x}px, ${y}px)`;
    this.element.style.width = `${this.position.pixelSize * this.width}px`;
    this.$wrapper.style.opacity = this.disabled ? "0.4" : "1";
    this.$canvas.style.opacity = `${this.template.opacity}%`;
    this.element.classList.remove("hidden");
    this.$resetSizeSpan.textContent = this.width.toString();
    this.$strategy.value = this.strategy;
    this.$opacity.valueAsNumber = this.template.opacity;
    this.$drawColorsInOrder.checked = this.drawColorsInOrder;
    this.$name.value = this.template.name;
    const maxTasks = this.getMaxTasks();
    const doneTasks = maxTasks - this.tasksX.length;
    const percent = formatPercent(doneTasks / maxTasks);
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent} ETA: ${etaText(this.bot, this.tasksX.length)}`;
    this.$progressLine.style.transform = `scaleX(${percent})`;
    this.$wrapper.classList.toggle("no-pointer-events", this.lock);
    this.$lock.textContent = this.lock ? "\uD83D\uDD12" : "\uD83D\uDD13";
  }
  getMaxTasks() {
    let max = 0;
    for (let index = 0;index < 64; index++)
      if (!this.disabledColors.has(index))
        max += this.colorsCount[index];
    return max;
  }
  destroy() {
    super.destroy();
    this.element.remove();
    removeFromArray(this.bot.images, this);
    this.bot.widget.update();
    this.bot.save.save();
  }
  updateColors() {
    const LINE_HEIGHT = 20;
    this.$autoBuyColorsLabel.classList.toggle("hidden", this.bot.me.extraColorsBitmap === 4294967295);
    this.$colors.innerHTML = "";
    let pixelsSum = 0;
    const colorsToBe = new Set;
    for (let index = 0;index < 64; index++) {
      const x = this.colorsCount[index];
      if (x === 0)
        continue;
      pixelsSum += x;
      colorsToBe.add(x);
    }
    if (this.colors.length !== colorsToBe.size || this.colors.some((x) => !colorsToBe.has(x))) {
      this.colors.length = 0;
      for (let index = 0;index < 64; index++) {
        const x = this.colorsCount[index];
        if (x === 0)
          continue;
        this.colors.push(x);
      }
      this.colors.sort((a, b) => this.colorsCount[b] - this.colorsCount[a]);
      this.bot.save.save();
    }
    this.$colors.style.height = `${LINE_HEIGHT * this.colors.length}px`;
    for (let index = 0;index < this.colors.length; index++) {
      const drawColor = this.colors[index];
      const count = this.colorsCount[drawColor];
      const left = this.colorsLeft[drawColor];
      const css = (color) => color === 0 ? `repeating-linear-gradient(32deg, #ccc 0 8px, transparent 8px 16px)` : colorToCSS(color);
      const $button = document.createElement("button");
      if (COLORS_LAB[drawColor].l < 0.6)
        $button.classList.add("dark");
      $button.title = "Drag to reorder. Click to disable.";
      $button.style.top = `${index * LINE_HEIGHT}px`;
      if (this.disabledColors.has(drawColor)) {
        const $warning = document.createElement("div");
        $warning.innerText = "❌";
        $warning.title = "Disabled and will be skipped.";
        $button.appendChild($warning);
      }
      $button.style.background = css(drawColor);
      if (!isColorAvailable(this.bot.me.extraColorsBitmap, drawColor)) {
        const $warning = document.createElement("div");
        if (this.autoBuyColors) {
          $warning.innerText = "⌛";
          $warning.title = "This color be automatically bought.";
        } else {
          $warning.innerText = "⏩";
          $warning.title = "Unowned colors will be skipped.";
        }
        $button.appendChild($warning);
      }
      const $percent = document.createElement("span");
      $percent.classList.add("percent");
      const donePixels = count - left;
      $percent.innerText = `${donePixels}/${count}px ${formatPercent(donePixels / count)} (${formatPercent(count / pixelsSum)})`;
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
          this.bot.save.save();
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
        await this.bot.save.save();
      });
    }
  }
  posToTemplate() {
    this.template.bounds.east = posToLng(this.position.globalX);
    this.template.bounds.north = posToLat(this.position.globalY);
  }
  posFromTemplate() {
    this.position.globalX = lngToPos(this.template.bounds.east);
    this.position.globalY = latToPos(this.template.bounds.north);
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
      await this.updatePixels();
    }
  }
  move(event) {
    if (!this.moveInfo)
      return;
    const deltaX = Math.round((event.clientX - this.moveInfo.clientX) / this.position.pixelSize);
    const deltaY = Math.round((event.clientY - this.moveInfo.clientY) / this.position.pixelSize);
    const resolution = this.template.originalWidth / this.template.originalHeight;
    if (this.moveInfo.globalX !== undefined) {
      this.position.globalX = deltaX + this.moveInfo.globalX;
      if (this.moveInfo.width !== undefined) {
        this.width = Math.max(1, this.moveInfo.width - deltaX);
        this.height = this.width / resolution | 0;
      }
    } else if (this.moveInfo.width !== undefined) {
      this.width = Math.max(1, deltaX + this.moveInfo.width);
      this.height = this.width / resolution | 0;
    }
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY;
      if (this.moveInfo.height !== undefined) {
        this.height = Math.max(1, this.moveInfo.height - deltaY);
        this.width = this.height * resolution | 0;
      }
    } else if (this.moveInfo.height !== undefined) {
      this.height = Math.max(1, deltaY + this.moveInfo.height);
      this.width = this.height * resolution | 0;
    }
    this.position.updateAnchor();
    this.posToTemplate();
    this.updateUI();
    this.bot.save.save();
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
  async exportSaveFile() {
    const a = document.createElement("a");
    document.body.append(a);
    a.href = URL.createObjectURL(new Blob([JSON.stringify(await this.toJSON())], {
      type: "application/json"
    }));
    a.download = `${this.template.name}.wbot`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.href = this.$canvas.toDataURL("image/png", 1);
    a.download = `${this.template.name}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
}

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
      this.bot.save.save();
    });
    this.bot.fixSpaceInInput(this.$title);
    this.$draw.addEventListener("click", () => this.bot.draw());
    this.$addImage.addEventListener("click", () => this.addImage());
    this.$strategy.addEventListener("change", () => {
      this.bot.strategy = this.$strategy.value;
      this.bot.save.save();
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
      this.bot.updateStars();
      if (file.name.endsWith(".wbot")) {
        await BotImage.fromJSON(this.bot, JSON.parse(await file.text()));
      } else {
        const reader = new FileReader;
        const loaded = promisifyEventSource(reader, ["load"], ["error"]);
        reader.readAsDataURL(file);
        await loaded;
        const position = WorldPosition.fromScreenPosition(this.bot, {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
        await BotImage.fromJSON(this.bot, {
          url: reader.result,
          template: {
            bounds: {
              west: posToLng(position.globalX),
              north: posToLat(position.globalY),
              east: NaN,
              south: NaN
            },
            colorMetric: "lab",
            colorPaletteMode: "all",
            dithering: false,
            hasPlaced: true,
            id: crypto.randomUUID(),
            locked: false,
            name: file.name ?? "New image",
            opacity: 0.5,
            order: this.bot.images.reduce((p, x) => x.template.order > p ? x.template.order : p, -1) + 1,
            originalHeight: NaN,
            originalWidth: NaN,
            updatedAt: Date.now(),
            useLegacyColors: false,
            visible: false
          }
        });
      }
      await this.bot.save.save(true);
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
      totalTasks += image.tasksX.length;
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
      $name.value = image.template.name;
      $name.addEventListener("change", () => {
        image.template.name = $name.value;
        image.updateUI();
        this.update();
        this.bot.save.save();
      });
      const $enabled = $image.querySelector(".enabled");
      $enabled.addEventListener("change", async () => {
        image.disabled = !$enabled.checked;
        await image.updatePixels();
        await this.bot.save.save();
      });
      this.bot.fixSpaceInInput($name);
      $image.querySelector(".up").addEventListener("click", () => {
        swap(this.bot.images, index, index - 1);
        this.update();
        this.bot.save.save();
      });
      $image.querySelector(".down").addEventListener("click", () => {
        swap(this.bot.images, index, index + 1);
        this.update();
        this.bot.save.save();
      });
    }
  }
  setDisabled(name, disabled) {
    this.shadow.querySelector("." + name).disabled = disabled;
  }
  async run(status, run, fin) {
    const originalStatus = this.status;
    try {
      const result = await run();
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

// src/save.ts
var SAVE_VERSION = 5;
var WPLACE_IDB_VERSION = 4;
var WPLACE_TEMPLATE_LS_KEY = "template-overlays";
var LS_KEY = "tamplate-overlays";
var IDB_KEY = "wplace-templates";

class SaveSystem {
  bot;
  idb = IDB.open(IDB_KEY, WPLACE_IDB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(IDB_KEY))
      db.createObjectStore(IDB_KEY);
  });
  localStorageSetItem = localStorage.setItem.bind(localStorage);
  saveTimeout;
  constructor(bot) {
    this.bot = bot;
    localStorage.setItem = (key, value) => {
      if (key === WPLACE_TEMPLATE_LS_KEY)
        this.load();
      return this.localStorageSetItem(key, value);
    };
  }
  async deleteAllData() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(WPLACE_TEMPLATE_LS_KEY);
    await IDB.delete(IDB_KEY);
  }
  async save(immediate) {
    clearTimeout(this.saveTimeout);
    const saveImmediate = async () => {
      const idb = await this.idb;
      const data = await this.bot.toJSON(true);
      await Promise.all(data.images.map((x) => idb.put("images", x.url, x.template.id)));
      this.localStorageSetItem(WPLACE_TEMPLATE_LS_KEY, JSON.stringify(data.images.map((x) => x.template)));
      this.localStorageSetItem(LS_KEY, JSON.stringify(data.images.map((x) => {
        const copy = structuredClone(x);
        delete copy.url;
        delete copy.template;
        return copy;
      })));
    };
    if (immediate)
      await saveImmediate();
    else
      await new Promise((resolve, reject) => {
        this.saveTimeout = setTimeout(async () => {
          try {
            await saveImmediate();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000);
      });
  }
  async load(isInitial) {
    let templates;
    try {
      templates = JSON.parse(localStorage.getItem(WPLACE_TEMPLATE_LS_KEY) ?? "[]");
    } catch {
      templates = [];
    }
    let save;
    try {
      save = JSON.parse(localStorage.getItem(LS_KEY) ?? "{");
    } catch {
      save = {
        images: [],
        strategy: "SEQUENTIAL" /* SEQUENTIAL */,
        title: "WPlaceBot",
        version: SAVE_VERSION
      };
    }
    if (isInitial) {
      for (let index = 0;index < save.images.length; index++) {
        const image = save.images[index];
        addFavoriteLocation({
          x: lngToPos(image.template.bounds.west) - 1000,
          y: latToPos(image.template.bounds.north) - 1000
        });
        addFavoriteLocation({
          x: lngToPos(image.template.bounds.east) + 1000,
          y: latToPos(image.template.bounds.south) + 1000
        });
      }
    }
    this.bot.title = save.title;
    this.bot.strategy = save.strategy;
    const imagesSave = new Map;
    for (let index = 0;index < this.bot.images.length; index++)
      this.bot.images[index].destroy();
    for (let index = 0;index < save.images.length; index++)
      imagesSave.set(save.images[index].id, save.images[index]);
    const idb = await this.idb;
    await this.bot.waitForElement(".avatar.center-absolute.absolute");
    await this.bot.waitForElement(".btn.btn-primary.btn-lg.relative.z-30");
    await this.bot.waitForElement(".maplibregl-canvas-container");
    await wait(500);
    this.bot.updateStars();
    for (let index = 0;index < templates.length; index++) {
      const template = templates[index];
      const blob = await idb.get("images", template.id);
      await BotImage.fromJSON(this.bot, {
        ...imagesSave.get(template.id),
        url: blob,
        template,
        version: SAVE_VERSION
      });
    }
    this.bot.widget.update();
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

// src/worker-client.ts
class ImageProcessingWorker {
  worker;
  successHandlers = new Map;
  errorHandlers = new Map;
  constructor() {
    this.worker = new Worker(URL.createObjectURL(new Blob([`(() => {
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
  var __returnValue = (v) => v;
  function __exportSetter(name, newValue) {
    this[name] = __returnValue.bind(null, newValue);
  }
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: __exportSetter.bind(all, name)
      });
  };

  // src/worker.ts
  var exports_worker = {};
  __export(exports_worker, {
    nearestColorIndex: () => nearestColorIndex,
    quantize: () => quantize,
    resizeNearestNeighbor: () => resizeNearestNeighbor
  });

  // src/colors.ts
  var packRGB = (rgb) => rgb.r << 16 | rgb.g << 8 | rgb.b;
  var unpackRGB = (packed) => ({
    r: packed >> 16 & 255,
    g: packed >> 8 & 255,
    b: packed & 255
  });
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
  for (let i = 0;i < COLORS_RGB.length; i++)
    COLORS_RGB_MAP.set(COLORS_RGB[i], i);
  var SRGB_TO_LINEAR = new Float64Array(256);
  for (let i = 0;i < 256; i++) {
    const c = i / 255;
    SRGB_TO_LINEAR[i] = c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  }
  var COLORS_LAB = new Array(64);
  COLORS_LAB[0] = { l: 0, a: 0, b: 0 };
  for (let i = 1;i < 64; i++)
    COLORS_LAB[i] = rgbToLab(unpackRGB(COLORS_RGB[i]));
  function rgbToLab(rgb) {
    const rl = SRGB_TO_LINEAR[rgb.r], gl = SRGB_TO_LINEAR[rgb.g], bl = SRGB_TO_LINEAR[rgb.b];
    let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
    let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
    x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
    return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
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
  // node_modules/@softsky/utils/dist/signals.js
  var effectsMap = new WeakMap;
  // src/utils.ts
  function isColorAvailable(bitmap, color) {
    return color < 32 || (bitmap & 1 << color - 32) !== 0;
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
      name: "WBOT_FAVORITE",
      longitude: posToLng(position.x),
      latitude: posToLat(position.y)
    });
  }
  var posToLng = (x) => (x / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI) * 180 / Math.PI;
  var posToLat = (y) => (2 * Math.atan(Math.exp(-(y / WORLD_PIXEL_SIZE * (2 * Math.PI) - Math.PI))) - Math.PI / 2) * 180 / Math.PI;
  addFavoriteLocation({
    x: WORLD_PIXEL_SIZE / 3 | 0,
    y: WORLD_PIXEL_SIZE / 3 | 0
  });
  addFavoriteLocation({
    x: WORLD_PIXEL_SIZE / 3 * 2 | 0,
    y: WORLD_PIXEL_SIZE / 3 * 2 | 0
  });

  // src/worker.ts
  var TAU = 2 * Math.PI;
  var POW7_25 = 6103515625;
  var DEG30_RAD = 0.5235987755982988;
  var toTile = (n) => Math.floor(n / WORLD_TILE_SIZE);
  var toTilePos = (n) => (n % WORLD_TILE_SIZE + WORLD_TILE_SIZE) % WORLD_TILE_SIZE;
  var packTile = (tx, ty) => tx << 11 | ty;
  var tileCache = new Map;
  var tileInFlight = new Map;
  var sources = new Map;
  self.onmessage = handleMessage;
  function cie94Distance(sample, candidate) {
    const dL = sample.l - candidate.l;
    const da = sample.a - candidate.a;
    const db = sample.b - candidate.b;
    const c1 = Math.sqrt(sample.a * sample.a + sample.b * sample.b);
    const c2 = Math.sqrt(candidate.a * candidate.a + candidate.b * candidate.b);
    const dC = c1 - c2;
    let dHSq = da * da + db * db - dC * dC;
    if (dHSq < 0)
      dHSq = 0;
    const dH = Math.sqrt(dHSq);
    const sC = 1 + 0.045 * c1;
    const sH = 1 + 0.015 * c1;
    const termC = dC / sC;
    const termH = dH / sH;
    const sumSq = dL * dL + termC * termC + termH * termH;
    return sumSq < 0 ? 0 : Math.sqrt(sumSq);
  }
  function pow7(x) {
    const sq = x * x;
    return sq * sq * sq * x;
  }
  function atan2Normalized(y, x) {
    const a = Math.atan2(y, x);
    return a < 0 ? a + TAU : a;
  }
  function ciede2000DistanceSquared(sample, candidate) {
    const c1 = Math.sqrt(sample.a * sample.a + sample.b * sample.b);
    const c2 = Math.sqrt(candidate.a * candidate.a + candidate.b * candidate.b);
    const cBar7 = pow7((c1 + c2) * 0.5);
    const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + POW7_25)));
    const a1p = (1 + g) * sample.a, a2p = (1 + g) * candidate.a;
    const c1p = Math.sqrt(a1p * a1p + sample.b * sample.b);
    const c2p = Math.sqrt(a2p * a2p + candidate.b * candidate.b);
    const c1pc2p = c1p * c2p;
    const h1p = c1p === 0 ? 0 : atan2Normalized(sample.b, a1p);
    const h2p = c2p === 0 ? 0 : atan2Normalized(candidate.b, a2p);
    const deltaLp = candidate.l - sample.l;
    const deltaCp = c2p - c1p;
    let deltahp = 0;
    if (c1pc2p !== 0) {
      deltahp = h2p - h1p;
      if (deltahp > Math.PI)
        deltahp -= TAU;
      else if (deltahp < -Math.PI)
        deltahp += TAU;
    }
    const deltaHp = c1pc2p === 0 ? 0 : 2 * Math.sqrt(c1pc2p) * Math.sin(deltahp * 0.5);
    const lBarP = (sample.l + candidate.l) * 0.5;
    const cBarP = (c1p + c2p) * 0.5;
    let hBarP = h1p + h2p;
    if (c1pc2p !== 0) {
      hBarP = Math.abs(h1p - h2p) > Math.PI ? hBarP < TAU ? (hBarP + TAU) * 0.5 : (hBarP - TAU) * 0.5 : hBarP * 0.5;
    }
    const tWeight = 1 - 0.17 * Math.cos(hBarP - DEG30_RAD) + 0.24 * Math.cos(2 * hBarP) + 0.32 * Math.cos(3 * hBarP + 0.10471975511965977) - 0.2 * Math.cos(4 * hBarP - 1.0995574287564276);
    const deltaTheta = DEG30_RAD * Math.exp(-(((hBarP - 4.799655442984406) / 0.4363323129985824) ** 2));
    const cBarP7 = pow7(cBarP);
    const rC = 2 * Math.sqrt(cBarP7 / (cBarP7 + POW7_25));
    const lMinus50Sq = (lBarP - 50) * (lBarP - 50);
    const sL = 1 + 0.015 * lMinus50Sq / Math.sqrt(20 + lMinus50Sq);
    const sC = 1 + 0.045 * cBarP;
    const sH = 1 + 0.015 * cBarP * tWeight;
    const rT = -Math.sin(2 * deltaTheta) * rC;
    const termL = deltaLp / sL, termC = deltaCp / sC, termH = deltaHp / sH;
    const result = termL * termL + termC * termC + termH * termH + rT * termC * termH;
    return result > 0 ? result : 0;
  }
  function redmeanDistanceSquared(rgb1, rgb2) {
    const rMean = (rgb1.r + rgb2.r) / 2;
    const dr = rgb1.r - rgb2.r, dg = rgb1.g - rgb2.g, db = rgb1.b - rgb2.b;
    const wR = 2 + rMean / 256;
    const wB = 2 + (255 - rMean) / 256;
    return wR * dr * dr + 4 * dg * dg + wB * db * db;
  }
  function nearestColorIndex(rgb, metric, allowed) {
    let bestIdx = 1;
    let bestDist = Infinity;
    const n = allowed ? allowed.length : 63;
    if (metric === "compuphase") {
      for (let k = 0;k < n; k++) {
        const idx = allowed ? allowed[k] : k + 1;
        if (idx === 0)
          continue;
        const v = COLORS_RGB[idx];
        const rgb2 = unpackRGB(v);
        const dist = redmeanDistanceSquared(rgb, rgb2);
        if (dist < bestDist || dist === bestDist && idx < bestIdx) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
      return bestIdx;
    }
    const sample = rgbToLab(rgb);
    const distanceFn = metric === "ciede2000" ? ciede2000DistanceSquared : cie94Distance;
    for (let k = 0;k < n; k++) {
      const idx = allowed ? allowed[k] : k + 1;
      if (idx === 0)
        continue;
      const dist = distanceFn(sample, COLORS_LAB[idx]);
      if (dist < bestDist || dist === bestDist && idx < bestIdx) {
        bestDist = dist;
        bestIdx = idx;
      }
    }
    return bestIdx;
  }
  function resizeNearestNeighbor(src, srcW, srcH, dstW, dstH) {
    if (srcW === dstW && srcH === dstH)
      return src;
    const dst = new Uint8Array(dstW * dstH * 4);
    const colMap = new Uint32Array(dstW);
    for (let x = 0;x < dstW; x++)
      colMap[x] = Math.min(srcW - 1, Math.floor(x * srcW / dstW));
    for (let y = 0;y < dstH; y++) {
      const sy = Math.min(srcH - 1, Math.floor(y * srcH / dstH));
      const srcRow = sy * srcW;
      const dstRow = y * dstW;
      for (let x = 0;x < dstW; x++) {
        const si = (srcRow + colMap[x]) * 4;
        const di = (dstRow + x) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    return dst;
  }
  function strategyPositions(strategy, width, height) {
    const size = width * height;
    const result = new Uint32Array(size * 2);
    let idx = 0;
    switch (strategy) {
      case "DOWN" /* DOWN */:
        for (let y = 0;y < height; y++)
          for (let x = 0;x < width; x++) {
            result[idx++] = x;
            result[idx++] = y;
          }
        break;
      case "UP" /* UP */:
        for (let y = height - 1;y >= 0; y--)
          for (let x = 0;x < width; x++) {
            result[idx++] = x;
            result[idx++] = y;
          }
        break;
      case "LEFT" /* LEFT */:
        for (let x = 0;x < width; x++)
          for (let y = 0;y < height; y++) {
            result[idx++] = x;
            result[idx++] = y;
          }
        break;
      case "RIGHT" /* RIGHT */:
        for (let x = width - 1;x >= 0; x--)
          for (let y = 0;y < height; y++) {
            result[idx++] = x;
            result[idx++] = y;
          }
        break;
      case "RANDOM" /* RANDOM */: {
        for (let y = 0;y < height; y++)
          for (let x = 0;x < width; x++) {
            result[idx++] = x;
            result[idx++] = y;
          }
        for (let i = size - 1;i >= 0; i--) {
          const j = Math.floor(Math.random() * (i + 1)) * 2;
          const ri = i * 2;
          const tx = result[ri], ty = result[ri + 1];
          result[ri] = result[j];
          result[ri + 1] = result[j + 1];
          result[j] = tx;
          result[j + 1] = ty;
        }
        break;
      }
      case "SPIRAL_FROM_CENTER" /* SPIRAL_FROM_CENTER */:
      case "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */: {
        const reverse = strategy === "SPIRAL_FROM_CENTER" /* SPIRAL_FROM_CENTER */;
        let i = reverse ? size - 1 : 0;
        const step = reverse ? -1 : 1;
        let top = 0, bottom = height - 1, left = 0, right = width - 1;
        while (top <= bottom && left <= right) {
          for (let x = left;x <= right; x++) {
            result[i * 2] = x;
            result[i * 2 + 1] = top;
            i += step;
          }
          top++;
          for (let y = top;y <= bottom; y++) {
            result[i * 2] = right;
            result[i * 2 + 1] = y;
            i += step;
          }
          right--;
          if (top <= bottom) {
            for (let x = right;x >= left; x--) {
              result[i * 2] = x;
              result[i * 2 + 1] = bottom;
              i += step;
            }
            bottom--;
          }
          if (left <= right) {
            for (let y = bottom;y >= top; y--) {
              result[i * 2] = left;
              result[i * 2 + 1] = y;
              i += step;
            }
            left++;
          }
        }
        break;
      }
    }
    return result;
  }
  async function fetchTile(tileX, tileY) {
    const key = packTile(tileX, tileY);
    const cached = tileCache.get(key);
    if (cached)
      return cached;
    const inFlight = tileInFlight.get(key);
    if (inFlight)
      return inFlight;
    const promise = (async () => {
      try {
        const res = await fetch(\`https://backend.wplace.live/files/s0/tiles/\${tileX}/\${tileY}.png\`);
        if (!res.ok)
          throw new Error(\`tile \${tileX},\${tileY} fetch failed: \${res.status}\`);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const out = new Uint8Array(bitmap.width * bitmap.height);
        for (let i = 0, pi = 0;i < data.length; i += 4, pi++) {
          const a = data[i + 3];
          out[pi] = a < 16 ? 0 : COLORS_RGB_MAP.get(packRGB({ r: data[i], g: data[i + 1] << 8, b: data[i + 2] })) ?? 0;
        }
        tileCache.set(key, out);
        bitmap.close();
        return out;
      } catch {
        const empty = new Uint8Array(WORLD_TILE_SIZE * WORLD_TILE_SIZE);
        tileCache.set(key, empty);
        return empty;
      } finally {
        tileInFlight.delete(key);
      }
    })();
    tileInFlight.set(key, promise);
    return promise;
  }
  function ensureTiles(globalX, globalY, width, height) {
    const jobs = [];
    const tx0 = toTile(globalX), tx1 = toTile(globalX + width - 1);
    const ty0 = toTile(globalY), ty1 = toTile(globalY + height - 1);
    for (let tx = tx0;tx <= tx1; tx++)
      for (let ty = ty0;ty <= ty1; ty++)
        if (!tileCache.has(packTile(tx, ty)))
          jobs.push(fetchTile(tx, ty));
    return Promise.all(jobs);
  }
  function readTilePixel(gx, gy) {
    const tile = tileCache.get(packTile(toTile(gx), toTile(gy)));
    return tile[toTilePos(gy) * WORLD_TILE_SIZE + toTilePos(gx)] ?? 0;
  }
  async function decodeBlob(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    return { pixels: data, width, height };
  }
  function send(msg, transfer = []) {
    postMessage(msg, transfer);
  }
  function handleMessage(e) {
    const req = e.data;
    switch (req.type) {
      case "register": {
        decodeBlob(req.blob).then((source) => {
          sources.set(req.name, source);
          send({ type: "success", id: req.id });
        }).catch((err) => send({
          type: "error",
          id: req.id,
          message: err instanceof Error ? err.message : "decode failed"
        }));
        return;
      }
      case "clear-map-cache": {
        tileCache.clear();
        return;
      }
      case "process": {
        process(req);
        return;
      }
    }
  }
  function quantize(rgba, width, height, metric, dithering, allowed, cache) {
    const out = new Uint8Array(width * height);
    if (!dithering) {
      for (let py = 0, pi = 0;py < height; py++) {
        for (let px = 0;px < width; px++, pi++) {
          const i = pi * 4;
          const a = rgba[i + 3];
          if (a < 16) {
            out[pi] = 0;
            continue;
          }
          const rgb = { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] };
          const key = packRGB(rgb);
          let idx = cache.get(key);
          if (idx === undefined) {
            idx = nearestColorIndex(rgb, metric, allowed);
            cache.set(key, idx);
          }
          out[pi] = idx;
        }
      }
      return out;
    }
    const rowSize = width * 3;
    let errCurrent = new Float32Array(rowSize);
    let errNext = new Float32Array(rowSize);
    for (let row = 0;row < height; row++) {
      const swap = errCurrent;
      errCurrent = errNext;
      errNext = swap;
      errNext.fill(0);
      for (let col = 0;col < width; col++) {
        const pi = row * width + col;
        const i = pi * 4;
        if (rgba[i + 3] < 16) {
          out[pi] = 0;
          continue;
        }
        const e = col * 3;
        const rgb = {
          r: Math.min(255, Math.max(0, Math.round(rgba[i] + errCurrent[e]))),
          g: Math.min(255, Math.max(0, Math.round(rgba[i + 1] + errCurrent[e + 1]))),
          b: Math.min(255, Math.max(0, Math.round(rgba[i + 2] + errCurrent[e + 2])))
        };
        const key = packRGB(rgb);
        let idx = cache.get(key);
        if (idx === undefined) {
          idx = nearestColorIndex(rgb, metric, allowed);
          cache.set(key, idx);
        }
        out[pi] = idx;
        const v = COLORS_RGB[idx];
        const qrgb = idx === 0 ? { r: 0, g: 0, b: 0 } : unpackRGB(v);
        const errR = rgb.r - qrgb.r, errG = rgb.g - qrgb.g, errB = rgb.b - qrgb.b;
        if (col + 1 < width) {
          const ne = (col + 1) * 3;
          errCurrent[ne] += 7 / 16 * errR;
          errCurrent[ne + 1] += 7 / 16 * errG;
          errCurrent[ne + 2] += 7 / 16 * errB;
        }
        if (row + 1 < height) {
          if (col > 0) {
            const bl = (col - 1) * 3;
            errNext[bl] += 3 / 16 * errR;
            errNext[bl + 1] += 3 / 16 * errG;
            errNext[bl + 2] += 3 / 16 * errB;
          }
          const bm = col * 3;
          errNext[bm] += 5 / 16 * errR;
          errNext[bm + 1] += 5 / 16 * errG;
          errNext[bm + 2] += 5 / 16 * errB;
          if (col + 1 < width) {
            const br = (col + 1) * 3;
            errNext[br] += 1 / 16 * errR;
            errNext[br + 1] += 1 / 16 * errG;
            errNext[br + 2] += 1 / 16 * errB;
          }
        }
      }
    }
    return out;
  }
  async function process(job) {
    try {
      const source = sources.get(job.sourceName);
      if (!source)
        throw new Error(\`No registered source for \${job.sourceName}\`);
      const tilesReady = ensureTiles(job.globalX, job.globalY, job.targetWidth, job.targetHeight);
      const resized = resizeNearestNeighbor(source.pixels, source.width, source.height, job.targetWidth, job.targetHeight);
      const cache = new Map;
      const allowedColorsIds = Array(32);
      for (let index = 0;index < 32; index++)
        allowedColorsIds[index] = index;
      for (let index = 32;index < 64; index++)
        if (isColorAvailable(job.extraColorsBitmap, index))
          allowedColorsIds.push(index);
      const pixels = quantize(resized, job.targetWidth, job.targetHeight, job.colorMetric, job.dithering, allowedColorsIds, cache);
      await tilesReady;
      const { targetWidth: width, targetHeight: height } = job;
      const colorsCount = new Uint32Array(64);
      const colorsLeft = new Uint32Array(64);
      const colorsOrder = job.drawColorsInOrder && job.colors ? new Map(job.colors.map((c, i) => [c, i])) : undefined;
      const positions = strategyPositions(job.strategy, width, height);
      const maxMismatches = positions.length / 2;
      const xScratch = new Uint32Array(maxMismatches);
      const yScratch = new Uint32Array(maxMismatches);
      const colorScratch = colorsOrder ? new Uint8Array(maxMismatches) : undefined;
      let mismatchCount = 0;
      for (let p = 0;p < positions.length; p += 2) {
        const dx = positions[p], dy = positions[p + 1];
        const color = pixels[dy * width + dx];
        colorsCount[color]++;
        const gx = job.globalX + dx, gy = job.globalY + dy;
        const mapColor = readTilePixel(gx, gy);
        if (color !== mapColor) {
          colorsLeft[color]++;
          xScratch[mismatchCount] = gx;
          yScratch[mismatchCount] = gy;
          if (colorScratch)
            colorScratch[mismatchCount] = color;
          mismatchCount++;
        }
      }
      let x = xScratch.slice(0, mismatchCount);
      let y = yScratch.slice(0, mismatchCount);
      if (colorsOrder && colorScratch) {
        const order = Array.from({ length: mismatchCount }, (_, i) => i);
        order.sort((a, b) => (colorsOrder.get(colorScratch[a]) ?? Infinity) - (colorsOrder.get(colorScratch[b]) ?? Infinity));
        const sx = new Uint32Array(mismatchCount), sy = new Uint32Array(mismatchCount);
        for (let i = 0;i < mismatchCount; i++) {
          sx[i] = x[order[i]];
          sy[i] = y[order[i]];
        }
        x = sx;
        y = sy;
      }
      send({ type: "processImageResult", id: job.id, pixels, colorsCount, colorsLeft, x, y }, [
        pixels.buffer,
        colorsCount.buffer,
        colorsLeft.buffer,
        x.buffer,
        y.buffer
      ]);
    } catch (err) {
      send({
        type: "error",
        id: job.id,
        message: err instanceof Error ? err.message : "decode failed"
      });
    } finally {
      sources.delete(job.id);
    }
  }
})();
`], { type: "application/javascript" })), {
      type: "module"
    });
    this.worker.onmessage = (e) => {
      const msg = e.data;
      switch (msg.type) {
        case "processImageResult":
        case "success":
          this.successHandlers.get(msg.id)?.(msg);
          break;
        case "error":
          this.errorHandlers.get(msg.id)?.(msg.message);
          this.successHandlers.delete(msg.id);
          break;
      }
      this.successHandlers.delete(msg.id);
      this.errorHandlers.delete(msg.id);
    };
    this.worker.onerror = (error) => console.log("BOT WORKER ERROR", error);
    this.worker.onmessageerror = (error) => console.log("BOT WORKER MESSAGE ERROR", error);
  }
  post(msg, transfer = []) {
    return new Promise((resolve, reject) => {
      this.successHandlers.set(msg.id, resolve);
      this.errorHandlers.set(msg.id, reject);
      this.worker.postMessage(msg, transfer);
    });
  }
  register(name, blob) {
    return this.post({ type: "register", id: crypto.randomUUID(), blob, name });
  }
  clearMapCache() {
    return this.post({ type: "clear-map-cache", id: crypto.randomUUID() });
  }
  process(job) {
    return this.post({ type: "process", id: crypto.randomUUID(), ...job });
  }
}

// src/bot.ts
class WPlaceBot {
  constructor() {
    this.widget.run("Initializing", async () => {
      this.registerFetchInterceptor();
      const style = document.createElement("style");
      style.textContent = style_default;
      document.head.append(style);
      await this.save.load(true);
      new MutationObserver((mutations) => {
        for (let index = 0;index < mutations.length; index++)
          if (mutations[index].removedNodes.length !== 0) {
            this.updateStars();
            break;
          }
        for (let index = 0;index < this.images.length; index++)
          this.images[index].updateUI();
      }).observe(document.querySelector(".maplibregl-canvas-container"), {
        attributes: true,
        childList: true,
        subtree: true
      });
      await wait(500);
      this.widget.setDisabled("draw", false);
      this.widget.setDisabled("auto-draw", false);
      this.widget.setDisabled("add-image", false);
    }).catch(async (error) => {
      if (window.confirm(`WPlace-bot couldn't load!
Do you want to DELETE ALL DATA to fix it?

ERROR: ` + error)) {
        try {
          await this.save.deleteAllData();
        } finally {
          document.location.reload();
        }
      }
    });
  }
  title = "";
  me;
  $stars = [];
  strategy = "SEQUENTIAL" /* SEQUENTIAL */;
  images = [];
  autoDrawInterval;
  widget = new Widget(this);
  save = new SaveSystem(this);
  worker = new ImageProcessingWorker;
  lastColor;
  isColorAvailable(color) {
    return isColorAvailable(this.me.extraColorsBitmap, color);
  }
  refetchMe() {
    return fetch("https://backend.wplace.live/me", {
      credentials: "include"
    }).then((x) => x.json()).then((x) => {
      return this.me = x;
    });
  }
  draw() {
    this.widget.setDisabled("draw", true);
    this.widget.status = "";
    const $canvas = document.querySelector(".maplibregl-canvas");
    const prevent = (event) => {
      if (!event.shiftKey)
        event.stopPropagation();
    };
    return this.widget.run("Drawing", async () => {
      const firstImage = this.images[0];
      if (!firstImage)
        return;
      globalThis.addEventListener("mousemove", prevent, true);
      $canvas.addEventListener("wheel", prevent, true);
      await Promise.all([
        Promise.all([this.refetchMe(), this.worker.clearMapCache()]).then(async () => {
          for (let index = 0;index < this.images.length; index++)
            await this.images[index].updatePixels();
        }),
        this.zoomIn(4, $canvas)
      ]);
      const initialCharges = Math.floor(this.me.charges.count);
      let charges = initialCharges;
      let tasksLength = 0;
      const colorsToBuyMap = new Map;
      for (let index = 0;index < this.images.length; index++) {
        const image = this.images[index];
        if (image.disabled)
          continue;
        tasksLength += image.tasksX.length;
        if (image.autoBuyColors) {
          for (let index = 0;index < image.colors.length; index++) {
            const color = image.colors[index];
            if (image.disabledColors.has(color) || !this.isColorAvailable(color))
              continue;
            const amount = image.colorsCount[color];
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
        if (index === image.tasksX.length)
          return false;
        indexes.set(image, index + 1);
        const worldPosition = new WorldPosition(this, image.tasksX[index], image.tasksY[index]);
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
              const percent = 1 - image.tasksX.length / (image.width * image.height);
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
            for (let i = 0;i < image.tasksX.length && charges > 0; i++)
              await drawTask(image);
          }
        }
      }
      for (const [image, value] of indexes) {
        image.tasksX = image.tasksX.subarray(value);
        image.tasksY = image.tasksY.subarray(value);
      }
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
  async toJSON(exportToBlob) {
    return {
      version: SAVE_VERSION,
      images: await Promise.all(this.images.map((x) => x.toJSON(exportToBlob))),
      strategy: this.strategy,
      title: this.title
    };
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
    globalThis.fetch = async (request, options) => {
      const response = await originalFetch(request, options);
      const cloned = response.clone();
      if (response.url === "https://backend.wplace.live/me") {
        this.me = await cloned.json();
        this.me.favoriteLocations.unshift(...FAVORITE_LOCATIONS);
        this.me.maxFavoriteLocations = Infinity;
        response.json = () => Promise.resolve(this.me);
      }
      return response;
    };
  }
}
globalThis.wbot = new WPlaceBot;
{
  WPlaceBot
};
