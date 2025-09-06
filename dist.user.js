// ==UserScript==
// @name         wplace-bot
// @namespace    https://github.com/SoundOfTheSky
// @version      4.0.0
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

// src/errors.ts
class WPlaceBotError extends Error {
  name = "WPlaceBotError";
  constructor(message, bot) {
    super(message);
    bot.widget.status = message;
  }
}

class UnfocusRequiredError extends WPlaceBotError {
  name = "UnfocusRequiredError";
  constructor(bot) {
    super("❌ UNFOCUS WINDOW", bot);
  }
}

class NoFavLocation extends WPlaceBotError {
  name = "NoFavLocation";
  constructor(bot) {
    super("❌ Don't remove star!", bot);
    setTimeout(() => {
      globalThis.location.reload();
    }, 1000);
  }
}

class NoImageError extends WPlaceBotError {
  name = "NoImageError";
  constructor(bot) {
    super("❌ No image is selected", bot);
  }
}

// src/image.html
var image_default = `<canvas></canvas>
<div class="wsettings">
  <div class="progress"><div></div><span></span></div>
  <div class="colors"></div>
  <label>Opacity:&nbsp;<input class="opacity" type="range" min="0" max="100" /></label>
  <select class="strategy">
    <option value="RANDOM" selected>Random</option>
    <option value="DOWN">Down</option>
    <option value="UP">Up</option>
    <option value="LEFT">Left</option>
    <option value="RIGHT">Right</option>
    <option value="SPIRAL_FROM_CENTER">Spiral out</option>
    <option value="SPIRAL_TO_CENTER">Spiral in</option>
  </select>
  <button class="reset-size">Reset size [<span></span>px]</button>
  <label><input type="checkbox" class="draw-transparent" />&nbsp;Erase transparent pixels</label>
</div>
<div class="resize n"></div>
<div class="resize e"></div>
<div class="resize s"></div>
<div class="resize w"></div>
`;

// src/pixels.ts
class Pixels {
  bot;
  image;
  width;
  static async fromSelectImage(bot, width) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();
    await promisifyEventSource(input, ["change"], ["cancel", "error"]);
    const file = input.files?.[0];
    if (!file)
      throw new NoImageError(bot);
    const reader = new FileReader;
    reader.readAsDataURL(file);
    await promisifyEventSource(reader, ["load"], ["error"]);
    const image = new Image;
    image.src = reader.result;
    await promisifyEventSource(image, ["load"], ["error"]);
    return new Pixels(bot, image, width);
  }
  static async fromJSON(bot, data) {
    const image = new Image;
    image.crossOrigin = "anonymous";
    image.src = data.url;
    await promisifyEventSource(image, ["load"], ["error"]);
    return new Pixels(bot, image, data.width);
  }
  pixels;
  colorsToBuy = [];
  resolution;
  get height() {
    return this.width / this.resolution | 0;
  }
  set height(value) {
    this.width = value * this.resolution | 0;
  }
  constructor(bot, image, width = image.naturalWidth) {
    this.bot = bot;
    this.image = image;
    this.width = width;
    this.resolution = this.image.naturalWidth / this.image.naturalHeight;
    this.update();
  }
  update() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const colorsToBuy = new Map;
    canvas.width = this.width;
    canvas.height = this.height;
    context.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    this.pixels = Array.from({ length: canvas.height }, () => new Array(canvas.width));
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0;y < canvas.height; y++) {
      for (let x = 0;x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        if (a < 100) {
          this.pixels[y][x] = this.bot.colors.at(-1);
          continue;
        }
        let minDelta = Infinity;
        let min;
        let minDeltaReal = Infinity;
        let minReal;
        for (let index2 = 0;index2 < this.bot.colors.length; index2++) {
          const color = this.bot.colors[index2];
          const delta = (color.r - r) ** 2 + (color.g - g) ** 2 + (color.b - b) ** 2;
          if (color.available && delta < minDelta) {
            minDelta = delta;
            min = color;
          }
          if (delta < minDeltaReal) {
            minDeltaReal = delta;
            minReal = color;
          }
        }
        this.pixels[y][x] = min;
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
      width: this.width
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
    if (!bot.anchorWorldPosition)
      throw new UnfocusRequiredError(bot);
    return new WorldPosition(bot, bot.anchorWorldPosition.globalX + (position.x - bot.anchorScreenPosition.x) / bot.pixelSize | 0, bot.anchorWorldPosition.globalY + (position.y - bot.anchorScreenPosition.y) / bot.pixelSize | 0);
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
    if (!this.bot.anchorWorldPosition)
      throw new UnfocusRequiredError(this.bot);
    return {
      x: (this.globalX - this.bot.anchorWorldPosition.globalX) * this.bot.pixelSize + this.bot.anchorScreenPosition.x,
      y: (this.globalY - this.bot.anchorWorldPosition.globalY) * this.bot.pixelSize + this.bot.anchorScreenPosition.y
    };
  }
  async getMapColor() {
    const key = this.tileX + "/" + this.tileY;
    let map = this.bot.mapsCache.get(key);
    if (!map) {
      map = await Pixels.fromJSON(this.bot, {
        url: `https://backend.wplace.live/files/s0/tiles/${key}.png`
      });
      this.bot.mapsCache.set(key, map);
    }
    return map.pixels[this.y][this.x];
  }
  scrollScreenTo() {
    const { x, y } = this.toScreenPosition();
    console.log(x, y);
    this.bot.moveMap({
      x: -x,
      y: -y
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
class BotImage extends Base {
  bot;
  position;
  pixels;
  strategy;
  opacity;
  drawTransparentPixels;
  static async fromJSON(bot, data) {
    return new BotImage(bot, WorldPosition.fromJSON(bot, data.position), await Pixels.fromJSON(bot, data.pixels), data.strategy, data.opacity, data.drawTransparentPixels);
  }
  element = document.createElement("div");
  canvas;
  context;
  tasks = [];
  moveInfo;
  constructor(bot, position, pixels, strategy = "RANDOM" /* RANDOM */, opacity = 50, drawTransparentPixels = false) {
    super();
    this.bot = bot;
    this.position = position;
    this.pixels = pixels;
    this.strategy = strategy;
    this.opacity = opacity;
    this.drawTransparentPixels = drawTransparentPixels;
    document.body.append(this.element);
    this.element.innerHTML = image_default;
    this.element.classList.add("wimage");
    this.canvas = this.element.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    const $strategy = this.element.querySelector(".strategy");
    $strategy.addEventListener("change", () => {
      this.strategy = $strategy.value;
      this.bot.save();
    });
    const $opacity = this.element.querySelector(".opacity");
    $opacity.addEventListener("input", () => {
      this.opacity = $opacity.valueAsNumber;
      this.update();
      this.bot.save();
    });
    this.element.querySelector(".reset-size").addEventListener("click", () => {
      this.pixels.width = this.pixels.image.naturalWidth;
      this.pixels.update();
      this.update();
      this.bot.save();
    });
    const $drawTransparent = this.element.querySelector(".draw-transparent");
    $drawTransparent.addEventListener("click", () => {
      this.drawTransparentPixels = $drawTransparent.checked;
      this.bot.save();
    });
    this.canvas.addEventListener("mousedown", (event) => {
      this.moveInfo = {
        globalX: this.position.globalX,
        globalY: this.position.globalY,
        clientX: event.clientX,
        clientY: event.clientY
      };
    });
    this.registerEvent(document, "mouseup", () => {
      this.moveInfo = undefined;
    });
    this.registerEvent(document, "mousemove", (event) => {
      if (this.moveInfo)
        this.move(event.clientX, event.clientY);
    });
    for (const $resize of this.element.querySelectorAll(".resize")) {
      $resize.addEventListener("mousedown", (event) => {
        this.moveInfo = {
          clientX: event.clientX,
          clientY: event.clientY
        };
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
      });
    }
    this.update();
    this.updateTasks();
  }
  toJSON() {
    return {
      pixels: this.pixels.toJSON(),
      position: this.position.toJSON(),
      strategy: this.strategy,
      opacity: this.opacity,
      drawTransparentPixels: this.drawTransparentPixels
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
      if (color.buttonId !== mapColor.buttonId && (this.drawTransparentPixels || color.a !== 0)) {
        const { x: x2, y: y2 } = position.toScreenPosition();
        this.tasks.push({
          x: x2,
          y: y2,
          buttonId: color.buttonId
        });
      }
    }
    this.update();
  }
  update() {
    const halfPixel = this.bot.pixelSize / 2;
    try {
      const { x, y } = this.position.toScreenPosition();
      this.element.style.transform = `translate(${x - halfPixel}px, ${y - halfPixel}px)`;
      this.element.classList.remove("hidden");
    } catch {
      this.element.classList.add("hidden");
    }
    this.canvas.width = this.bot.pixelSize * this.pixels.pixels[0].length;
    this.canvas.height = this.bot.pixelSize * this.pixels.pixels.length;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let y = 0;y < this.pixels.pixels.length; y++) {
      const row = this.pixels.pixels[y];
      for (let x = 0;x < row.length; x++) {
        const pixel = row[x];
        this.context.fillStyle = `rgb(${pixel.r} ${pixel.g} ${pixel.b})`;
        this.context.globalAlpha = pixel.a / 255 * (this.opacity / 100);
        this.context.fillRect(x * this.bot.pixelSize, y * this.bot.pixelSize, this.bot.pixelSize, this.bot.pixelSize);
      }
    }
    this.element.querySelector(".reset-size span").textContent = this.pixels.width.toString();
    this.element.querySelector(".strategy").value = this.strategy;
    this.element.querySelector(".opacity").valueAsNumber = this.opacity;
    this.element.querySelector(".draw-transparent").checked = this.drawTransparentPixels;
    const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0].length;
    const doneTasks = maxTasks - this.tasks.length;
    const percent = doneTasks / maxTasks * 100 | 0;
    this.element.querySelector(".progress span").textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${this.tasks.length / 120 | 0}:${this.tasks.length % 120 / 2 | 0}`;
    this.element.querySelector(".progress div").style.transform = `scaleX(${percent}%)`;
  }
  destroy() {
    super.destroy();
    this.element.remove();
  }
  move(clientX, clientY) {
    if (!this.moveInfo)
      return;
    const deltaX = Math.round((clientX - this.moveInfo.clientX) / this.bot.pixelSize);
    const deltaY = Math.round((clientY - this.moveInfo.clientY) / this.bot.pixelSize);
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
    if (this.moveInfo.width !== undefined || this.moveInfo.height !== undefined)
      this.pixels.update();
    this.update();
    this.bot.save();
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
}

// src/widget.html
var widget_default = `<div class="move">
  <button class="minimize">-</button>
</div>
<div class="wsettings">
  <div class="wp wstatus"></div>
  <div class="progress"><div></div><span></span></div>
  <button class="draw" disabled>Draw</button>
  <select class="strategy">
    <option value="SEQUENTIAL" selected>Sequential</option>
    <option value="ALL">All</option>
    <option value="PERCENTAGE">Percentage</option>
  </select>
  <div class="images"></div>
  <button class="add-image" disabled>Add image</button>
</div>
`;

// src/widget.ts
class Widget extends Base {
  bot;
  element = document.createElement("div");
  x = 64;
  y = 64;
  get status() {
    return this.element.querySelector(".wstatus").innerHTML;
  }
  set status(value) {
    this.element.querySelector(".wstatus").innerHTML = value;
  }
  strategy = "SEQUENTIAL" /* SEQUENTIAL */;
  images = [];
  moveInfo;
  constructor(bot) {
    super();
    this.bot = bot;
    this.element.classList.add("wwidget");
    this.element.innerHTML = widget_default;
    document.body.append(this.element);
    this.element.querySelector(".minimize").addEventListener("click", () => {
      this.minimize();
    });
    const $move = this.element.querySelector(".move");
    $move.addEventListener("mousedown", (event) => {
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
    this.element.querySelector(".draw").addEventListener("click", () => this.bot.draw());
    this.element.querySelector(".add-image").addEventListener("click", () => this.addImage());
    const $strategy = this.element.querySelector(".strategy");
    $strategy.addEventListener("change", () => {
      this.strategy = $strategy.value;
    });
    this.update();
  }
  addImage() {
    this.setDisabled("add-image", true);
    return this.run("Adding image", async () => {
      await this.bot.updateColors();
      this.images.push(new BotImage(this.bot, WorldPosition.fromScreenPosition(this.bot, {
        x: 256,
        y: 32
      }), await Pixels.fromSelectImage(this.bot)));
      this.update();
      this.bot.save();
    }, () => {
      this.setDisabled("add-image", false);
    });
  }
  update() {
    this.element.querySelector(".strategy").value = this.strategy;
    let maxTasks = 0;
    let totalTasks = 0;
    for (let index = 0;index < this.images.length; index++) {
      const image = this.images[index];
      maxTasks += image.pixels.pixels.length * image.pixels.pixels[0].length;
      totalTasks += image.tasks.length;
    }
    const doneTasks = maxTasks - totalTasks;
    const percent = doneTasks / maxTasks * 100 | 0;
    this.element.querySelector(".progress span").textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${totalTasks / 120 | 0}:${totalTasks % 120 / 2 | 0}`;
    this.element.querySelector(".progress div").style.transform = `scaleX(${percent}%)`;
    const $images = this.element.querySelector(".images");
    $images.innerHTML = "";
    for (let index = 0;index < this.images.length; index++) {
      const image = this.images[index];
      const $image = document.createElement("div");
      $images.append($image);
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
    this.element.querySelector(".wsettings").classList.toggle("hidden");
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
  anchorWorldPosition;
  pixelSize = 1;
  mapsCache = new Map;
  get anchorScreenPosition() {
    const $favLocation = document.querySelector(".text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center");
    if (!$favLocation)
      throw new NoFavLocation(this);
    const [x, y] = $favLocation.style.transform.slice(32, -29).split(", ").map((x2) => Number.parseInt(x2));
    return { x, y };
  }
  markerPixelPositionResolvers = [];
  estimatingSize = false;
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
      while (!document.querySelector(".maplibregl-canvas") || !document.querySelector(".btn.btn-primary.btn-lg.relative.z-30 canvas") || !document.querySelector(".avatar.center-absolute.absolute"))
        await wait(500);
      await wait(500);
      await this.estimateSize();
      await this.updateColors();
      if (save)
        for (let index = 0;index < save.widget.images.length; index++) {
          const image = await BotImage.fromJSON(this, save.widget.images[index]);
          this.widget.images.push(image);
          image.update();
        }
      this.widget.update();
      const $canvas = document.querySelector(".maplibregl-canvas");
      setInterval(() => {
        this.widget.updateImages();
      }, 50);
      $canvas.addEventListener("wheel", () => {
        this.estimateSize();
      });
      this.widget.setDisabled("draw", false);
      this.widget.setDisabled("add-image", false);
    });
  }
  draw() {
    this.widget.status = "";
    const prevent = (event) => {
      if (!event.shiftKey)
        event.stopPropagation();
    };
    globalThis.addEventListener("mousemove", prevent, true);
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
      this.widget.updateImages();
      this.widget.update();
    }, () => {
      globalThis.removeEventListener("mousemove", prevent, true);
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
            r: 255,
            g: 255,
            b: 255,
            a: 0,
            available: true,
            buttonId: button.id
          };
        const rgb = button.style.background.slice(4, -1).split(", ").map((x) => +x);
        return {
          r: rgb[0],
          g: rgb[1],
          b: rgb[2],
          a: 255,
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
    document.documentElement.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true,
      clientX: task.x,
      clientY: task.y,
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
  estimateSize() {
    if (this.estimatingSize)
      return;
    this.anchorWorldPosition = undefined;
    this.estimatingSize = true;
    return this.widget.run("Adjusting", async () => {
      await this.waitForUnfocus();
      await this.closeAll();
      const $star = document.querySelector(".text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center");
      this.anchorWorldPosition = await this.clickAndGetPixelWorldPosition($star ? this.anchorScreenPosition : { x: 12, y: 12 });
      if (!$star) {
        document.querySelector("button.btn-soft:nth-child(2)").click();
        while (!document.querySelector(".text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center"))
          await wait(100);
      }
      const markerScreenPosition2 = {
        x: this.anchorScreenPosition.x + 1e4,
        y: this.anchorScreenPosition.y
      };
      const markerPosition2 = await this.clickAndGetPixelWorldPosition(markerScreenPosition2);
      this.pixelSize = (markerScreenPosition2.x - this.anchorScreenPosition.x) / (markerPosition2.globalX - this.anchorWorldPosition.globalX);
      this.widget.updateImages();
    }, () => {
      this.estimatingSize = false;
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
  --resize: 2px;
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
.wwidget .move {
  background-color: var(--main);
  color: var(--text-invert);
  cursor: all-scroll;
  width: 100%;
}
.wwidget .move .minimize {
  margin-left: auto;
  width: 24px;
  display: block;
}
.wwidget .move .minimize:hover {
  background-color: var(--main-hover);
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
  cursor: all-scroll;
}
.wimage .wsettings {
  background-color: var(--background);
  color: var(--text);
  display: none;
  position: absolute;
  width: 100%;
}
.wimage:hover .wsettings {
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

.wsettings .progress {
  position: relative;
}
.wsettings .progress div {
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: var(--main);
  transform-origin: left;
}
.wsettings .progress span {
  z-index: 0;
}


/* Utility */
.wp {
  padding: 0 8px;
}
.hidden {
  display: none;
}
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
}`;

// src/index.ts
var style = document.createElement("style");
style.textContent = style_default;
document.head.append(style);
new WPlaceBot;
