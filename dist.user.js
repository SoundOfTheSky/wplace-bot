// ==UserScript==
// @name         wplace-bot
// @namespace    https://github.com/SoundOfTheSky
// @version      1.1.2
// @description  Bot to automate painting on website https://wplace.live
// @author       SoundOfTheSky
// @license      MPL-2.0
// @homepageURL  https://github.com/SoundOfTheSky/wplace-bot
// @updateURL    https://raw.githubusercontent.com/SoundOfTheSky/wplace-bot/refs/heads/main/dist.user.js
// @downloadURL  https://raw.githubusercontent.com/SoundOfTheSky/wplace-bot/refs/heads/main/dist.user.js
// @run-at       document-start
// @match        *://*.wplace.live/*
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM.setValue
// @grant        GM_getValue
// ==/UserScript==

// Wplace  --> https://wplace.live
// License --> https://www.mozilla.org/en-US/MPL/2.0/

// src/index.ts
class WPlaceBot {
  colors = [];
  pixels = [[]];
  overlayEdit;
  get scale() {
    return +(localStorage.getItem("wbot_scale") ?? "100");
  }
  set scale(value) {
    localStorage.setItem("wbot_scale", value.toString());
  }
  get x() {
    return +(localStorage.getItem("wbot_x") ?? "64");
  }
  set x(value) {
    localStorage.setItem("wbot_x", value.toString());
  }
  get y() {
    return +(localStorage.getItem("wbot_y") ?? "64");
  }
  set y(value) {
    localStorage.setItem("wbot_y", value.toString());
  }
  get width() {
    return +(localStorage.getItem("wbot_width") ?? "256");
  }
  set width(value) {
    localStorage.setItem("wbot_width", value.toString());
  }
  get cx() {
    return +(localStorage.getItem("wbot_cx") ?? "0");
  }
  set cx(value) {
    localStorage.setItem("wbot_cx", value.toString());
  }
  get cy() {
    return +(localStorage.getItem("wbot_cy") ?? "0");
  }
  set cy(value) {
    localStorage.setItem("wbot_cy", value.toString());
  }
  image;
  constructor() {
    this.initUI();
  }
  destroy() {
    document.querySelector(".wbot")?.remove();
    document.querySelector(".wbot-overlay")?.remove();
  }
  selectImage() {
    document.querySelector(".wbot .select-image").disabled = true;
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("NO_FILE"));
          return;
        }
        const reader = new FileReader;
        reader.addEventListener("load", () => {
          this.image = new Image;
          this.image.src = reader.result;
          this.image.addEventListener("load", () => {
            try {
              this.processImage();
              resolve();
            } catch (error) {
              reject(error);
            } finally {
              document.querySelector(".wbot .select-image").disabled = false;
            }
          });
          this.image.addEventListener("error", reject);
        });
        reader.addEventListener("error", reject);
        reader.readAsDataURL(file);
      });
      input.click();
    });
  }
  async draw() {
    try {
      await this.updateColors();
      const canvas = document.querySelector(".maplibregl-canvas");
      document.querySelector(".wbot-overlay").classList.add("disabled");
      document.querySelector(".wbot .draw").disabled = true;
      for (;this.cy < this.pixels.length; this.cy++) {
        for (;this.cx < this.pixels[0].length; this.cx++) {
          const pixel = this.getClosestColor(this.pixels[this.cy][this.cx]);
          if (!pixel)
            continue;
          pixel.button.click();
          await new Promise((r) => setTimeout(r, 1));
          const pixelSize = this.width / this.pixels.length;
          canvas.dispatchEvent(new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            clientX: this.x + this.cx * pixelSize + pixelSize / 2,
            clientY: this.y + this.cy * pixelSize + pixelSize / 2,
            button: 0
          }));
          await new Promise((r) => setTimeout(r, 1));
          if (document.querySelector("ol"))
            return;
          this.updateUI();
        }
        this.cx = 0;
        if (this.cy === this.pixels.length - 1)
          this.cy = 0;
      }
    } finally {
      document.querySelector(".wbot-overlay").classList.remove("disabled");
      document.querySelector(".wbot .draw").disabled = false;
    }
  }
  async timer() {
    const $timer = document.querySelector(".wbot .timer");
    try {
      $timer.disabled = true;
      const me = await fetch("https://backend.wplace.live/me", {
        credentials: "include"
      }).then((x) => x.json());
      const time = Date.now() + (me.charges.max - me.charges.count) * me.charges.cooldownMs;
      while (true) {
        const left = time - Date.now();
        if (left <= 0) {
          new Audio("https://www.myinstants.com/media/sounds/winnerchickendinner.mp3").play();
          break;
        }
        $timer.textContent = `${left / 60000 | 0}:${left % 60000 / 1000 | 0}`;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } finally {
      $timer.disabled = false;
      $timer.textContent = "Set timer";
    }
  }
  async updateColors() {
    document.querySelector(".flex.gap-2.px-3 > .btn-circle")?.click();
    await new Promise((r) => setTimeout(r, 250));
    document.querySelector(".btn.btn-primary.btn-lg.relative.z-30")?.click();
    await new Promise((r) => setTimeout(r, 250));
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
          button
        };
      const rgb = button.style.background.slice(4, -1).split(", ").map((x) => +x);
      return {
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        a: 255,
        available: button.children.length === 0,
        button
      };
    });
  }
  processImage() {
    if (!this.image)
      throw new Error("NO_IMAGE");
    const imageCanvas = document.createElement("canvas");
    const imageContext = imageCanvas.getContext("2d");
    imageCanvas.width = this.image.width * this.scale / 100;
    imageCanvas.height = this.image.height * this.scale / 100;
    imageContext.drawImage(this.image, 0, 0, imageCanvas.width, imageCanvas.height);
    this.pixels = Array.from({ length: imageCanvas.height }, () => new Array(imageCanvas.width));
    const data = imageContext.getImageData(0, 0, imageCanvas.width, imageCanvas.height).data;
    for (let y = 0;y < imageCanvas.height; y++) {
      for (let x = 0;x < imageCanvas.width; x++) {
        const index = (y * imageCanvas.width + x) * 4;
        this.pixels[y][x] = {
          r: data[index],
          g: data[index + 1],
          b: data[index + 2],
          a: data[index + 3]
        };
      }
    }
    this.updateUI();
    this.updateColors();
    document.querySelector(".wbot .select-image").disabled = false;
    document.querySelector(".wbot .draw").disabled = false;
    document.querySelector(".wbot .timer").disabled = false;
    document.querySelector(".wbot .hide-overlay").disabled = false;
    document.querySelector(".wbot-overlay").classList.remove("hidden");
  }
  initUI() {
    const style = document.createElement("style");
    style.textContent = `
      .wbot {
        background-color: #1f1f1f;
        border-radius: 16px;
        color: #bfbfbf;
        overflow: hidden;
        position: fixed;
        right: 64px;
        top: 64px;
        z-index: 9999;
        width: 256px;
      }

      .wbot table {
        table-layout: fixed;
      }

      .wbot table td {
        white-space: nowrap;
        padding: 0 8px;
      }

      .wbot input, .wbot button {
        width: 100%;
        cursor: pointer;
      }

      .wbot button:hover, .wbot input:hover {
        background-color: #2c2c2c;
      }

      .wbot-overlay {
        position: fixed;
        z-index: 9999;
        border: 1px solid red;
        cursor: all-scroll;
        top: 0;
        left: 0;
      }

      .wbot-overlay.disabled {
        pointer-events: none;
      }

      .hidden {
        display: none;
      }

      .wbot [disabled], .wbot *:disabled {
        background-color: #505050;
        cursor: not-allowed;
      }

      .wbot .colors {
        display: flex;
      }

      .wbot .colors button {
        width: 32px;
        height: 32px;
        cursor: pointer;
      }
    `;
    document.head.append(style);
    const container = document.createElement("div");
    container.className = "wbot";
    container.innerHTML = `
          <button class="select-image">Select image</button>
          <button class="draw" disabled>Draw</button>
          <button class="timer" disabled>Set timer</button>
          <button class="hide-overlay" disabled>Hide overlay</button>
          <div class="colors"></div>
          <table><tbody>
            <tr><td>Scale: </td><td><input type="number" class="scale"></td></tr>
            <tr><td>Width: </td><td><input type="number" class="width"></td></tr>
            <tr><td>Overlay X: </td><td><input type="number" class="x"></td></tr>
            <tr><td>Overlay Y: </td><td><input type="number" class="y"></td></tr>
            <tr><td>Start X: </td><td><input type="number" class="cx"></td></tr>
            <tr><td>Start Y: </td><td><input type="number" class="cy"></td></tr>
          </tbody></table>
    `;
    document.body.append(container);
    container.querySelector(".select-image").addEventListener("click", () => this.selectImage());
    container.querySelector(".draw").addEventListener("click", () => this.draw());
    container.querySelector(".timer").addEventListener("click", () => this.timer());
    const overlay = document.createElement("canvas");
    container.querySelector(".hide-overlay").addEventListener("click", () => {
      overlay.classList.toggle("hidden");
    });
    overlay.classList.add("wbot-overlay", "hidden");
    overlay.addEventListener("click", (event) => {
      const pixelSize = this.width / this.pixels.length;
      this.cx = (event.clientX - this.x) / pixelSize | 0;
      this.cy = (event.clientY - this.y) / pixelSize | 0;
      this.updateUI();
    });
    overlay.addEventListener("mousedown", (event) => {
      this.overlayEdit = {
        x: this.x,
        y: this.y,
        clientX: event.clientX,
        clientY: event.clientY,
        width: event.clientX > this.x + this.width ? this.width : undefined
      };
    });
    overlay.addEventListener("mouseup", () => {
      this.overlayEdit = undefined;
    });
    overlay.addEventListener("mousemove", (event) => {
      if (!this.overlayEdit)
        return;
      if (this.overlayEdit.width) {
        this.width = this.overlayEdit.width + event.clientX - this.overlayEdit.clientX;
      } else {
        this.x = this.overlayEdit.x + event.clientX - this.overlayEdit.clientX;
        this.y = this.overlayEdit.y + event.clientY - this.overlayEdit.clientY;
      }
      this.updateUI();
    });
    overlay.addEventListener("wheel", (event) => {
      this.width += event.deltaY < 0 ? 1 : -1;
      this.updateUI();
    });
    document.body.append(overlay);
    const registerNumberInput = (name) => {
      container.querySelector("." + name).addEventListener("input", (event) => {
        this[name] = event.target.value;
        this.updateUI();
      });
    };
    for (const name of ["x", "y", "cx", "cy", "width", "scale"])
      registerNumberInput(name);
    this.updateUI();
  }
  updateUI() {
    const updateInput = (name) => {
      const input = document.querySelector(".wbot ." + name);
      input.value = this[name];
    };
    ["x", "y", "cx", "cy", "width", "scale"].forEach(updateInput);
    const overlay = document.querySelector(".wbot-overlay");
    overlay.style.transform = `translate(${this.x}px, ${this.y}px)`;
    const pixelSize = this.width / this.pixels.length;
    overlay.height = pixelSize * this.pixels.length;
    overlay.width = pixelSize * this.pixels[0].length;
    const context = overlay.getContext("2d");
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.strokeStyle = `red`;
    for (let y = 0;y < this.pixels.length; y++) {
      const row = this.pixels[y];
      for (let x = 0;x < row.length; x++) {
        const pixel = row[x];
        context.fillStyle = `rgb(${pixel.r} ${pixel.g} ${pixel.b})`;
        context.globalAlpha = pixel.a / 510;
        context.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
    context.globalAlpha = 0.8;
    context.fillStyle = `cyan`;
    context.fillRect(this.cx * pixelSize, 0, pixelSize, overlay.height);
    context.fillRect(0, this.cy * pixelSize, overlay.width, pixelSize);
  }
  getClosestColor({ a }, _allowNotAvailable) {
    if (this.colors.length === 0)
      throw new Error("NO_COLORS");
    if (a > 100)
      return this.colors.at(-1);
  }
}
new WPlaceBot;
