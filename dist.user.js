// ==UserScript==
// @name         wplace-bot
// @namespace    https://github.com/SoundOfTheSky
// @version      5.0.0
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
class SimpleEventSource {
  handlers = new Map;
  send(name, data) {
    return this.handlers.get(name)?.map((handler) => handler(data)) ?? [];
  }
  on(name, handler) {
    let handlers = this.handlers.get(name);
    if (!handlers) {
      handlers = [];
      this.handlers.set(name, handlers);
    }
    handlers.push(handler);
    return () => {
      removeFromArray(handlers, handler);
      if (handlers.length === 0)
        this.handlers.delete(name);
    };
  }
  off(name, handler) {
    const handlers = this.handlers.get(name);
    if (!handlers)
      return;
    removeFromArray(handlers, handler);
    if (handlers.length === 0)
      this.handlers.delete(name);
  }
  get source() {
    return {
      on: this.on.bind(this),
      off: this.off.bind(this)
    };
  }
}
function promisifyEventSource(target, resolveEvents, rejectEvents = ["error"], subName = "addEventListener") {
  return new Promise((resolve, reject) => {
    for (let index = 0;index < resolveEvents.length; index++)
      target[subName]?.(resolveEvents[index], resolve);
    for (let index = 0;index < rejectEvents.length; index++)
      target[subName]?.(rejectEvents[index], reject);
  });
}
// node_modules/@softsky/utils/dist/signals.js
var effectsMap = new WeakMap;
// node_modules/@softsky/utils/dist/time.js
class SpeedCalculator {
  size;
  historyTime;
  sum = 0;
  history = [];
  statsCached;
  startTime = Date.now();
  constructor(size, historyTime = 15000) {
    this.size = size;
    this.historyTime = historyTime;
  }
  push(chunk) {
    if (chunk < 0)
      throw new Error("Negative chunk size");
    const { time, historyTime } = this.getTime();
    this.history.push({ time, chunk });
    if (this.history[0] && this.history[0].time + historyTime < time)
      this.history.shift();
    this.sum += chunk;
    delete this.statsCached;
  }
  get stats() {
    if (!this.statsCached) {
      const speed = this.history.reduce((sum, entry) => sum + entry.chunk, 0) / this.getTime().historyTime * 1000;
      this.statsCached = this.size === undefined ? { speed } : {
        speed,
        percent: this.sum / this.size,
        eta: ~~((this.size - this.sum) / speed) * 1000
      };
    }
    return this.statsCached;
  }
  getTime() {
    const time = Date.now();
    const timeSinceStart = time - this.startTime;
    const historyTime = Math.min(timeSinceStart, this.historyTime);
    return { time, historyTime };
  }
}
// src/obfuscator.ts
var SID = Array.from({ length: 16 }, () => (10 + Math.random() * 26 | 0).toString(36)).join("");
function obfucsateHTML(html) {
  return html.replace(/class="([^"]*)"/g, (_, classes) => {
    const prefixed = classes.split(/\s+/).filter(Boolean).map((c) => `${SID}${c}`).join(" ");
    return `class="${prefixed}"`;
  });
}
function obfuscateLocalCSS(css) {
  return css.replaceAll(/\.([a-z])/g, `.${SID}$1`);
}
function obfuscateCSS(css) {
  const [global, local] = css.split("/** LOCAL STYLES */");
  return global + `
` + obfuscateLocalCSS(local);
}
function toggleClass(el, className) {
  return el.classList.toggle(SID + className);
}
function addClass(el, className) {
  el.classList.add(SID + className);
}
function removeClass(el, className) {
  el.classList.remove(SID + className);
}
function containsClass(el, className) {
  return el.classList.contains(SID + className);
}
function querySelector(el, selector) {
  return el.querySelector(obfuscateLocalCSS(selector));
}
function querySelectorAll(el, selector) {
  return el.querySelectorAll(obfuscateLocalCSS(selector));
}

// src/base.ts
class Base2 {
  runOnDestroy = [];
  destroy() {
    for (let index = 0;index < this.runOnDestroy.length; index++)
      this.runOnDestroy[index]();
  }
  populateElementsWithSelector(element, selectors) {
    for (const key in selectors) {
      this[key] = querySelector(element, selectors[key]);
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
  "NaN",
  "0,0,0",
  "60,60,60",
  "120,120,120",
  "210,210,210",
  "255,255,255",
  "96,0,24",
  "237,28,36",
  "255,127,39",
  "246,170,9",
  "249,221,59",
  "255,250,188",
  "14,185,104",
  "19,230,123",
  "135,255,94",
  "12,129,110",
  "16,174,166",
  "19,225,190",
  "40,80,158",
  "64,147,228",
  "96,247,242",
  "107,80,246",
  "153,177,251",
  "120,12,153",
  "170,56,185",
  "224,159,249",
  "203,0,122",
  "236,31,128",
  "243,141,169",
  "104,70,52",
  "149,104,42",
  "248,178,119",
  "170,170,170",
  "165,14,30",
  "250,128,114",
  "228,92,26",
  "214,181,148",
  "156,132,49",
  "197,173,49",
  "232,212,95",
  "74,107,58",
  "90,148,74",
  "132,197,115",
  "15,121,159",
  "187,250,242",
  "125,199,255",
  "77,49,184",
  "74,66,132",
  "122,113,196",
  "181,174,241",
  "219,164,99",
  "209,128,81",
  "255,197,165",
  "155,82,73",
  "209,128,120",
  "250,182,164",
  "123,99,82",
  "156,132,107",
  "51,57,65",
  "109,117,141",
  "179,185,209",
  "109,100,63",
  "148,140,107",
  "205,197,158"
];
function colorToCSS(colorId) {
  if (colorId === 0)
    return "transparent";
  const color = COLORS[colorId];
  return `oklab(${color[0] * 100}% ${color[1]} ${color[2]})`;
}

// src/image.html
var image_default = `<div class="topbar">
  <input type="text" class="name">
  <button class="open-settings" title="Open settings">✏️</button>
  <button class="export" title="Export image">📤</button>
  <button class="lock" title="Lock/unlock image movement">🔓</button>
  <button class="delete" title="Remove image from bot">❌</button>
</div>
<div class="wrapper">
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
    <label>Opacity:&nbsp;<input class="opacity" type="range" min="0" max="100"/></label>
    <label>Brightness:&nbsp;<input class="brightness" type="number" step="0.1"/></label>
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
    <label>
      <input type="checkbox" class="draw-transparent" />&nbsp;Erase transparent pixels
    </label>
    <label>
      <input type="checkbox" class="draw-colors-in-order" />&nbsp;Draw colors in order
    </label>
    <div class="colors"></div>
  </dialog>
`;

// src/pixels.ts
class Pixels {
  bot;
  image;
  width;
  brightness;
  exactColor;
  static async fromJSON(bot, data) {
    const image = new Image;
    image.src = data.url.startsWith("http") ? await fetch(data.url, { cache: "no-store" }).then((x) => x.blob()).then((X) => URL.createObjectURL(X)) : data.url;
    await promisifyEventSource(image, ["load"], ["error"]);
    return new Pixels(bot, image, data.width, data.brightness, data.exactColor);
  }
  canvas = document.createElement("canvas");
  context = this.canvas.getContext("2d");
  pixelsSubstitute;
  pixels;
  colors = new Map;
  resolution;
  get height() {
    return this.width / this.resolution | 0;
  }
  set height(value) {
    this.width = value * this.resolution | 0;
  }
  constructor(bot, image, width = image.naturalWidth, brightness = 0, exactColor = false) {
    this.bot = bot;
    this.image = image;
    this.width = width;
    this.brightness = brightness;
    this.exactColor = exactColor;
    if (exactColor) {
      this.resolution = 1;
      this.width = 1000;
    } else
      this.resolution = this.image.naturalWidth / this.image.naturalHeight;
    this.update();
  }
  update() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.colors.clear();
    const colorCache = new Map;
    for (let index = 1;index < 64; index++)
      if (this.exactColor || !this.bot.unavailableColors.has(index))
        colorCache.set(COLORS_RGB[index], [index, index]);
    this.context.imageSmoothingEnabled = false;
    this.context.imageSmoothingQuality = "low";
    this.context.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    this.pixels = Array.from({ length: this.canvas.height }, () => new Array(this.canvas.width));
    this.pixelsSubstitute = this.exactColor ? this.pixels : Array.from({ length: this.canvas.height }, () => new Array(this.canvas.width));
    const data = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    for (let y = 0;y < this.canvas.height; y++) {
      for (let x = 0;x < this.canvas.width; x++) {
        const index = (y * this.canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        const key = `${r},${g},${b}`;
        if (this.exactColor) {
          this.pixels[y][x] = a < 100 ? 0 : COLORS_RGB.indexOf(key);
          continue;
        }
        let min;
        let minReal;
        if (a < 100)
          min = minReal = 0;
        else if (colorCache.has(key))
          [min, minReal] = colorCache.get(key);
        else {
          let minDelta = Infinity;
          let minDeltaReal = Infinity;
          for (let colorIndex = 0;colorIndex < COLORS.length; colorIndex++) {
            const color = COLORS[colorIndex];
            const delta = deltaE2000(rgbToOklab(r, g, b), color, this.brightness);
            if (!this.bot.unavailableColors.has(colorIndex) && delta < minDelta) {
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
        if (min !== 0) {
          this.context.fillStyle = `oklab(${COLORS[min][0] * 100}% ${COLORS[min][1]} ${COLORS[min][2]})`;
          this.context.fillRect(x, y, 1, 1);
        }
        this.pixelsSubstitute[y][x] = min;
        this.pixels[y][x] = minReal;
        const stat = this.colors.get(minReal);
        if (stat)
          stat.amount++;
        else {
          this.colors.set(minReal, {
            color: min,
            amount: 1,
            realColor: minReal
          });
        }
      }
    }
  }
  toJSON() {
    const canvas = document.createElement("canvas");
    canvas.width = this.image.naturalWidth;
    canvas.height = this.image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(this.image, 0, 0);
    return {
      url: canvas.toDataURL("image/webp", 1),
      width: this.width,
      brightness: this.brightness,
      exactColor: this.exactColor
    };
  }
}

// src/save.ts
function loadSave() {
  let key = "";
  for (let index = 0;index < localStorage.length; index++) {
    key = localStorage.key(index);
    if (key.endsWith("wbot"))
      break;
  }
  if (!key.endsWith("wbot"))
    key = SID + "wbot";
  const json = localStorage.getItem(key);
  let save;
  try {
    save = JSON.parse(json);
    if (typeof save !== "object")
      throw new Error("NOT VALID SAVE");
    if (save.version === 1) {
      const _save = save;
      save.images = _save.widget.images;
      save.strategy = _save.widget.strategy;
      delete _save.widget;
    }
    localStorage.removeItem(key);
    localStorage.setItem(SID + "wbot", JSON.stringify(save));
  } catch {
    save = undefined;
  }
  return save;
}
var saveTimeout;
function save(bot, immediate = false) {
  clearTimeout(saveTimeout);
  if (immediate)
    localStorage.setItem(SID + "wbot", JSON.stringify(bot));
  else
    saveTimeout = setTimeout(() => {
      localStorage.setItem(SID + "wbot", JSON.stringify(bot));
    }, 1000);
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
  const [x, y] = $star.style.transform.slice(32, -31).split(", ").map((x2) => Number.parseFloat(x2));
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
  getMapColor() {
    return this.bot.mapsCache.get(this.tileX + "/" + this.tileY).pixels[this.y][this.x];
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
  pixels;
  strategy;
  opacity;
  drawTransparentPixels;
  drawColorsInOrder;
  colors;
  lock;
  name;
  unownedColorStrategy;
  static async fromJSON(bot, data) {
    return new BotImage(bot, WorldPosition.fromJSON(bot, data.position), await Pixels.fromJSON(bot, data.pixels), data.strategy, data.opacity, data.drawTransparentPixels, data.drawColorsInOrder, data.colors, data.lock, data.name, data.unownedColorStrategy);
  }
  element = document.createElement("div");
  tasks = [];
  moveInfo;
  $brightness;
  $canvas;
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
  constructor(bot, position, pixels, strategy = "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */, opacity = 50, drawTransparentPixels = false, drawColorsInOrder = false, colors = [], lock = false, name = `${pixels.width}x${pixels.height}`, unownedColorStrategy = "BUY" /* BUY */) {
    super();
    this.bot = bot;
    this.position = position;
    this.pixels = pixels;
    this.strategy = strategy;
    this.opacity = opacity;
    this.drawTransparentPixels = drawTransparentPixels;
    this.drawColorsInOrder = drawColorsInOrder;
    this.colors = colors;
    this.lock = lock;
    this.name = name;
    this.unownedColorStrategy = unownedColorStrategy;
    this.element.innerHTML = obfucsateHTML(image_default);
    addClass(this.element, "image");
    document.body.append(this.element);
    this.populateElementsWithSelector(this.element, {
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
      $dialog: "dialog"
    });
    this.$unownedColorStrategy = this.$unownedColorStrategyLabel.querySelector("select");
    this.$resetSizeSpan = this.$resetSize.querySelector("span");
    this.$canvas = this.pixels.canvas;
    this.$wrapper.prepend(this.pixels.canvas);
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
      this.update();
      save(this.bot);
    });
    this.$opacity.style.setProperty("--val", this.opacity + "%");
    let timeout;
    this.$brightness.addEventListener("change", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.pixels.brightness = this.$brightness.valueAsNumber;
        this.pixels.update();
        this.updateColors();
        this.update();
        save(this.bot);
      }, 1000);
    });
    this.$resetSize.addEventListener("click", () => {
      this.pixels.width = this.pixels.image.naturalWidth;
      this.pixels.update();
      this.updateColors();
      this.update();
      save(this.bot);
    });
    this.$drawTransparent.addEventListener("click", () => {
      this.drawTransparentPixels = this.$drawTransparent.checked;
      save(this.bot);
    });
    this.$drawColorsInOrder.addEventListener("click", () => {
      this.drawColorsInOrder = this.$drawColorsInOrder.checked;
      this.updateColors();
      save(this.bot);
    });
    this.$lock.addEventListener("click", () => {
      this.lock = !this.lock;
      this.update();
      save(this.bot);
    });
    this.$delete.addEventListener("click", this.destroy.bind(this));
    this.$export.addEventListener("click", this.export.bind(this));
    this.$name.addEventListener("change", () => {
      this.name = this.$name.value;
      this.update();
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
    for (const $resize of querySelectorAll(this.element, ".resize"))
      $resize.addEventListener("mousedown", this.resizeStart.bind(this));
    this.update();
    this.updateColors();
  }
  toJSON() {
    return {
      pixels: this.pixels.toJSON(),
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels,
      drawColorsInOrder: this.drawColorsInOrder,
      colors: this.colors,
      lock: this.lock,
      name: this.name,
      unownedColorStrategy: this.unownedColorStrategy
    };
  }
  updateTasks() {
    this.tasks.length = 0;
    const position = this.position.clone();
    const skipColors = new Set;
    const colorsOrderMap = new Map;
    for (let index = 0;index < this.colors.length; index++) {
      const drawColor = this.colors[index];
      if (drawColor.disabled || this.bot.unavailableColors.has(drawColor.realColor))
        skipColors.add(drawColor.realColor);
      colorsOrderMap.set(drawColor.realColor, index);
    }
    const isSubstitute = this.unownedColorStrategy === "SUBSTITUTE" /* SUBSTITUTE */;
    for (const { x, y } of this.strategyPositionIterator()) {
      const color = isSubstitute ? this.pixels.pixelsSubstitute[y][x] : this.pixels.pixels[y][x];
      if (skipColors.has(color))
        continue;
      position.globalX = this.position.globalX + x;
      position.globalY = this.position.globalY + y;
      const mapColor = position.getMapColor();
      if (color !== mapColor && (this.drawTransparentPixels || color !== 0))
        this.tasks.push({
          position: position.clone(),
          color
        });
    }
    if (this.drawColorsInOrder)
      this.tasks.sort((a, b) => (colorsOrderMap.get(a.color) ?? 0) - (colorsOrderMap.get(b.color) ?? 0));
    this.update();
    this.bot.widget.update();
  }
  update() {
    const { x, y } = this.position.toScreenPosition();
    this.element.style.transform = `translate(${x}px, ${y}px)`;
    this.element.style.width = `${this.position.pixelSize * this.pixels.width}px`;
    this.$canvas.style.opacity = `${this.opacity}%`;
    removeClass(this.element, "hidden");
    this.$resetSizeSpan.textContent = this.pixels.width.toString();
    this.$brightness.valueAsNumber = this.pixels.brightness;
    this.$strategy.value = this.strategy;
    this.$opacity.valueAsNumber = this.opacity;
    this.$drawTransparent.checked = this.drawTransparentPixels;
    this.$drawColorsInOrder.checked = this.drawColorsInOrder;
    this.$name.value = this.name;
    const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0].length;
    const doneTasks = maxTasks - this.tasks.length;
    const percent = doneTasks / maxTasks * 100 | 0;
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${this.tasks.length / 120 | 0}h`;
    this.$progressLine.style.transform = `scaleX(${percent}%)`;
    if (this.lock)
      addClass(this.$wrapper, "no-pointer-events");
    else
      removeClass(this.$wrapper, "no-pointer-events");
    this.$lock.textContent = this.lock ? "\uD83D\uDD12" : "\uD83D\uDD13";
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
    if (this.bot.unavailableColors.size === 0)
      addClass(this.$unownedColorStrategyLabel, "hidden");
    this.$colors.innerHTML = "";
    const pixelsSum = this.pixels.pixels.length * this.pixels.pixels[0].length;
    if (this.colors.length !== this.pixels.colors.size || this.colors.some((x) => !this.pixels.colors.has(x.realColor))) {
      this.colors = this.pixels.colors.values().toArray().sort((a, b) => b.amount - a.amount).map((color) => ({
        realColor: color.realColor,
        disabled: false
      }));
      save(this.bot);
    }
    this.$colors.style.height = `${LINE_HEIGHT * this.colors.length}px`;
    for (let index = 0;index < this.colors.length; index++) {
      const drawColor = this.colors[index];
      if (!this.drawTransparentPixels && drawColor.realColor === 0)
        continue;
      const css = (color2) => color2 === 0 ? `repeating-linear-gradient(32deg, #ccc 0 8px, transparent 8px 16px)` : colorToCSS(color2);
      const color = this.pixels.colors.get(drawColor.realColor);
      const $button = document.createElement("button");
      if (COLORS[drawColor.realColor][0] < 0.6)
        addClass($button, "dark");
      $button.title = "Drag to reorder. Click to disable.";
      $button.style.top = `${index * LINE_HEIGHT}px`;
      if (drawColor.disabled) {
        const $warning = document.createElement("div");
        $warning.innerText = "❌";
        $warning.title = "Disabled and will be skipped.";
        $button.appendChild($warning);
      }
      switch (this.unownedColorStrategy) {
        case "SUBSTITUTE" /* SUBSTITUTE */:
          $button.style.background = css(color.color);
          if (color.color !== color.realColor) {
            const $warning = document.createElement("button");
            $warning.style.backgroundColor = css(color.realColor);
            $warning.title = "This is the best color. Click to buy.";
            $warning.addEventListener("click", async () => {
              await this.bot.updateColors();
              document.getElementById("color-" + color.realColor)?.click();
            });
            $button.appendChild($warning);
          }
          break;
        case "BUY" /* BUY */:
          $button.style.background = css(color.realColor);
          if (this.bot.unavailableColors.has(color.realColor)) {
            const $warning = document.createElement("div");
            $warning.innerText = "⌛";
            $warning.title = "This color be automatically bought.";
            $button.appendChild($warning);
          }
          break;
        case "SKIP" /* SKIP */:
          $button.style.background = css(color.realColor);
          if (this.bot.unavailableColors.has(color.realColor)) {
            const $warning = document.createElement("div");
            $warning.innerText = "⏩";
            $warning.title = "Unowned colors will be skipped.";
            $button.appendChild($warning);
          }
          break;
      }
      const $percent = document.createElement("span");
      addClass($percent, "percent");
      $percent.innerText = `${color.amount}px ${color.amount / pixelsSum * 100 | 0}%`;
      $button.appendChild($percent);
      this.$colors.append($button);
      let dragging = false;
      const startDrag = (startEvent) => {
        addClass($button, "dragging");
        let newIndex = index;
        const mouseMoveHandler = (event) => {
          newIndex = Math.min(this.colors.length - 1, Math.max(0, Math.round(index + (event.clientY - startEvent.clientY) / LINE_HEIGHT)));
          console.log(newIndex);
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
          removeClass($button, "dragging");
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
      $button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (dragging)
          return;
        drawColor.disabled = drawColor.disabled ? undefined : true;
        toggleClass($button, "color-disabled");
        save(this.bot);
      });
    }
  }
  *strategyPositionIterator() {
    const height = this.pixels.pixels.length;
    const width = this.pixels.pixels[0].length;
    switch (this.strategy) {
      case "DOWN" /* DOWN */: {
        for (let y = 0;y < height; y++)
          for (let x = 0;x < width; x++)
            yield { x, y };
        break;
      }
      case "UP" /* UP */: {
        for (let y = height - 1;y >= 0; y--)
          for (let x = 0;x < width; x++)
            yield { x, y };
        break;
      }
      case "LEFT" /* LEFT */: {
        for (let x = 0;x < width; x++)
          for (let y = 0;y < height; y++)
            yield { x, y };
        break;
      }
      case "RIGHT" /* RIGHT */: {
        for (let x = width - 1;x >= 0; x--)
          for (let y = 0;y < height; y++)
            yield { x, y };
        break;
      }
      case "RANDOM" /* RANDOM */: {
        const positions = [];
        for (let y = 0;y < height; y++)
          for (let x = 0;x < width; x++)
            positions.push({ x, y });
        for (let index = positions.length - 1;index >= 0; index--) {
          const index_ = Math.floor(Math.random() * (index + 1));
          const temporary = positions[index];
          positions[index] = positions[index_];
          positions[index_] = temporary;
        }
        yield* positions;
        break;
      }
      case "SPIRAL_FROM_CENTER" /* SPIRAL_FROM_CENTER */:
      case "SPIRAL_TO_CENTER" /* SPIRAL_TO_CENTER */: {
        const visited = new Set;
        const total = width * height;
        let x = Math.floor(width / 2);
        let y = Math.floor(height / 2);
        const directories = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1]
        ];
        let directionIndex = 0;
        let steps = 1;
        const inBounds = (x2, y2) => x2 >= 0 && x2 < width && y2 >= 0 && y2 < height;
        const emit = function* () {
          let count = 0;
          while (count < total) {
            for (let twice = 0;twice < 2; twice++) {
              for (let index = 0;index < steps; index++) {
                if (inBounds(x, y)) {
                  const key = `${x},${y}`;
                  if (!visited.has(key)) {
                    visited.add(key);
                    yield { x, y };
                    count++;
                    if (count >= total)
                      return;
                  }
                }
                x += directories[directionIndex][0];
                y += directories[directionIndex][1];
              }
              directionIndex = (directionIndex + 1) % 4;
            }
            steps++;
          }
        };
        if (this.strategy === "SPIRAL_FROM_CENTER" /* SPIRAL_FROM_CENTER */)
          yield* emit();
        else {
          const collected = [...emit()];
          for (let index = collected.length - 1;index >= 0; index--)
            yield collected[index];
        }
        break;
      }
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
  moveStop() {
    if (this.moveInfo) {
      this.moveInfo = undefined;
      this.position.updateAnchor();
      this.pixels.update();
      this.updateColors();
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
        this.pixels.width = Math.max(1, this.moveInfo.width - deltaX);
    } else if (this.moveInfo.width !== undefined)
      this.pixels.width = Math.max(1, deltaX + this.moveInfo.width);
    if (this.moveInfo.globalY !== undefined) {
      this.position.globalY = deltaY + this.moveInfo.globalY;
      if (this.moveInfo.height !== undefined)
        this.pixels.height = Math.max(1, this.moveInfo.height - deltaY);
    } else if (this.moveInfo.height !== undefined)
      this.pixels.height = Math.max(1, deltaY + this.moveInfo.height);
    this.update();
    save(this.bot);
  }
  resizeStart(event) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    const $resize = event.target;
    if (containsClass($resize, "n")) {
      this.moveInfo.height = this.pixels.height;
      this.moveInfo.globalY = this.position.globalY;
    }
    if (containsClass($resize, "e"))
      this.moveInfo.width = this.pixels.width;
    if (containsClass($resize, "s"))
      this.moveInfo.height = this.pixels.height;
    if (containsClass($resize, "w")) {
      this.moveInfo.width = this.pixels.width;
      this.moveInfo.globalX = this.position.globalX;
    }
  }
  export() {
    const a = document.createElement("a");
    document.body.append(a);
    a.href = URL.createObjectURL(new Blob([JSON.stringify(this.toJSON())], { type: "application/json" }));
    a.download = `${this.name}.wbot`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.href = this.pixels.canvas.toDataURL("image/webp", 1);
    a.download = `${this.name}.webp`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
}

// src/style.css
var style_default = `/* stylelint-disable declaration-no-important */
/* stylelint-disable plugin/no-low-performance-animation-properties */
/* stylelint-disable no-descending-specificity */
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

.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center:nth-child(
    -n + FAKE_FAVORITE_LOCATIONS
  ) {
  display: none;
}

/** LOCAL STYLES */

/** Widget */
.widget {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 256px;
  height: 100dvh;
  border-right: var(--text) 2px solid;
  background-color: var(--background);
  color: var(--text);
  transition: transform 0.5s;
  transform: translateX(-100%);
}

.widget * {
  font-family: 'Tiny5', sans-serif;
}

.widget .title {
  display: block;
  width: 100%;
  border: none;
  border-bottom: var(--text) 2px solid;
  background-color: var(--main);
  color: var(--text);
  font-size: 32px;
  text-align: center;
}

.widget.open .open-button div {
  transform: rotate(180deg);
}

.widget.open {
  box-shadow: 8px 0 16px -8px var(--main);
  transform: translateX(0);
}

.widget .open-button div {
  transition: transform 0.5s;
}

.widget .open-button {
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

.widget .images {
  display: block;
  overflow-y: auto;
  height: auto;
  max-height: 240px;
}

.widget .images .item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 64px;
  margin-bottom: 4px;
}

.widget .images .item img {
  width: 30%;
  margin-right: 4px;
  cursor: pointer;
}

.widget .images .item .buttons {
  width: 100%;
  height: 100%;
}

.widget .images .item .buttons input {
  display: block;
  width: 100%;
  height: 30px;
  margin-bottom: 4px;
}

.widget .images .item .buttons button {
  display: inline-block;
  width: calc(50% - 2px);
  height: 30px;
  font-weight: bolder;
  font-size: 24px;
  line-height: 100%;
}

.widget .images .item .buttons button:first-child {
  margin-right: 4px;
}

/** Image */
.image {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9;
}

.image * {
  font-family: 'Tiny5', sans-serif;
}

.image canvas {
  image-rendering: pixelated;
  width: 100%;
  box-shadow: inset var(--text) 0 0 0 2px;
  cursor: all-scroll;
}

dialog.form {
  width: clamp(256px, 60vh, 512px);
  height: 60vh;
  margin: auto;
  border: var(--text) 2px solid;
  background-color: var(--background);
  color: var(--text);
}

dialog.form::backdrop {
  background: rgb(0 0 0 / 70%);
}

/* Settings */
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

/* Topbar */
.topbar {
  position: absolute;
  top: -24px;
  left: 0;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: min-content;
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

/* Resize */
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

/* Utility */
.p {
  padding: 0 8px;
}

.hidden {
  display: none;
}

.no-pointer-events {
  height: 1px;
  pointer-events: none;
}
`;

// src/errors.ts
class WPlaceBotError extends Error {
  name = "WPlaceBotError";
  constructor(message, bot) {
    super(message);
    bot.widget.status = message;
  }
}
class NoImageError extends WPlaceBotError {
  name = "NoImageError";
  constructor(bot) {
    super("❌ No image is selected", bot);
  }
}

// src/widget.html
var widget_default = `<button class="open-button"><div>></div></button>
<input class="title" type="text">
<div class="form">
  <div class="progress"><div></div><span></span></div>
  <div class="p status"></div>
  <button class="draw" disabled>Draw</button>
  <button class="auto-draw" disabled>Auto-Draw</button>
  <label>Strategy:&nbsp;<select class="strategy">
    <option value="SEQUENTIAL" selected>Sequential</option>
    <option value="ALL">All</option>
    <option value="PERCENTAGE">Percentage</option>
  </select></label>
  <div class="images"></div>
  <!-- <button class="pumpkin-hunt" disabled>Pumpkin Hunt!</button> -->
  <button class="add-image" disabled>Add image</button>
</div>
`;

// src/widget.ts
class Widget extends Base2 {
  bot;
  element = document.createElement("div");
  get status() {
    return this.$status.innerHTML;
  }
  set status(value) {
    this.$status.innerHTML = value;
  }
  get open() {
    return containsClass(this.element, "open");
  }
  set open(value) {
    if (value)
      addClass(this.element, "open");
    else
      removeClass(this.element, "open");
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
    super();
    this.bot = bot;
    addClass(this.element, "widget");
    this.element.innerHTML = obfucsateHTML(widget_default);
    document.body.append(this.element);
    this.populateElementsWithSelector(this.element, {
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
    });
    this.$autoDraw.addEventListener("click", () => this.bot.autoDraw());
    this.update();
    this.open = true;
  }
  addImage() {
    this.setDisabled("add-image", true);
    return this.run("Adding image", async () => {
      await this.bot.updateColors();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,.wbot";
      input.click();
      await promisifyEventSource(input, ["change"], ["cancel", "error"]);
      const file = input.files?.[0];
      if (!file)
        throw new NoImageError(this.bot);
      let botImage;
      if (file.name.endsWith(".wbot")) {
        botImage = await BotImage.fromJSON(this.bot, JSON.parse(await file.text()));
      } else {
        const reader = new FileReader;
        reader.readAsDataURL(file);
        await promisifyEventSource(reader, ["load"], ["error"]);
        const image = new Image;
        image.src = reader.result;
        await promisifyEventSource(image, ["load"], ["error"]);
        botImage = new BotImage(this.bot, WorldPosition.fromScreenPosition(this.bot, {
          x: 256,
          y: 32
        }), new Pixels(this.bot, image), undefined, undefined, undefined, undefined, undefined, undefined, file.name);
      }
      this.bot.images.push(botImage);
      save(this.bot, true);
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
      maxTasks += image.pixels.pixels.length * image.pixels.pixels[0].length;
      totalTasks += image.tasks.length;
    }
    const doneTasks = maxTasks - totalTasks;
    const percent = doneTasks / maxTasks * 100 | 0;
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${totalTasks / 120 | 0}h`;
    this.$progressLine.style.transform = `scaleX(${percent}%)`;
    this.$images.innerHTML = "";
    for (let index = 0;index < this.bot.images.length; index++) {
      const image = this.bot.images[index];
      const $image = document.createElement("div");
      this.$images.append($image);
      $image.className = SID + "item";
      $image.innerHTML = obfucsateHTML(`<img src="${image.pixels.image.src}">
<div class="buttons">
<input type="text" class="name">
<button class="up" title="Move up" ${index === 0 ? "disabled" : ""}>▴</button>
<button class="down" title="Move down" ${index === this.bot.images.length - 1 ? "disabled" : ""}>▾</button>
</div>`);
      $image.querySelector("img").addEventListener("click", () => {
        image.position.moveScreenTo();
      });
      const $name = querySelector($image, ".name");
      $name.value = image.name;
      $name.addEventListener("change", () => {
        image.name = $name.value;
        image.update();
        this.update();
        save(this.bot);
      });
      this.bot.fixSpaceInInput($name);
      querySelector($image, ".up").addEventListener("click", () => {
        swap(this.bot.images, index, index - 1);
        this.update();
        save(this.bot);
      });
      querySelector($image, ".down").addEventListener("click", () => {
        swap(this.bot.images, index, index + 1);
        this.update();
        save(this.bot);
      });
    }
  }
  setDisabled(name, disabled) {
    querySelector(this.element, "." + name).disabled = disabled;
  }
  async run(status, run, fin, emoji = "⌛") {
    const originalStatus = this.status;
    this.status = `${emoji} ${status}`;
    try {
      const result = await run();
      this.status = originalStatus;
      return result;
    } catch (error) {
      if (!(error instanceof WPlaceBotError)) {
        console.error(error);
        this.status = `❌ ${status}`;
      }
      throw error;
    } finally {
      await fin?.();
    }
  }
  minimize() {
    toggleClass(this.$settings, "hidden");
  }
}

// src/bot.ts
var SAVE_VERSION = 2;

class WPlaceBot {
  title = "";
  unavailableColors = new Set;
  mapsCache = new Map;
  me;
  $stars = [];
  strategy = "SEQUENTIAL" /* SEQUENTIAL */;
  images = [];
  autoDrawInterval;
  widget = new Widget(this);
  markerPixelPositionResolvers = [];
  lastColor;
  constructor() {
    const save2 = loadSave();
    if (save2) {
      for (let index = 0;index < save2.images.length; index++) {
        const image = save2.images[index];
        addFavoriteLocation({
          x: image.position[0] - 1000,
          y: image.position[1] - 1000
        });
        addFavoriteLocation({
          x: image.position[0] + 1000,
          y: image.position[1] + 1000
        });
      }
      this.strategy = save2.strategy ?? "SEQUENTIAL" /* SEQUENTIAL */;
      this.title = save2.title ?? "Wplace-bot";
    }
    this.registerFetchInterceptor();
    const style = document.createElement("style");
    style.textContent = obfuscateCSS(style_default.replace("FAKE_FAVORITE_LOCATIONS", FAVORITE_LOCATIONS.length.toString()));
    document.head.append(style);
    this.widget.run("Initializing", async () => {
      await this.waitForElement("login", ".avatar.center-absolute.absolute");
      await this.waitForElement("pixel count", ".btn.btn-primary.btn-lg.relative.z-30 canvas");
      const $canvasContainer = await this.waitForElement("canvas", ".maplibregl-canvas-container");
      new MutationObserver((mutations) => {
        for (let index = 0;index < mutations.length; index++)
          if (mutations[index].removedNodes.length !== 0) {
            this.updateStars();
            break;
          }
        this.updateImages();
      }).observe($canvasContainer, {
        attributes: true,
        childList: true,
        subtree: true
      });
      this.updateStars();
      await wait(500);
      await this.updateColors();
      if (save2)
        for (let index = 0;index < save2.images.length; index++) {
          const image = await BotImage.fromJSON(this, save2.images[index]);
          this.images.push(image);
          image.update();
        }
      await this.readMap();
      this.updateTasks();
      this.widget.setDisabled("draw", false);
      this.widget.setDisabled("auto-draw", false);
      this.widget.setDisabled("add-image", false);
    }).catch(() => {
      if (window.confirm(`WPlace-bot's save is corrupted!
Do you with to IRREVERSABLY DELETE it?

Hint for next time: Create backup's with \uD83D\uDCE4 button.`)) {
        localStorage.removeItem(SID + "wbot");
        const a = document.createElement("a");
        document.body.append(a);
        a.href = URL.createObjectURL(new Blob([JSON.stringify(localStorage.getItem(SID + "wbot"))], {
          type: "application/json"
        }));
        a.download = `Wplace-Bot-Broken-Save.txt`;
        a.click();
        window.alert(`Wplace-Bot-Broken-Save.txt is your broken save. If you ACTUALLY need data from this save, create issue on https://github.com/SoundOfTheSky/wplace-bot/issues

Developer will try to fix your save. Be vary that github issues are public, and save file contains your images and their positions in world.`);
        document.location.reload();
      }
    });
  }
  draw() {
    this.widget.setDisabled("draw", true);
    this.widget.status = "";
    this.mapsCache.clear();
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
      await this.widget.run("Initializing draw", () => Promise.all([
        this.updateColors(),
        this.readMap(),
        this.zoomIn(4, $canvas)
      ]));
      this.updateTasks();
      this.me = await fetch("https://backend.wplace.live/me", {
        credentials: "include"
      }).then((x) => x.json());
      let charges = Math.floor(this.me.charges.count);
      let tasksLength = 0;
      const colorsToBuyMap = new Map;
      for (let index = 0;index < this.images.length; index++) {
        const image = this.images[index];
        tasksLength += image.tasks.length;
        if (image.unownedColorStrategy === "BUY" /* BUY */) {
          for (let index2 = 0;index2 < image.colors.length; index2++) {
            const color = image.colors[index2];
            if (color.disabled || !this.unavailableColors.has(color.realColor))
              continue;
            const amount = image.pixels.colors.get(color.realColor).amount;
            if (!colorsToBuyMap.has(color.realColor))
              colorsToBuyMap.set(color.realColor, {
                color: color.realColor,
                amount
              });
            else
              colorsToBuyMap.get(color.realColor).amount += amount;
          }
        }
      }
      const colorsToBuy = [...colorsToBuyMap.values()].sort((a, b) => b.amount - a.amount);
      for (let index = 0;index < Math.min(colorsToBuy.length, this.me.droplets / 2000 | 0); index++) {
        document.getElementById("color-" + colorsToBuy[index].color)?.click();
        await wait(500);
        document.querySelector(".modal-box .flex.w-max.flex-col button")?.click();
        await wait(1000);
      }
      switch (this.strategy) {
        case "ALL" /* ALL */: {
          while (charges > 0) {
            let end = true;
            for (let imageIndex = 0;imageIndex < this.images.length; imageIndex++) {
              const task = this.images[imageIndex].tasks.shift();
              if (!task)
                continue;
              this.drawTask(task);
              charges--;
              await wait(1);
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
              const percent = 1 - image.tasks.length / (image.pixels.pixels.length * image.pixels.pixels[0].length);
              if (percent < minPercent) {
                minPercent = percent;
                minImage = image;
              }
            }
            this.drawTask(minImage.tasks.shift());
            charges--;
            await wait(1);
          }
          break;
        }
        case "SEQUENTIAL" /* SEQUENTIAL */: {
          for (let imageIndex = 0;imageIndex < this.images.length; imageIndex++) {
            const image = this.images[imageIndex];
            for (let task = image.tasks.shift();task && charges > 0; task = image.tasks.shift()) {
              this.drawTask(task);
              charges--;
              await wait(1);
            }
          }
        }
      }
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
        this.widget.$autoDraw.innerText = `Auto-Draw in (${deltaTime / 60000 | 0}:${(deltaTime % 60000 / 1000 | 0).toString().padStart(2, "0")})!`;
      else {
        drawTime = Date.now() + (this.me?.charges.max ?? 100) * 30000;
        try {
          await this.draw();
          document.querySelector(".absolute.bottom-0  .btn.btn-lg.relative.btn-primary")?.click();
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
  toJSON() {
    return {
      version: SAVE_VERSION,
      images: this.images.map((x) => x.toJSON()),
      strategy: this.strategy,
      title: this.title
    };
  }
  async updateColors() {
    await this.openColors();
    this.unavailableColors.clear();
    for (const $button of document.querySelectorAll("button.btn.relative.w-full"))
      if ($button.children.length !== 0)
        this.unavailableColors.add(Math.abs(Number.parseInt($button.id.slice(6))));
    this.updateImageColors();
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
  readMap() {
    this.mapsCache.clear();
    const imagesToDownload = new Set;
    for (let index = 0;index < this.images.length; index++) {
      const image = this.images[index];
      const { tileX: tileXEnd, tileY: tileYEnd } = new WorldPosition(this, image.position.globalX + image.pixels.pixelsSubstitute[0].length, image.position.globalY + image.pixels.pixelsSubstitute.length);
      for (let tileX = image.position.tileX;tileX <= tileXEnd; tileX++)
        for (let tileY = image.position.tileY;tileY <= tileYEnd; tileY++)
          imagesToDownload.add(`${tileX}/${tileY}`);
    }
    let done = 0;
    return this.widget.run(`Reading map [0/${imagesToDownload.size}]`, () => Promise.all([...imagesToDownload].map(async (x) => {
      this.mapsCache.set(x, await Pixels.fromJSON(this, {
        url: `https://backend.wplace.live/files/s0/tiles/${x}.png`,
        exactColor: true
      }));
      this.widget.status = `⌛ Reading map [${++done}/${imagesToDownload.size}]`;
    })));
  }
  waitForUnfocus() {
    return this.widget.run("UNFOCUS WINDOW", () => new Promise((resolve) => {
      if (!document.hasFocus())
        resolve();
      window.addEventListener("blur", () => {
        setTimeout(resolve, 1);
      }, {
        once: true
      });
    }), undefined, "\uD83D\uDDB1️");
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
  }
  drawTask(task) {
    if (this.lastColor !== task.color) {
      document.getElementById("color-" + task.color).click();
      this.lastColor = task.color;
    }
    const halfPixel = task.position.pixelSize / 2;
    const position = task.position.toScreenPosition();
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
  async closeAll() {
    for (const button of document.querySelectorAll("button")) {
      if (button.innerHTML === "✕" || button.innerHTML === `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"></path></svg><!---->`) {
        button.click();
        await wait(1);
      }
    }
  }
  waitForElement(name, selector) {
    return this.widget.run(`Waiting for ${name}`, () => {
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
    });
  }
  updateStars() {
    this.$stars = [
      ...document.querySelectorAll(".text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center")
    ].slice(0, FAVORITE_LOCATIONS.length);
  }
  updateImages() {
    for (let index = 0;index < this.images.length; index++)
      this.images[index].update();
  }
  updateTasks() {
    for (let index = 0;index < this.images.length; index++)
      this.images[index].updateTasks();
  }
  updateImageColors() {
    for (let index = 0;index < this.images.length; index++)
      this.images[index].updateColors();
  }
  async zoomIn(zoom, canvas = document.querySelector(".maplibregl-canvas")) {
    const position = new WorldPosition(this, WORLD_PIXEL_SIZE / 2, WORLD_PIXEL_SIZE / 2);
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
}
globalThis.wbot = new WPlaceBot;
{
  WPlaceBot
};
