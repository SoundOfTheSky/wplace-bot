# Wplace-bot

## Features

1. Auto draw (still need to click captcha manually)
2. Multiple images
3. Many strategies
4. Auto image convert/scale
5. Suggests colors to buy
6. Optional captcha bypass

## Installation

1. Install TamperMonkey browser extension: [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en)|[Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
2. [Open this link](https://github.com/SoundOfTheSky/wplace-bot/raw/refs/heads/main/dist.user.js)
3. Press install
4. Allow user scripts
   1. Chrome: Settings>Extensions>Manage Extensions>Tampermonkey>Details>Allow User Scripts
   2. Firefox: Settings>Extensions and Themes>Tampermonkey>Allow User Scripts

## How to use

1. Click here to unfocus window.
2. Add raw or exported image.
3. Drag image and it's edges to position it.
4. Click "Draw" to draw :)
5. How to distribute pixels between images.
6. Change brightness of the image.
7. How to draw image.
8. Export image with it's position and settings.
9. Lock image to prevent accidental edits.
10. Delete image.
11. Click to disable color.
12. It's a substitute color automatically replaced. Click right to disable it.
13. Click left to try to buy recommended color.
14. Drag colors to change order. Don't forget to check "Draw color in order".
15. Move image up
16. Move image down

![Instruction1](https://github.com/SoundOfTheSky/wplace-bot/raw/refs/heads/main/Instruction.png)

## Captcha bypass

I recommend using simple autoclicker like this

1. Reload tab "CTRL+SHIFT", wait 10 seconds (Optional, but recommended)
2. Click "Draw", wait 15 seconds
3. Click Captcha, wait 5s
4. Click "Paint", wait 30 minutes
5. Repeat

Also I'm using [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/) to open multiple bots, each in it's own tab.

## Known issues

1. Once your session on website ends, bot obviously stops.
2. Very big images make everything lag.

## Contribution

1. Install [Bun](https://bun.sh/)
2. Install dependencies `bun i`
3. Up version in `script.txt`
4. Lint `bun run lint`
5. Build `bun start`
