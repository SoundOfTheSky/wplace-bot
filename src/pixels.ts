import { promisifyEventSource } from '@softsky/utils';

import { WPlaceBot } from './bot';
import { COLORS, COLORS_RGB, deltaE2000, rgbToOklab } from './colors';

export type PixelColorStat = {
	color: number;
	amount: number;
	realColor: number;
};

type CachedPixelData = {
	pixels: number[][];
	colors: Record<number, PixelColorStat>;
	width: number;
	brightness: number;
	exactColor: boolean;
	timestamp: number;
};

type CacheKey = {
	imageHash: string;
	width: number;
	brightness: number;
	exactColor: boolean;
};

export class Pixels {
	private static db: IDBDatabase | null = null;
	private static readonly DB_NAME = 'PixelBotCache';
	private static readonly STORE_NAME = 'pixelData';
	private static readonly DB_VERSION = 1;

	/** Initialize IndexedDB once */
	private static async initDB(): Promise<IDBDatabase> {
		if (this.db) return this.db;

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					db.createObjectStore(this.STORE_NAME, { keyPath: 'cacheKey' });
				}
			};
		});
	}

	/** Generate a hash of the image data for cache key */
	private static async hashImage(image: HTMLImageElement): Promise<string> {
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(image, 0, 0);
		const dataURL = canvas.toDataURL();

		// Simple hash - in production you might use crypto.subtle.digest
		let hash = 0;
		for (let i = 0; i < dataURL.length; i++) {
			const char = dataURL.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return `img_${Math.abs(hash)}`;
	}

	/** Try to load from cache */
	private static async loadFromCache(key: CacheKey): Promise<CachedPixelData | null> {
		try {
			const db = await this.initDB();
			return new Promise((resolve, reject) => {
				const transaction = db.transaction([this.STORE_NAME], 'readonly');
				const store = transaction.objectStore(this.STORE_NAME);
				const request = store.get(JSON.stringify(key));

				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result || null);
			});
		} catch {
			console.warn('Failed to load from IndexedDB cache, will recompute');
			return null;
		}
	}

	/** Save to cache */
	private static async saveToCache(key: CacheKey, data: CachedPixelData): Promise<void> {
		try {
			const db = await this.initDB();
			return new Promise((resolve, reject) => {
				const transaction = db.transaction([this.STORE_NAME], 'readwrite');
				const store = transaction.objectStore(this.STORE_NAME);
				const request = store.put({
					cacheKey: JSON.stringify(key),
					...data,
				});

				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		} catch (error) {
			console.warn('Failed to save to IndexedDB cache:', error);
			// Continue anyway - cache is optional
		}
	}

	public static async fromJSON(
		bot: WPlaceBot,
		data: ReturnType<Pixels['toJSON']>,
		options?: { skipCache?: boolean }
	) {
		const skipCache = options?.skipCache ?? false;
		const image = new Image();
		image.src = data.url.startsWith('http')
			? await fetch(data.url, { cache: 'no-store' })
					.then((x) => x.blob())
					.then((X) => URL.createObjectURL(X))
			: data.url;
		await promisifyEventSource(image, ['load'], ['error']);
		let pixels = new Pixels(bot, image, data.width, data.brightness, data.exactColor);
		await pixels.update(skipCache);

		return pixels;
	}

	private _cachedDataURL?: string;

	public canvas = document.createElement('canvas');

	public context = this.canvas.getContext('2d')!;

	/** Pixels of image. Use update() after changing variables */
	public pixels!: number[][];

	/** Used colors */
	public readonly colors = new Map<number, PixelColorStat>();

	public readonly resolution: number;

	public get height() {
		return (this.width / this.resolution) | 0;
	}
	public set height(value: number) {
		this.width = (value * this.resolution) | 0;
	}

	public constructor(
		public bot: WPlaceBot,
		/** Image element */
		public image: HTMLImageElement,
		/** Change scale of image pixels */
		public width = image.naturalWidth,
		/** Change brightness of picture */
		public brightness = 0,
		/** Use fast exact color algorithm */
		public exactColor = false
	) {
		if (exactColor) {
			this.resolution = 1;
			this.width = 1000;
		} else {
			this.resolution = this.image.naturalWidth / this.image.naturalHeight;
		}
	}

	static async create(
		bot: WPlaceBot,
		image: HTMLImageElement,
		width = image.naturalWidth,
		brightness = 0,
		exactColor = false
	) {
		const instance = new Pixels(bot, image, width, brightness, exactColor);
		await instance.update();
		return instance;
	}

	/** Update pixels of image. Checks cache first, then computes if needed. */
	public async update(skipCache = false) {
		let cacheKey;

		if (!skipCache) {
			// Try to load from cache first
			const imageHash = await Pixels.hashImage(this.image);
			cacheKey = {
				imageHash,
				width: this.width,
				brightness: this.brightness,
				exactColor: this.exactColor,
			};

			const cached = await Pixels.loadFromCache(cacheKey);
			if (cached) {
				this.pixels = cached.pixels;
				this.colors.clear();
				for (const [key, value] of Object.entries(cached.colors)) {
					this.colors.set(Number(key), value);
				}
				this.drawCachedPixels();
				return;
			}
		}

		// If not cached, compute as before
		await this.computePixels();

		if (!skipCache) {
			// Save to cache for next time
			const dataToCache: CachedPixelData = {
				pixels: this.pixels,
				colors: Object.fromEntries(this.colors),
				width: this.width,
				brightness: this.brightness,
				exactColor: this.exactColor,
				timestamp: Date.now(),
			};
			await Pixels.saveToCache(cacheKey, dataToCache);
		}
	}

	/** Draw pixels that were loaded from cache */
	private drawCachedPixels() {
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.context.imageSmoothingEnabled = false;
		this.context.imageSmoothingQuality = 'low';

		for (let y = 0; y < this.pixels.length; y++) {
			for (let x = 0; x < this.pixels[y]!.length; x++) {
				const colorIndex = this.pixels[y]![x]!;
				if (colorIndex !== 0) {
					this.context.fillStyle = `oklab(${COLORS[colorIndex]![0] * 100}% ${COLORS[colorIndex]![1]} ${COLORS[colorIndex]![2]})`;
					this.context.fillRect(x, y, 1, 1);
				}
			}
		}
	}

	/** Compute pixels (original heavy operation) */
	private async computePixels(batchSize = 1000) {
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.colors.clear();
		const colorCache = new Map<string, [number, number]>();
		for (let index = 1; index < 64; index++) {
			if (this.exactColor) colorCache.set(COLORS_RGB[index]!, [index, index]);
		}

		this.context.imageSmoothingEnabled = false;
		this.context.imageSmoothingQuality = 'low';
		this.context.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);

		this.pixels = Array.from({ length: this.canvas.height }, () => new Array(this.canvas.width) as number[]);
		const data = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

		const totalPixels = this.canvas.width * this.canvas.height;
		for (let start = 0; start < totalPixels; start += batchSize) {
			const end = Math.min(start + batchSize, totalPixels);
			for (let i = start; i < end; i++) {
				const y = Math.floor(i / this.canvas.width);
				const x = i % this.canvas.width;
				const index = i * 4;
				const r = Math.round(data[index]);
				const g = Math.round(data[index + 1]);
				const b = Math.round(data[index + 2]);
				const a = Math.round(data[index + 3]);

				const key = `${r},${g},${b}`;
				let min!: number;
				let minReal!: number;

				if (this.exactColor) {
					this.pixels[y]![x] = a < 100 ? 0 : COLORS_RGB.indexOf(key);
					continue;
				}

				if (a < 100) min = minReal = 0;
				else if (colorCache.has(key)) [min, minReal] = colorCache.get(key)!;
				else {
					let minDelta = Infinity;
					let minDeltaReal = Infinity;
					for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex++) {
						const color = COLORS[colorIndex]!;
						const delta = deltaE2000(rgbToOklab(r, g, b), color, this.brightness);
						if (delta < minDelta) {
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
					this.context.fillStyle = `oklab(${COLORS[min]![0] * 100}% ${COLORS[min]![1]} ${COLORS[min]![2]})`;
					this.context.fillRect(x, y, 1, 1);
				}

				this.pixels[y]![x] = min;

				const stat = this.colors.get(minReal);
				if (stat) stat.amount++;
				else this.colors.set(minReal, { color: min, amount: 1, realColor: minReal });
			}
			const percent = Math.floor((end / totalPixels) * 100);
			this.bot.widget.status = `Computing pixels: ${percent}%`;

			await new Promise((r) => setTimeout(r, 0)); // yield to browser
		}
	}

	public toJSON() {
		if (!this._cachedDataURL) {
			const canvas = document.createElement('canvas');
			canvas.width = this.image.naturalWidth;
			canvas.height = this.image.naturalHeight;

			const context = canvas.getContext('2d')!;
			context.drawImage(this.image, 0, 0);

			this._cachedDataURL = canvas.toDataURL('image/webp', 1);
		}

		return {
			url: this._cachedDataURL,
			width: this.width,
			brightness: this.brightness,
			exactColor: this.exactColor,
		} as {
			url: string;
			width?: number;
			brightness?: number;
			exactColor?: boolean;
		};
	}

	/** Clear all cached pixel data from IndexedDB */
	public static async clearCache(): Promise<void> {
		try {
			const db = await Pixels.initDB();
			return new Promise((resolve, reject) => {
				const transaction = db.transaction([this.STORE_NAME], 'readwrite');
				const store = transaction.objectStore(this.STORE_NAME);
				const request = store.clear();

				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		} catch (error) {
			console.warn('Failed to clear cache:', error);
		}
	}
}
