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

1. Add your image or exported "###.wbot" files.
2. Drag image and it's edges to position it.
3. Change order of images.
4. This is colors bar. Colors can be dragged. Don't forget to check "Draw color in order".
5. It's a substitution color. Top button to buy, lower button to disable.
6. Export an image. Exports file with brightness and resize applied and "###.wbot" file with all settings.
7. Lock image to prevent accidental edits and allow click-through.
8. Delete image.
9. Finally click "Draw" to start drawing :)

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
