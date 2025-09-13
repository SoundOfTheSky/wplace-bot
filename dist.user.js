// ==UserScript==
// @name         wplace-bot
// @namespace    https://github.com/SoundOfTheSky
// @version      4.1.3
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

// node_modules/@softsky/utils/dist/errors.js
class TimeoutError extends Error {
  name = "TimeoutError";
  constructor() {
    super("The operation has timed out");
  }
}

// node_modules/@softsky/utils/dist/control.js
var lastIncId = Math.floor(Math.random() * 65536);
var SESSION_ID = Math.floor(Math.random() * 4503599627370496).toString(16).padStart(13, "0");
function wait(time) {
  return new Promise((r) => setTimeout(r, time));
}
function timeout(time) {
  return new Promise((_, reject) => setTimeout(() => {
    reject(new TimeoutError);
  }, time));
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
async function withTimeout(run, ms) {
  return Promise.race([run(), timeout(ms)]);
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
// src/errors.ts
class WPlaceBotError extends Error {
  name = "WPlaceBotError";
  constructor(message, bot) {
    super(message);
    bot.widget.status = message;
  }
}

class NotInitializedError extends WPlaceBotError {
  name = "NotInitializedError";
  constructor(bot) {
    super("❌ Not initialized", bot);
  }
}

class StarsAreTooCloseError extends WPlaceBotError {
  name = "StarsAreTooCloseError";
  constructor(bot) {
    super("❌ Stars are too close", bot);
  }
}

class ZoomTooFarError extends WPlaceBotError {
  name = "ZoomTooFarError";
  constructor(bot) {
    super("❌ Zoom is too far", bot);
  }
}

class NoImageError extends WPlaceBotError {
  name = "NoImageError";
  constructor(bot) {
    super("❌ No image is selected", bot);
  }
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
      this[key] = element.querySelector(selectors[key]);
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

// src/image.html
var image_default = `<div class="wtopbar">
  <button class="export">📤</button>
  <button class="lock">🔓</button>
</div>
<div class="wrapper">
  <div class="wsettings">
    <div class="progress">
      <div></div>
      <span></span>
    </div>
    <div class="colors"></div>
    <label>Opacity:&nbsp;<input class="opacity" type="range" min="0" max="100"/></label>
    <label>Brightness:&nbsp;<input class="brightness" type="number" step="0.1"/></label>
    <label>
      Strategy:&nbsp;<select class="strategy">
        <option value="RANDOM" selected>Random</option>
        <option value="DOWN">Down</option>
        <option value="UP">Up</option>
        <option value="LEFT">Left</option>
        <option value="RIGHT">Right</option>
        <option value="SPIRAL_FROM_CENTER">Spiral out</option>
        <option value="SPIRAL_TO_CENTER">Spiral in</option>
      </select>
    </label>
    <button class="reset-size">Reset size [<span></span>px]</button>
    <label>
      <input type="checkbox" class="draw-transparent" />&nbsp;Erase transparent pixels
    </label>
  </div>
  <div class="resize n"></div>
  <div class="resize e"></div>
  <div class="resize s"></div>
  <div class="resize w"></div>
</div>
`;

// src/pixels.ts
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
  pixels;
  colorsToBuy = [];
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
    this.resolution = this.image.naturalWidth / this.image.naturalHeight;
    this.update();
  }
  update() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const colorsToBuy = new Map;
    const colorCache = new Map;
    for (let index = 0;index < this.bot.colors.length; index++) {
      const color = this.bot.colors[index];
      colorCache.set(`${color.color[0].toFixed(4)},${color.color[1].toFixed(4)},${color.color[2].toFixed(4)}`, [color, color]);
    }
    this.context.imageSmoothingEnabled = false;
    this.context.imageSmoothingQuality = "low";
    this.context.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    this.pixels = Array.from({ length: this.canvas.height }, () => new Array(this.canvas.width));
    const data = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    for (let y = 0;y < this.canvas.height; y++) {
      for (let x = 0;x < this.canvas.width; x++) {
        const index = (y * this.canvas.width + x) * 4;
        if (data[index + 3] < 100) {
          this.pixels[y][x] = "color-0";
          continue;
        }
        const originalColor = rgbToOklab(...data.slice(index, index + 3));
        const key = `${originalColor[0].toFixed(4)},${originalColor[1].toFixed(4)},${originalColor[2].toFixed(4)}`;
        let min;
        let minReal;
        if (colorCache.has(key))
          [min, minReal] = colorCache.get(key);
        else {
          let minDelta = Infinity;
          let minDeltaReal = Infinity;
          for (let colorIndex = 0;colorIndex < this.bot.colors.length; colorIndex++) {
            const color = this.bot.colors[colorIndex];
            const delta = deltaE2000(originalColor, color.color, this.brightness);
            if (color.available && delta < minDelta) {
              minDelta = delta;
              min = color;
            }
            if (delta < minDeltaReal) {
              minDeltaReal = delta;
              minReal = color;
            }
          }
          colorCache.set(key, [min, minReal]);
        }
        this.context.fillStyle = `oklab(${min.color[0] * 100}% ${min.color[1]} ${min.color[2]})`;
        this.context.fillRect(x, y, 1, 1);
        this.pixels[y][x] = min.buttonId;
        if (minReal.buttonId !== min.buttonId)
          colorsToBuy.set(minReal, (colorsToBuy.get(minReal) ?? 0) + 1);
      }
    }
    this.colorsToBuy.splice(0, Infinity, ...[...colorsToBuy.entries()].sort(([, a], [, b]) => b - a));
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

// src/world-position.ts
var WORLD_TILE_SIZE = 1000;

class WorldPosition {
  bot;
  static fromJSON(bot, data) {
    return new WorldPosition(bot, ...data);
  }
  static fromScreenPosition(bot, position) {
    const p = bot.anchorsWorldPosition[0];
    const s = bot.anchorsScreenPosition[0];
    if (!p || !s)
      throw new NotInitializedError(bot);
    return new WorldPosition(bot, p.globalX + (position.x - s.x) / bot.pixelSize | 0, p.globalY + (position.y - s.y) / bot.pixelSize | 0);
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
  constructor(bot, tileorGlobalX, tileorGlobalY, x, y) {
    this.bot = bot;
    if (x === undefined || y === undefined) {
      this.globalX = tileorGlobalX;
      this.globalY = tileorGlobalY;
    } else {
      this.globalX = tileorGlobalX * WORLD_TILE_SIZE + x;
      this.globalY = tileorGlobalY * WORLD_TILE_SIZE + y;
    }
  }
  toScreenPosition() {
    const p = this.bot.anchorsWorldPosition[0];
    const s = this.bot.anchorsScreenPosition[0];
    if (!p || !s)
      throw new NotInitializedError(this.bot);
    return {
      x: (this.globalX - p.globalX) * this.bot.pixelSize + s.x,
      y: (this.globalY - p.globalY) * this.bot.pixelSize + s.y
    };
  }
  async getMapColor() {
    const key = this.tileX + "/" + this.tileY;
    let map = this.bot.mapsCache.get(key);
    if (!map) {
      map = await Pixels.fromJSON(this.bot, {
        url: `https://backend.wplace.live/files/s0/tiles/${key}.png`,
        exactColor: true
      });
      this.bot.mapsCache.set(key, map);
    }
    return map.pixels[this.y][this.x];
  }
  scrollScreenTo() {
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
    return [this.tileX, this.tileY, this.x, this.y];
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
  lock;
  static async fromJSON(bot, data) {
    return new BotImage(bot, WorldPosition.fromJSON(bot, data.position), await Pixels.fromJSON(bot, data.pixels), data.strategy, data.opacity, data.drawTransparentPixels, data.lock);
  }
  element = document.createElement("div");
  tasks = [];
  moveInfo;
  $wrapper;
  $settings;
  $strategy;
  $topbar;
  $lock;
  $opacity;
  $brightness;
  $drawTransparent;
  $resetSize;
  $resetSizeSpan;
  $progressLine;
  $progressText;
  $canvas;
  $colors;
  $export;
  constructor(bot, position, pixels, strategy = "RANDOM" /* RANDOM */, opacity = 50, drawTransparentPixels = false, lock = false) {
    super();
    this.bot = bot;
    this.position = position;
    this.pixels = pixels;
    this.strategy = strategy;
    this.opacity = opacity;
    this.drawTransparentPixels = drawTransparentPixels;
    this.lock = lock;
    this.element.innerHTML = image_default;
    this.element.classList.add("wimage");
    document.body.append(this.element);
    this.populateElementsWithSelector(this.element, {
      $wrapper: ".wrapper",
      $strategy: ".strategy",
      $opacity: ".opacity",
      $settings: ".wsettings",
      $lock: ".lock",
      $topbar: ".wtopbar",
      $brightness: ".brightness",
      $drawTransparent: ".draw-transparent",
      $resetSize: ".reset-size",
      $progressLine: ".progress div",
      $progressText: ".progress span",
      $colors: ".colors",
      $export: ".export"
    });
    this.$resetSizeSpan = this.$resetSize.querySelector("span");
    this.$canvas = this.pixels.canvas;
    this.$wrapper.prepend(this.pixels.canvas);
    this.registerEvent(this.$strategy, "change", () => {
      this.strategy = this.$strategy.value;
      this.bot.save();
    });
    this.registerEvent(this.$opacity, "input", () => {
      this.opacity = this.$opacity.valueAsNumber;
      this.update();
      this.bot.save();
    });
    let timeout2;
    this.registerEvent(this.$brightness, "change", () => {
      clearTimeout(timeout2);
      timeout2 = setTimeout(() => {
        this.pixels.brightness = this.$brightness.valueAsNumber;
        this.pixels.update();
        this.updateColorsToBuy();
        this.update();
        this.bot.save();
      }, 1000);
    });
    this.registerEvent(this.$resetSize, "click", () => {
      this.pixels.width = this.pixels.image.naturalWidth;
      this.pixels.update();
      this.updateColorsToBuy();
      this.update();
      this.bot.save();
    });
    this.registerEvent(this.$drawTransparent, "click", () => {
      this.drawTransparentPixels = this.$drawTransparent.checked;
      this.bot.save();
    });
    this.registerEvent(this.$lock, "click", () => {
      this.lock = !this.lock;
      this.update();
      this.bot.save();
    });
    this.registerEvent(this.$export, "click", this.export.bind(this));
    this.registerEvent(this.$topbar, "mousedown", this.moveStart.bind(this));
    this.registerEvent(this.$canvas, "mousedown", this.moveStart.bind(this));
    this.registerEvent(document, "mouseup", this.moveStop.bind(this));
    this.registerEvent(document, "mousemove", this.move.bind(this));
    for (const $resize of this.element.querySelectorAll(".resize"))
      this.registerEvent($resize, "mousedown", this.resizeStart.bind(this));
    this.update();
    this.updateColorsToBuy();
  }
  toJSON() {
    return {
      pixels: this.pixels.toJSON(),
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels,
      lock: this.lock
    };
  }
  async updateTasks() {
    this.tasks.length = 0;
    const position = this.position.clone();
    for (const { x, y } of this.strategyPositionIterator()) {
      const color = this.pixels.pixels[y][x];
      position.globalX = this.position.globalX + x;
      position.globalY = this.position.globalY + y;
      const mapColor = await position.getMapColor();
      if (color !== mapColor && (this.drawTransparentPixels || color !== "color-0"))
        this.tasks.push({
          position: position.clone(),
          buttonId: color,
          mapColor
        });
    }
    this.update();
    this.bot.widget.update();
  }
  update() {
    const halfPixel = this.bot.pixelSize / 2;
    try {
      const { x, y } = this.position.toScreenPosition();
      this.element.style.transform = `translate(${x - halfPixel}px, ${y - halfPixel}px)`;
      this.element.style.width = `${this.bot.pixelSize * this.pixels.width}px`;
      this.$canvas.style.opacity = `${this.opacity}%`;
      this.element.classList.remove("hidden");
    } catch {
      this.element.classList.add("hidden");
    }
    this.$resetSizeSpan.textContent = this.pixels.width.toString();
    this.$brightness.valueAsNumber = this.pixels.brightness;
    this.$strategy.value = this.strategy;
    this.$opacity.valueAsNumber = this.opacity;
    this.$drawTransparent.checked = this.drawTransparentPixels;
    const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0].length;
    const doneTasks = maxTasks - this.tasks.length;
    const percent = doneTasks / maxTasks * 100 | 0;
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${this.tasks.length / 120 | 0}h`;
    this.$progressLine.style.transform = `scaleX(${percent}%)`;
    this.$wrapper.classList[this.lock ? "add" : "remove"]("no-pointer-events");
    this.$lock.textContent = this.lock ? "\uD83D\uDD12" : "\uD83D\uDD13";
  }
  destroy() {
    super.destroy();
    this.element.remove();
  }
  *strategyPositionIterator() {
    const width = this.pixels.pixels[0].length;
    const height = this.pixels.pixels.length;
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
    this.moveInfo = undefined;
  }
  move(event) {
    if (!this.moveInfo)
      return;
    const deltaX = Math.round((event.clientX - this.moveInfo.clientX) / this.bot.pixelSize);
    const deltaY = Math.round((event.clientY - this.moveInfo.clientY) / this.bot.pixelSize);
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
    if (this.moveInfo.width !== undefined || this.moveInfo.height !== undefined) {
      this.pixels.update();
      this.updateColorsToBuy();
    }
    this.update();
    this.bot.save();
  }
  resizeStart(event) {
    this.moveInfo = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    const $resize = event.target;
    if ($resize.classList.contains("n")) {
      this.moveInfo.height = this.pixels.height;
      this.moveInfo.globalY = this.position.globalY;
    }
    if ($resize.classList.contains("e"))
      this.moveInfo.width = this.pixels.width;
    if ($resize.classList.contains("s"))
      this.moveInfo.height = this.pixels.height;
    if ($resize.classList.contains("w")) {
      this.moveInfo.width = this.pixels.width;
      this.moveInfo.globalX = this.position.globalX;
    }
  }
  updateColorsToBuy() {
    if (this.pixels.colorsToBuy.length === 0) {
      this.$colors.innerHTML = "You have all colors!";
      return;
    }
    let sum = 0;
    for (let index = 0;index < this.pixels.colorsToBuy.length; index++)
      sum += this.pixels.colorsToBuy[index][1];
    this.$colors.innerHTML = "";
    for (let index = 0;index < this.pixels.colorsToBuy.length; index++) {
      const [color, amount] = this.pixels.colorsToBuy[index];
      const $button = document.createElement("button");
      this.$colors.append($button);
      $button.style.backgroundColor = `oklab(${color.color[0] * 100}% ${color.color[1]} ${color.color[2]})`;
      $button.style.width = amount / sum * 100 + "%";
      $button.addEventListener("click", async () => {
        await this.bot.updateColors();
        document.getElementById(color.buttonId)?.click();
      });
    }
  }
  export() {
    const a = document.createElement("a");
    document.body.append(a);
    a.href = URL.createObjectURL(new Blob([JSON.stringify(this.toJSON())], { type: "application/json" }));
    a.download = `${this.pixels.width}x${this.pixels.height}.wbot`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.href = this.pixels.canvas.toDataURL("image/webp", 1);
    a.download = `${this.pixels.width}x${this.pixels.height}.webp`;
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
}

// src/widget.html
var widget_default = `<div class="wtopbar">
  <button class="minimize">-</button>
</div>
<div class="wsettings">
  <div class="wp wstatus"></div>
  <div class="progress"><div></div><span></span></div>
  <button class="draw" disabled>Draw</button>
  <label>Strategy:&nbsp;<select class="strategy">
    <option value="SEQUENTIAL" selected>Sequential</option>
    <option value="ALL">All</option>
    <option value="PERCENTAGE">Percentage</option>
  </select></label>
  <div class="images"></div>
  <button class="add-image" disabled>Add image</button>
</div>
`;

// src/widget.ts
class Widget extends Base2 {
  bot;
  element = document.createElement("div");
  x = 64;
  y = 64;
  get status() {
    return this.$status.innerHTML;
  }
  set status(value) {
    this.$status.innerHTML = value;
  }
  strategy = "SEQUENTIAL" /* SEQUENTIAL */;
  images = [];
  moveInfo;
  $settings;
  $status;
  $minimize;
  $topbar;
  $draw;
  $addImage;
  $strategy;
  $progressLine;
  $progressText;
  $images;
  constructor(bot) {
    super();
    this.bot = bot;
    this.element.classList.add("wwidget");
    this.element.innerHTML = widget_default;
    document.body.append(this.element);
    this.populateElementsWithSelector(this.element, {
      $settings: ".wsettings",
      $status: ".wstatus",
      $minimize: ".minimize",
      $topbar: ".wtopbar",
      $draw: ".draw",
      $addImage: ".add-image",
      $strategy: ".strategy",
      $progressLine: ".progress div",
      $progressText: ".progress span",
      $images: ".images"
    });
    this.$minimize.addEventListener("click", () => {
      this.minimize();
    });
    this.$topbar.addEventListener("mousedown", (event) => {
      this.moveStart(event.clientX, event.clientY);
    });
    this.registerEvent(document, "mouseup", () => {
      this.moveStop();
    });
    this.registerEvent(document, "mousemove", (event) => {
      if (this.moveInfo)
        this.move(event.clientX, event.clientY);
      this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
    });
    this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
    this.$draw.addEventListener("click", () => this.bot.draw());
    this.$addImage.addEventListener("click", () => this.addImage());
    this.$strategy.addEventListener("change", () => {
      this.strategy = this.$strategy.value;
    });
    this.update();
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
        }), new Pixels(this.bot, image));
      }
      this.images.push(botImage);
      await botImage.updateTasks();
      this.bot.save();
    }, () => {
      this.setDisabled("add-image", false);
    });
  }
  update() {
    this.$strategy.value = this.strategy;
    let maxTasks = 0;
    let totalTasks = 0;
    for (let index = 0;index < this.images.length; index++) {
      const image = this.images[index];
      maxTasks += image.pixels.pixels.length * image.pixels.pixels[0].length;
      totalTasks += image.tasks.length;
    }
    const doneTasks = maxTasks - totalTasks;
    const percent = doneTasks / maxTasks * 100 | 0;
    this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${totalTasks / 120 | 0}h`;
    this.$progressLine.style.transform = `scaleX(${percent}%)`;
    this.$images.innerHTML = "";
    for (let index = 0;index < this.images.length; index++) {
      const image = this.images[index];
      const $image = document.createElement("div");
      this.$images.append($image);
      $image.className = "image";
      $image.innerHTML = `<img src="${image.pixels.image.src}">
  <button class="up" title="Move up" ${index === 0 ? "disabled" : ""}>▴</button>
  <button class="down" title="Move down" ${index === this.images.length - 1 ? "disabled" : ""}>▾</button>
  <button class="delete" title="Move delete">X</button>`;
      $image.querySelector("img").addEventListener("click", () => {
        image.position.scrollScreenTo();
      });
      $image.querySelector(".up").addEventListener("click", () => {
        swap(this.images, index, index - 1);
        this.update();
        this.bot.save();
      });
      $image.querySelector(".down").addEventListener("click", () => {
        swap(this.images, index, index + 1);
        this.update();
        this.bot.save();
      });
      $image.querySelector(".delete").addEventListener("click", () => {
        this.images.splice(index, 1);
        image.destroy();
        this.update();
        this.bot.save();
      });
    }
  }
  updateImages() {
    for (let index = 0;index < this.images.length; index++)
      this.images[index].update();
  }
  setDisabled(name, disabled) {
    this.element.querySelector("." + name).disabled = disabled;
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
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      images: this.images.map((x) => x.toJSON()),
      strategy: this.strategy
    };
  }
  minimize() {
    this.$settings.classList.toggle("hidden");
  }
  moveStart(x, y) {
    this.moveInfo = {
      x: this.x,
      y: this.y,
      originalX: x,
      originalY: y
    };
  }
  moveStop() {
    this.moveInfo = undefined;
  }
  move(x, y) {
    if (!this.moveInfo)
      return;
    this.x = this.moveInfo.x + x - this.moveInfo.originalX;
    this.y = this.moveInfo.y + y - this.moveInfo.originalY;
  }
}

// src/bot.ts
var SAVE_VERSION = 1;

class WPlaceBot {
  widget = new Widget(this);
  colors = [];
  pixelSize = 1;
  mapsCache = new Map;
  anchorsWorldPosition = new Array(2);
  anchorsScreenPosition = new Array(2);
  markerPixelPositionResolvers = [];
  saveTimeout;
  constructor() {
    this.registerFetchInterceptor();
    this.widget.run("Initializing", async () => {
      const json = localStorage.getItem("wbot");
      let save;
      try {
        save = JSON.parse(json);
        if (typeof save !== "object" || save.version !== SAVE_VERSION)
          throw new Error("NOT VALID SAVE");
      } catch {
        localStorage.removeItem("wbot");
        save = undefined;
      }
      if (save) {
        this.widget.x = save.widget.x;
        this.widget.y = save.widget.y;
        this.widget.strategy = save.widget.strategy;
      }
      await this.waitForElement("login", ".avatar.center-absolute.absolute");
      await this.waitForElement("pixel count", ".btn.btn-primary.btn-lg.relative.z-30 canvas");
      const $canvasContainer = await this.waitForElement("canvas", ".maplibregl-canvas-container");
      new MutationObserver(this.onAnchorsMutation.bind(this)).observe($canvasContainer, {
        attributes: true,
        attributeFilter: ["style"],
        subtree: true,
        childList: true
      });
      await wait(500);
      await this.loadAnchors();
      await this.updateColors();
      if (save)
        for (let index = 0;index < save.widget.images.length; index++) {
          const image = await BotImage.fromJSON(this, save.widget.images[index]);
          this.widget.images.push(image);
          image.update();
        }
      for (let index = 0;index < this.widget.images.length; index++)
        await this.widget.images[index].updateTasks();
      this.widget.setDisabled("draw", false);
      this.widget.setDisabled("add-image", false);
    });
  }
  draw() {
    if (this.pixelSize < 2)
      throw new ZoomTooFarError(this);
    this.widget.status = "";
    const prevent = (event) => {
      if (!event.shiftKey)
        event.stopPropagation();
    };
    const $canvas = document.querySelector(".maplibregl-canvas");
    globalThis.addEventListener("mousemove", prevent, true);
    $canvas.addEventListener("wheel", prevent, true);
    return this.widget.run("Drawing", async () => {
      this.mapsCache.clear();
      this.widget.setDisabled("draw", true);
      this.save();
      await this.updateColors();
      for (let index = 0;index < this.widget.images.length; index++)
        await this.widget.images[index].updateTasks();
      const n = this.widget.images.reduce((accumulator, x) => accumulator + x.tasks.length, 0);
      switch (this.widget.strategy) {
        case "ALL" /* ALL */: {
          while (!document.querySelector("ol")) {
            let end = true;
            for (let imageIndex = 0;imageIndex < this.widget.images.length; imageIndex++) {
              const task = this.widget.images[imageIndex].tasks.shift();
              if (!task)
                continue;
              await this.drawTask(task);
              end = false;
            }
            if (end)
              break;
          }
          break;
        }
        case "PERCENTAGE" /* PERCENTAGE */: {
          for (let taskIndex = 0;taskIndex < n && !document.querySelector("ol"); taskIndex++) {
            let minPercent = 1;
            let minImage;
            for (let imageIndex = 0;imageIndex < this.widget.images.length; imageIndex++) {
              const image = this.widget.images[imageIndex];
              const percent = 1 - image.tasks.length / (image.pixels.pixels.length * image.pixels.pixels[0].length);
              if (percent < minPercent) {
                minPercent = percent;
                minImage = image;
              }
            }
            await this.drawTask(minImage.tasks.shift());
          }
          break;
        }
        case "SEQUENTIAL" /* SEQUENTIAL */: {
          for (let imageIndex = 0;imageIndex < this.widget.images.length; imageIndex++) {
            const image = this.widget.images[imageIndex];
            for (let task = image.tasks.shift();task && !document.querySelector("ol"); task = image.tasks.shift())
              await this.drawTask(task);
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
  save() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      localStorage.setItem("wbot", JSON.stringify(this));
    }, 1000);
  }
  toJSON() {
    return {
      version: SAVE_VERSION,
      widget: this.widget.toJSON()
    };
  }
  updateColors() {
    return this.widget.run("Colors update", async () => {
      await this.openColors();
      this.colors = [
        ...document.querySelectorAll("button.btn.relative.w-full")
      ].map((button, index, array) => {
        if (index === array.length - 1)
          return {
            color: [Number.NaN, Number.NaN, Number.NaN],
            available: true,
            buttonId: "color-0"
          };
        const rgb = button.style.background.slice(4, -1).split(", ").map((x) => +x);
        return {
          color: rgbToOklab(...rgb),
          available: button.children.length === 0,
          buttonId: button.id
        };
      });
    });
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
  async openColors() {
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
  async clickAndGetPixelWorldPosition(screenPosition) {
    await this.waitForUnfocus();
    const positionPromise = withTimeout(() => new Promise((resolve) => {
      this.markerPixelPositionResolvers.push(resolve);
    }), 1000);
    document.querySelector(".maplibregl-canvas").dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: screenPosition.x,
      clientY: screenPosition.y,
      button: 0
    }));
    return positionPromise;
  }
  async drawTask(task) {
    document.getElementById(task.buttonId).click();
    const position = task.position.toScreenPosition();
    document.documentElement.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true,
      clientX: position.x,
      clientY: position.y,
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
    await wait(1);
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
  registerFetchInterceptor() {
    const originalFetch = globalThis.fetch;
    const pixelRegExp = /https:\/\/backend.wplace.live\/s\d+\/pixel\/(\d+)\/(\d+)\?x=(\d+)&y=(\d+)/;
    globalThis.fetch = async (...arguments_) => {
      const response = await originalFetch(...arguments_);
      const url = typeof arguments_[0] === "string" ? arguments_[0] : arguments_[0].url;
      setTimeout(() => {
        const pixelMatch = pixelRegExp.exec(url);
        if (pixelMatch) {
          for (let index = 0;index < this.markerPixelPositionResolvers.length; index++)
            this.markerPixelPositionResolvers[index](new WorldPosition(this, +pixelMatch[1], +pixelMatch[2], +pixelMatch[3], +pixelMatch[4]));
          this.markerPixelPositionResolvers.length = 0;
          return;
        }
      }, 0);
      return response;
    };
  }
  loadAnchors() {
    return this.widget.run("Loading positions", async () => {
      await this.waitForUnfocus();
      await this.closeAll();
      const stars = this.getStars();
      for (let index = 0;index < 2; index++) {
        let star = stars[index];
        const position = star ? star[1] : index === 0 ? { x: -20000, y: -20000 } : { x: 20000, y: 20000 };
        this.anchorsWorldPosition[index] = await this.clickAndGetPixelWorldPosition(position);
        if (!star) {
          document.querySelector("button.btn-soft:nth-child(2)").click();
          while (!star) {
            star = this.getStars()[index];
            await wait(100);
          }
        }
      }
      this.onAnchorsMutation();
    });
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
  onAnchorsMutation() {
    const stars = this.getStars();
    const p1 = this.anchorsWorldPosition[0];
    const p2 = this.anchorsWorldPosition[1];
    if (!stars[0] || !stars[1] || !p1 || !p2)
      return;
    const worldDistance = p2.globalX - p1.globalX;
    if (worldDistance < 500)
      throw new StarsAreTooCloseError(this);
    this.anchorsScreenPosition[0] = stars[0][1];
    this.anchorsScreenPosition[1] = stars[1][1];
    const s1 = this.anchorsScreenPosition[0];
    const s2 = this.anchorsScreenPosition[1];
    this.pixelSize = (s2.x - s1.x) / worldDistance;
    this.widget.updateImages();
  }
  extractScreenPositionFromStar($star) {
    const [x, y] = $star.style.transform.slice(32, -29).split(", ").map((x2) => Number.parseInt(x2));
    return { x, y };
  }
  getStars() {
    const $stars = [
      ...document.querySelectorAll(".text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center")
    ];
    const stars = $stars.map(($star) => [$star, this.extractScreenPositionFromStar($star)]);
    stars.sort((a, b) => a[1].x - b[1].x);
    return [stars[0], stars.at(-1)];
  }
}

// src/style.css
var style_default = `:root {
  --background: #ffffff;
  --disabled: #c2c2c2;
  --hover: #dfdfdf;
  --main-hover: #2580ff;
  --main: #0069ff;
  --text-invert: #ffffff;
  --text: #394e6a;
  --resize: 4px;
}

/** Widget */
.wwidget {
  background-color: var(--background);
  color: var(--text);
  left: 0;
  position: fixed;
  top: 0;
  width: 256px;
  z-index: 10;
}
.wwidget .images {
  height: auto;
  flex-direction: column;
  max-height: 300px;
  overflow-y: auto;
}
.wwidget .images .image {
  display: flex;
  align-items: center;
  height: 64px;
  width: 100%;
}
.wwidget .images .image img {
  height: 64px;
  margin: 0 auto;
  cursor: pointer;
}
.wwidget .images .image button {
  height: 64px;
  width: 32px;
  font-size: 24px;
  font-weight: bolder;
}

/** Image */
.wimage {
  left: 0;
  position: fixed;
  top: 0;
  z-index: 9;
  box-shadow: inset var(--main) 0 0 0 1px;
  height: 1px;
}
.wimage canvas {
  cursor: all-scroll;
  image-rendering: pixelated;
  width: 100%;
}
.wimage .wsettings {
  background-color: var(--background);
  color: var(--text);
  display: none;
  position: absolute;
  width: 100%;
  min-width: 256px;
}
.wimage .wrapper:hover .wsettings {
  display: block;
}

/* Settings */
.wsettings > * {
  align-items: center;
  display: flex;
  height: 24px;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
.wsettings button, .wsettings input {
  cursor: pointer;
  transition: background-color 0.5s;
} 
.wsettings button:hover, .wsettings input:hover {
  background-color: var(--hover);
} 
.wsettings button:disabled, .wsettings input:disabled {
  background-color: var(--disabled);
  cursor: no-drop;
}

.wsettings label input:not([type='checkbox']) {
  width: inherit;
}
.wsettings .progress {
  position: relative;
}
.wsettings .progress div {
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: var(--main-hover);
  transform-origin: left;
}
.wsettings .progress span {
  z-index: 0;
}
.wsettings .colors button {
  height: 100%;
}

/* Move */
.wtopbar {
  position: absolute;
  top: -24px;
  left: 0;
  background-color: var(--main);
  color: var(--text-invert);
  cursor: all-scroll;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: end;
}
.wtopbar button {
  min-width: 24px;
}
.wtopbar button:hover {
  background-color: var(--main-hover);
}

/* Resize */
.resize {
  height: calc(100% - var(--resize) - var(--resize));
  width: calc(100% - var(--resize) - var(--resize));
  position: absolute;
}
.resize.n {
  cursor: n-resize;
  top: 0;
  left: var(--resize);
  height: var(--resize);
}
.resize.e {
  cursor: e-resize;
  top: var(--resize);
  right: 0;
  width: var(--resize);
}
.resize.s {
  cursor: s-resize;
  left: var(--resize);
  bottom: 0;
  height: var(--resize);
}
.resize.w {
  cursor: w-resize;
  top: var(--resize);
  left: 0;
  width: var(--resize);
}

/* Utility */
.wp {
  padding: 0 8px;
}
.hidden {
  display: none;
}
.no-pointer-events {
  pointer-events: none;
}

`;

// src/index.ts
var style = document.createElement("style");
style.textContent = style_default;
document.head.append(style);
globalThis.wbot = new WPlaceBot;
