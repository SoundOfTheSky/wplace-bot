import { removeFromArray } from '@softsky/utils';

import { Base } from './base';
import { WPlaceBot } from './bot';
import { COLOR_NAMES, colorToCSS } from './colors';
// @ts-ignore
import html from './image.html' with { type: 'text' };
import { Pixels } from './pixels';
import { save } from './save';
import { Position, WorldPosition } from './world-position';

export type DrawTask = {
	position: WorldPosition;
	color: number;
};

export type ImageColorSetting = {
	color: number;
	disabled?: boolean;
};

export enum ImageStrategy {
	RANDOM = 'RANDOM',
	DOWN = 'DOWN',
	UP = 'UP',
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
	SPIRAL_FROM_CENTER = 'SPIRAL_FROM_CENTER',
	SPIRAL_TO_CENTER = 'SPIRAL_TO_CENTER',
}

export class BotImage extends Base {
	public static async fromJSON(bot: WPlaceBot, data: ReturnType<BotImage['toJSON']>) {
		return new BotImage(
			bot,
			WorldPosition.fromJSON(bot, data.position),
			await Pixels.fromJSON(bot, data.pixels),
			data.strategy,
			data.opacity,
			data.drawTransparentPixels,
			data.drawColorsInOrder,
			data.colors,
			data.lock,
			data.active ?? true
		);
	}

	public readonly element = document.createElement('div');

	/** Pixels left to draw */
	public tasks: DrawTask[] = [];

	public progress: DrawTask[] = [];

	/** Moving/resizing image */
	protected moveInfo?: {
		globalX?: number;
		globalY?: number;
		width?: number;
		height?: number;
		clientX: number;
		clientY: number;
	};

	protected readonly $brightness!: HTMLInputElement;
	protected readonly $canvas!: HTMLCanvasElement;
	protected readonly $colors!: HTMLDivElement;
	protected readonly $delete!: HTMLButtonElement;
	protected readonly $drawColorsInOrder!: HTMLInputElement;
	protected readonly $onlyAvailableColors!: HTMLInputElement;
	protected readonly $drawTransparent!: HTMLInputElement;
	protected readonly $export!: HTMLDivElement;
	protected readonly $lock!: HTMLButtonElement;
	protected readonly $opacity!: HTMLInputElement;
	protected readonly $progressLine!: HTMLDivElement;
	protected readonly $progressText!: HTMLSpanElement;
	protected readonly $resetSize!: HTMLButtonElement;
	protected readonly $resetSizeSpan!: HTMLSpanElement;
	protected readonly $settings!: HTMLDivElement;
	protected readonly $strategy!: HTMLSelectElement;
	protected readonly $topbar!: HTMLDivElement;
	protected readonly $wrapper!: HTMLDivElement;

	public constructor(
		protected bot: WPlaceBot,
		/** Top-left corner of image */
		public position: WorldPosition,
		/** Parsed imageto draw */
		public pixels: Pixels,
		/** Order of pixels to draw */
		public strategy = ImageStrategy.SPIRAL_FROM_CENTER,
		/** Opacity of overlay */
		public opacity = 50,
		/** Should we erase pixels there transparency should be */
		public drawTransparentPixels = false,
		/** Should bot draw colors in order */
		public drawColorsInOrder = false,
		/** Colors settings */
		public colors: { realColor: number; disabled?: boolean }[] = [],
		/** Stop accidental image edit */
		public lock = false,

		public active = true
	) {
		super();
		this.element.innerHTML = html as unknown as string;
		this.element.classList.add('wimage');
		document.body.append(this.element);

		this.populateElementsWithSelector(this.element, {
			$brightness: '.brightness',
			$colors: '.colors',
			$delete: '.delete',
			$drawColorsInOrder: '.draw-colors-in-order',
			$onlyAvailableColors: '.only-available-colors',
			$drawTransparent: '.draw-transparent',
			$export: '.export',
			$lock: '.lock',
			$settingsButton: '.settings',
			$popup: '.wform.popup',
			$closePopup: '.close-popup',
			$opacity: '.opacity',
			$progressLine: '.wprogress div',
			$progressText: '.wprogress span',
			$resetSize: '.reset-size',
			$resizeNumber: '.resize-number',
			$settings: '.wform',
			$strategy: '.strategy',
			$topbar: '.wtopbar',
			$wrapper: '.wrapper',
		});
		this.$resetSizeSpan = this.$resetSize.querySelector<HTMLSpanElement>('span')!;
		this.$canvas = this.pixels.canvas;
		this.$wrapper.prepend(this.pixels.canvas);
		document.body.appendChild(this.$popup);

		const header = this.$popup.querySelector('.popup-header')!;
		let isDragging = false;
		let offsetX = 0;
		let offsetY = 0;

		header.addEventListener('mousedown', (e: MouseEvent) => {
			isDragging = true;
			const rect = this.$popup.getBoundingClientRect();
			offsetX = e.clientX - rect.left;
			offsetY = e.clientY - rect.top;
		});

		document.addEventListener('mousemove', (e: MouseEvent) => {
			if (!isDragging) return;
			this.$popup.style.top = `${e.clientY - offsetY}px`;
			this.$popup.style.left = `${e.clientX - offsetX}px`;
			this.$popup.style.transform = 'none';
		});

		document.addEventListener('mouseup', () => {
			isDragging = false;
		});

        let resizeDir: string | null = null;
let startX = 0;
let startY = 0;
let startW = 0;
let startH = 0;
let startTop = 0;
let startLeft = 0;

for (const el of this.$popup.querySelectorAll<HTMLDivElement>('.popup-resize')) {
	el.addEventListener('mousedown', (e) => {
		e.preventDefault();
		resizeDir = el.classList[1];

		const rect = this.$popup.getBoundingClientRect();

		startX = e.clientX;
		startY = e.clientY;
		startW = rect.width;
		startH = rect.height;
		startTop = rect.top;
		startLeft = rect.left;

		document.body.style.userSelect = 'none';
	});
}

document.addEventListener('mousemove', (e) => {
	if (!resizeDir) return;

	let dx = e.clientX - startX;
	let dy = e.clientY - startY;

	let newW = startW;
	let newH = startH;
	let newTop = startTop;
	let newLeft = startLeft;

	if (resizeDir.includes('e')) newW = startW + dx;
	if (resizeDir.includes('s')) newH = startH + dy;

	if (resizeDir.includes('w')) {
		newW = startW - dx;
		newLeft = startLeft + dx;
	}

	if (resizeDir.includes('n')) {
		newH = startH - dy;
		newTop = startTop + dy;
	}

	this.$popup.style.width = `${Math.max(200, newW)}px`;
	this.$popup.style.height = `${Math.max(150, newH)}px`;
	this.$popup.style.top = `${newTop}px`;
	this.$popup.style.left = `${newLeft}px`;
	this.$popup.style.transform = 'none';
});

document.addEventListener('mouseup', () => {
	resizeDir = null;
	document.body.style.userSelect = '';
});

		// Close button
		const closeBtn = this.$popup.querySelector('.close-popup')!;
		closeBtn.addEventListener('click', () => {
			this.$popup.classList.remove('show');
		});

		// Strategy
		this.registerEvent(this.$strategy, 'change', () => {
			this.strategy = this.$strategy.value as ImageStrategy;
			save(this.bot);
		});

		// Opacity
		this.registerEvent(this.$opacity, 'input', () => {
			this.opacity = this.$opacity.valueAsNumber;
			this.$opacity.style.setProperty('--val', this.opacity + '%');
			this.update();
			save(this.bot);
		});
		this.$opacity.style.setProperty('--val', this.opacity + '%');

		// Brightness
		let timeout: ReturnType<typeof setTimeout> | undefined;

		this.registerEvent(this.$brightness, 'change', () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				this.pixels.brightness = this.$brightness.valueAsNumber;
				this.pixels.update();
				this.updateColors();
				this.update();
				save(this.bot);
			}, 1000);
		});

		// Reset
		this.registerEvent(this.$resetSize, 'click', () => {
			this.pixels.width = this.pixels.image.naturalWidth;
			this.pixels.update();
			this.updateColors();
			this.update();
			save(this.bot);
		});

		this.registerEvent(this.$resizeNumber, 'change', () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				const newSize = Number(this.$resizeNumber.value);
				if (newSize > 0) {
					this.pixels.width = newSize;
					this.pixels.update();
					this.updateColors();
					this.update();
					save(this.bot);
				}
			}, 1000);
		});

		// drawTransparent
		this.registerEvent(this.$drawTransparent, 'click', () => {
			this.drawTransparentPixels = this.$drawTransparent.checked;
			save(this.bot);
		});

		// drawColorsInOrder
		this.registerEvent(this.$drawColorsInOrder, 'click', () => {
			this.drawColorsInOrder = this.$drawColorsInOrder.checked;
			save(this.bot);
		});

		this.registerEvent(this.$onlyAvailableColors, 'click', () => {
			this.pixels.onlyAvailableColors = this.$onlyAvailableColors.checked;
			this.pixels.update();
			this.updateColors();
			this.update();
			save(this.bot);
		});

		// Lock
		this.registerEvent(this.$lock, 'click', () => {
			this.lock = !this.lock;
			this.update();
			save(this.bot);
		});

		// Settings
		this.registerEvent(this.$settingsButton, 'click', () => {
			this.$popup.classList.add('show');
		});

		this.registerEvent(this.$closePopup, 'click', () => {
			this.$popup.classList.remove('show');
		});

		this.registerEvent(this.$delete, 'click', this.destroy.bind(this));

		// Export
		this.registerEvent(this.$export, 'click', this.export.bind(this));

		// Move
		this.registerEvent(this.$topbar, 'mousedown', this.moveStart.bind(this));
		this.registerEvent(this.$canvas, 'mousedown', this.moveStart.bind(this));
		this.registerEvent(
			document,
			'mouseup',
			function (e) {
				this.moveStop(e);
			}.bind(this)
		);
		this.registerEvent(document, 'mousemove', this.move.bind(this));

		// Resize
		for (const $resize of this.element.querySelectorAll<HTMLDivElement>('.resize'))
			this.registerEvent($resize, 'mousedown', this.resizeStart.bind(this));
		this.update();
		this.updateColors();
	}

	public toJSON() {
		return {
			pixels: this.pixels.toJSON(),
			position: this.position.toJSON(),
			strategy: this.strategy,
			opacity: this.opacity,
			drawTransparentPixels: this.drawTransparentPixels,
			drawColorsInOrder: this.drawColorsInOrder,
			colors: this.colors,
			lock: this.lock,
			active: this.active,
		};
	}

	/** Calculates everything we need to do. Very expensive task! */
	public updateTasks() {
		this.tasks.length = 0;
		this.progress.length = 0;

		const position = this.position.clone();

		const skipColors = new Set<number>();
		const colorsOrderMap = new Map<number, number>();

		for (let index = 0; index < this.colors.length; index++) {
			const drawColor = this.colors[index]!;
			if (drawColor.disabled) skipColors.add(drawColor.realColor);
			colorsOrderMap.set(drawColor.realColor, index);
		}

		for (const { x, y } of this.strategyPositionIterator()) {
			const color = this.pixels.pixels[y]![x]!;

			position.globalX = this.position.globalX + x;
			position.globalY = this.position.globalY + y;

			const mapColor = position.getMapColor();

			if (color !== mapColor && (this.drawTransparentPixels || color !== 0)) {
				const fullTask: DrawTask = {
					position: position.clone(),
					color,
				};

				this.progress.push(fullTask);

				if (!skipColors.has(color) && !this.bot.unavailableColors.has(color)) {
					this.tasks.push(fullTask);
				}
			}
		}

		if (this.drawColorsInOrder) {
			this.tasks.sort((a, b) => (colorsOrderMap.get(a.color) ?? 0) - (colorsOrderMap.get(b.color) ?? 0));
		}

		this.update();
		this.bot.widget.update();
	}

	/** Update image (NOT PIXELS) */
	public update() {
		const { x, y } = this.position.toScreenPosition();
		this.element.style.transform = `translate(${x}px, ${y}px)`;
		this.element.style.width = `${this.position.pixelSize * this.pixels.width}px`;
		this.$canvas.style.opacity = `${this.opacity}%`;
		this.element.classList.remove('hidden');

		this.$resetSizeSpan.textContent = this.pixels.width.toString();
		this.$brightness.valueAsNumber = this.pixels.brightness;
		this.$strategy.value = this.strategy;
		this.$opacity.valueAsNumber = this.opacity;
		this.$drawTransparent.checked = this.drawTransparentPixels;
		this.$drawColorsInOrder.checked = this.drawColorsInOrder;
		this.$onlyAvailableColors.checked = this.pixels.onlyAvailableColors;
		const maxTasks = this.pixels.pixels.length * this.pixels.pixels[0]!.length;
		const doneTasks = maxTasks - this.progress.length;
		const percent = ((doneTasks / maxTasks) * 100) | 0;
		this.$progressText.textContent = `${doneTasks}/${maxTasks} ${percent}% ETA: ${(this.tasks.length / 120) | 0}h`;
		this.$progressLine.style.transform = `scaleX(${percent}%)`;
		this.$wrapper.classList[this.lock ? 'add' : 'remove']('no-pointer-events');
		this.$lock.textContent = this.lock ? '🔒' : '🔓';

		if (!this.active) {
			this.$topbar.style.display = 'none';
			this.$wrapper.style.display = 'none';
			this.$canvas.style.display = 'none';
		} else {
			this.$topbar.style.display = '';
			this.$wrapper.style.display = '';
			this.$canvas.style.display = '';
		}
	}

	/** Removes image. Don't forget to remove from array inside widget. */
	public destroy() {
		super.destroy();
		this.element.remove();
		removeFromArray(this.bot.images, this);
		this.bot.widget.update();
		save(this.bot);
	}

	/** Update colors array */
	public updateColors() {
		this.$colors.innerHTML = '';

		const pixelsSum = this.pixels.pixels.length * this.pixels.pixels[0]!.length;

        console.log('this.colors', this.colors);
		if (
			this.colors.length !== this.pixels.colors.size ||
			this.colors.some((x) => !this.pixels.colors.has(x.realColor))
		) {
			this.colors = this.pixels.colors
				.values()
				.toArray()
				.sort((a, b) => b.amount - a.amount)
				.map((color) => ({
					realColor: color.realColor,
					disabled: false,
				}));
			save(this.bot);
		}

		// Add utility buttons container
		const $utilities = document.createElement('div');
		$utilities.style.display = 'flex';
		$utilities.style.gap = '8px';
		$utilities.style.padding = '8px';
		$utilities.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
		$utilities.style.flexWrap = 'wrap';
        $utilities.style.justifyContent = 'space-between';

		const createUtilButton = (label: string, onClick: () => void) => {
			const $btn = document.createElement('button');
			$btn.textContent = label;
			$btn.style.padding = '6px 12px';
			$btn.style.fontSize = '12px';
			$btn.style.cursor = 'pointer';
			$btn.style.border = '1px solid rgba(0,0,0,0.2)';
			$btn.style.borderRadius = '4px';
			$btn.style.background = 'rgba(0,0,0,0.05)';
			$btn.addEventListener('click', onClick);
			return $btn;
		};

		// Select first half
		$utilities.append(
			createUtilButton('First Half', () => {
				const mid = Math.ceil(this.colors.length / 2);
				this.colors.forEach((color, i) => {
					color.disabled = i >= mid ? true : undefined;
				});
				this.updateColors();
				save(this.bot);
			})
		);

		// Select second half
		$utilities.append(
			createUtilButton('Second Half', () => {
				const mid = Math.ceil(this.colors.length / 2);
				this.colors.forEach((color, i) => {
					color.disabled = i < mid ? true : undefined;
				});
				this.updateColors();
				save(this.bot);
			})
		);

		// Random selection
		$utilities.append(
			createUtilButton('Random', () => {
				this.colors.forEach((color) => {
					color.disabled = Math.random() > 0.5 ? true : undefined;
				});
				this.updateColors();
				save(this.bot);
			})
		);

		// Invert selection
		$utilities.append(
			createUtilButton('Invert', () => {
				this.colors.forEach((color) => {
					color.disabled = color.disabled ? undefined : true;
				});
				this.updateColors();
				save(this.bot);
			})
		);

		// Select all
		$utilities.append(
			createUtilButton('Select All', () => {
				this.colors.forEach((color) => {
					color.disabled = undefined;
				});
				this.updateColors();
				save(this.bot);
			})
		);

		// Deselect all
		$utilities.append(
			createUtilButton('Deselect All', () => {
				this.colors.forEach((color) => {
					color.disabled = true;
				});
				this.updateColors();
				save(this.bot);
			})
		);

		this.$colors.append($utilities);

		let dragIndex: number | null = null;
		let startY = 0;
		let startIndex = 0;
		const rowHeight = 20;

		for (let index = 0; index < this.colors.length; index++) {
			const drawColor = this.colors[index]!;
			const color = this.pixels.colors.get(drawColor.realColor)!;

			const $button = document.createElement('button');
			$button.style.display = 'flex';
			$button.style.alignItems = 'center';

			const percent = (color.amount / pixelsSum) * 100;
			const pixels = color.amount;

			if (color.realColor === color.color) {
				$button.style.background = colorToCSS(color.realColor);

				const css = colorToCSS(color.realColor);
				const l = parseFloat(css.match(/oklab\((\d+\.?\d*)/)?.[1] ?? '100');
				if (l < 50) $button.classList.add('color-dark');
			}

			$button.setAttribute('data-color', String(drawColor.realColor));

			if (drawColor.disabled) $button.classList.add('color-disabled');

			const colorName = COLOR_NAMES[drawColor.realColor] ?? `Color ${drawColor.realColor}`;

			$button.setAttribute('title', colorName);

			const $drag = document.createElement('div');
			$drag.style.flex = '0 0 32px';
			$drag.style.display = 'flex';
			$drag.style.alignItems = 'center';
			$drag.style.justifyContent = 'flex-start';
			$drag.style.cursor = 'grab';
			$drag.innerHTML = `
<svg width="30" height="25" viewBox="0 0 24 24" fill="currentColor">
	<rect x="0" y="6" width="20" height="4" rx="1"/>
	<rect x="0" y="13" width="20" height="4" rx="1"/>
</svg>
`;

			const $content = document.createElement('div');
			$content.style.flex = '1';
			$content.style.display = 'flex';
			$content.style.justifyContent = 'flex-end';

			const info = document.createElement('span');
			info.textContent = `${percent.toFixed(2)}% (${pixels})`;

			$content.append(info);

			$content.addEventListener('click', () => {
				drawColor.disabled = drawColor.disabled ? undefined : true;
				$button.classList.toggle('color-disabled');
				save(this.bot);
			});

			$button.append($drag);
			$button.append($content);

			$drag.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				$drag.setPointerCapture(e.pointerId);

				const originalIndex = Array.from(this.$colors.children).indexOf($button);
				const startY = e.clientY;

				// Float the button in place
				const rect = $button.getBoundingClientRect();
				const containerRect = this.$colors.getBoundingClientRect();

				$button.style.position = 'fixed';
				$button.style.top = `${rect.top}px`;
				$button.style.width = `${rect.width}px`;
				$button.style.zIndex = '9999';
				$button.style.opacity = '0.85';
				$button.style.pointerEvents = 'none';

				// Placeholder to hold the space
				const $placeholder = document.createElement('div');
				$placeholder.style.height = `${rowHeight}px`;
				$placeholder.style.background = 'rgba(0,0,0,0.15)';
				$placeholder.style.boxSizing = 'border-box';
				$button.after($placeholder);

				let currentIndex = originalIndex;

				const onMove = (e: PointerEvent) => {
					const delta = e.clientY - startY;
					$button.style.top = `${rect.top + delta}px`;

					const buttons = Array.from(this.$colors.children).filter(
						(el) => el !== $button && el !== $placeholder
					) as HTMLElement[];

					let newIndex = buttons.findIndex((btn) => {
						const r = btn.getBoundingClientRect();
						return e.clientY < r.top + r.height / 2;
					});
					if (newIndex === -1) newIndex = buttons.length;

					if (newIndex !== currentIndex) {
						currentIndex = newIndex;
						if (newIndex >= buttons.length) {
							buttons[buttons.length - 1]?.after($placeholder);
						} else {
							buttons[newIndex]!.before($placeholder);
						}
					}
				};

				const onUp = () => {
					$button.removeEventListener('pointermove', onMove);

					// Reset styles
					$button.style.position = '';
					$button.style.top = '';
					$button.style.left = '';
					$button.style.width = '';
					$button.style.zIndex = '';
					$button.style.opacity = '';
					$button.style.pointerEvents = '';

					// Drop into placeholder position
					$placeholder.replaceWith($button);

					// Sync this.colors to match DOM order
					const newOrder = Array.from(this.$colors.children).filter((el) => el.hasAttribute('data-color')) as HTMLElement[];
					this.colors = newOrder.map((el) => {
						const realColor = el.getAttribute('data-color');

						return this.colors.find((c) => String(c.realColor) === realColor)!;
					});

					save(this.bot);
				};

				$button.addEventListener('pointermove', onMove);
				$button.addEventListener('pointerup', onUp, { once: true });
			});

			this.$colors.append($button);
		}
	}
	/** Create iterator that generates positions based on strategy */
	protected *strategyPositionIterator(): Generator<Position> {
		const width = this.pixels.pixels[0]!.length;
		const height = this.pixels.pixels.length;
		switch (this.strategy) {
			case ImageStrategy.DOWN: {
				for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) yield { x, y };
				break;
			}
			case ImageStrategy.UP: {
				for (let y = height - 1; y >= 0; y--) for (let x = 0; x < width; x++) yield { x, y };
				break;
			}
			case ImageStrategy.LEFT: {
				for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) yield { x, y };
				break;
			}
			case ImageStrategy.RIGHT: {
				for (let x = width - 1; x >= 0; x--) for (let y = 0; y < height; y++) yield { x, y };
				break;
			}
			case ImageStrategy.RANDOM: {
				const positions: Position[] = [];
				for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) positions.push({ x, y });
				for (let index = positions.length - 1; index >= 0; index--) {
					const index_ = Math.floor(Math.random() * (index + 1));
					const temporary = positions[index]!;
					positions[index] = positions[index_]!;
					positions[index_] = temporary;
				}
				yield* positions;
				break;
			}

			case ImageStrategy.SPIRAL_FROM_CENTER:
			case ImageStrategy.SPIRAL_TO_CENTER: {
				const visited = new Set<string>();
				const total = width * height;
				let x = Math.floor(width / 2);
				let y = Math.floor(height / 2);
				const directories = [
					[1, 0],
					[0, 1],
					[-1, 0],
					[0, -1],
				];
				let directionIndex = 0;
				let steps = 1;
				const inBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;
				const emit = function* () {
					let count = 0;
					while (count < total) {
						for (let twice = 0; twice < 2; twice++) {
							for (let index = 0; index < steps; index++) {
								if (inBounds(x, y)) {
									const key = `${x},${y}`;
									if (!visited.has(key)) {
										visited.add(key);
										yield { x, y };
										count++;
										if (count >= total) return;
									}
								}
								x += directories[directionIndex]![0]!;
								y += directories[directionIndex]![1]!;
							}
							directionIndex = (directionIndex + 1) % 4;
						}
						steps++;
					}
				};

				if (this.strategy === ImageStrategy.SPIRAL_FROM_CENTER) yield* emit();
				else {
					const collected = [...emit()];
					for (let index = collected.length - 1; index >= 0; index--) yield collected[index]!;
				}
				break;
			}
		}
	}

	protected moveStart(event: MouseEvent) {
		if (!this.lock)
			this.moveInfo = {
				globalX: this.position.globalX,
				globalY: this.position.globalY,
				clientX: event.clientX,
				clientY: event.clientY,
			};
	}

	protected async moveStop() {
		if (this.moveInfo) {
			this.moveInfo = undefined;
			this.position.updateAnchor();
			this.updateColors();
		}
	}

	/** Resize/move image */
	protected move(event: MouseEvent) {
		if (!this.moveInfo) return;
		const deltaX = Math.round((event.clientX - this.moveInfo.clientX) / this.position.pixelSize);
		const deltaY = Math.round((event.clientY - this.moveInfo.clientY) / this.position.pixelSize);
		if (this.moveInfo.globalX !== undefined) {
			this.position.globalX = deltaX + this.moveInfo.globalX;
			if (this.moveInfo.width !== undefined) this.pixels.width = Math.max(1, this.moveInfo.width - deltaX);
		} else if (this.moveInfo.width !== undefined) this.pixels.width = Math.max(1, deltaX + this.moveInfo.width);
		if (this.moveInfo.globalY !== undefined) {
			this.position.globalY = deltaY + this.moveInfo.globalY;
			if (this.moveInfo.height !== undefined) this.pixels.height = Math.max(1, this.moveInfo.height - deltaY);
		} else if (this.moveInfo.height !== undefined) this.pixels.height = Math.max(1, deltaY + this.moveInfo.height);
		this.update();
		save(this.bot);
	}

	/** Resize start */
	protected resizeStart(event: MouseEvent) {
		this.moveInfo = {
			clientX: event.clientX,
			clientY: event.clientY,
		};
		const $resize = event.target! as HTMLDivElement;
		if ($resize.classList.contains('n')) {
			this.moveInfo.height = this.pixels.height;
			this.moveInfo.globalY = this.position.globalY;
		}
		if ($resize.classList.contains('e')) this.moveInfo.width = this.pixels.width;
		if ($resize.classList.contains('s')) this.moveInfo.height = this.pixels.height;
		if ($resize.classList.contains('w')) {
			this.moveInfo.width = this.pixels.width;
			this.moveInfo.globalX = this.position.globalX;
		}
	}

	/** export image */
	protected export() {
		const a = document.createElement('a');
		document.body.append(a);
		a.href = URL.createObjectURL(new Blob([JSON.stringify(this.toJSON())], { type: 'application/json' }));
		a.download = `${this.pixels.width}x${this.pixels.height}.wbot`;
		a.click();
		URL.revokeObjectURL(a.href);
		a.href = this.pixels.canvas.toDataURL('image/webp', 1);
		a.download = `${this.pixels.width}x${this.pixels.height}.webp`;
		a.click();
		URL.revokeObjectURL(a.href);
		a.remove();
	}
}
