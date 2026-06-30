import { Mat4, Vec2, Vec3, Vec4 } from "gl-matrix";
import { Application } from "@pixi/app";
import { Texture } from "@pixi/core";
import { Container } from "@pixi/display";
import { BlurFilter } from "@pixi/filter-blur";
import { BulgePinchFilter } from "@pixi/filter-bulge-pinch";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { Sprite } from "@pixi/sprite";
import structuredClone from "@ungap/structured-clone";
import bezier from "bezier-easing";
//#region src/bg-render/base.ts
var AbstractBaseRenderer = class {};
function clamp1(x) {
	return Math.max(1, x);
}
var BaseRenderer = class extends AbstractBaseRenderer {
	observer;
	flowSpeed = 1;
	currerntRenderScale = .75;
	constructor(canvas) {
		super();
		this.canvas = canvas;
		this.observer = new ResizeObserver(() => {
			const width = clamp1(canvas.clientWidth * window.devicePixelRatio * this.currerntRenderScale);
			const height = clamp1(canvas.clientHeight * window.devicePixelRatio * this.currerntRenderScale);
			this.onResize(width, height);
		});
		this.observer.observe(canvas);
	}
	setRenderScale(scale) {
		this.currerntRenderScale = scale;
		this.onResize(this.canvas.clientWidth * window.devicePixelRatio * this.currerntRenderScale, this.canvas.clientHeight * window.devicePixelRatio * this.currerntRenderScale);
	}
	/**
	* 当画板元素大小发生变化时此函数会被调用
	* 可以在此处重设和渲染器相关的尺寸设置
	* 考虑到初始化的时候元素不一定在文档中或出于某些特殊样式状态，尺寸长宽有可能会为 0，请注意进行特判处理
	* @param width 画板元素实际的物理像素宽度，有可能为 0
	* @param height 画板元素实际的物理像素高度，有可能为 0
	*/
	onResize(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
	}
	/**
	* 修改背景的流动速度，数字越大越快，默认为 1
	* @param speed 背景的流动速度，默认为 1
	*/
	setFlowSpeed(speed) {
		this.flowSpeed = speed;
	}
	dispose() {
		this.observer.disconnect();
		this.canvas.remove();
	}
	getElement() {
		return this.canvas;
	}
};
//#endregion
//#region src/utils/resource.ts
function loadImage(imageUrl) {
	return new Promise((resolve, reject) => {
		const img = document.createElement("img");
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = imageUrl;
		img.crossOrigin = "anonymous";
		img.loading = "eager";
	});
}
function loadVideo(videoUrl) {
	return new Promise((resolve, reject) => {
		const video = document.createElement("video");
		let playing = false;
		let timeupdate = false;
		let rejected = false;
		video.addEventListener("playing", () => {
			playing = true;
			checkReady();
		}, true);
		video.addEventListener("timeupdate", () => {
			timeupdate = true;
			checkReady();
		}, true);
		video.addEventListener("error", (err) => {
			rejected = true;
			reject(err);
		}, true);
		function checkReady() {
			if (playing && timeupdate && !rejected) resolve(video);
		}
		video.src = videoUrl;
		video.playsInline = true;
		video.crossOrigin = "anonymous";
		video.autoplay = true;
		video.loop = true;
		video.muted = true;
		video.play();
	});
}
function loadResourceFromUrl(url, isVideo = false) {
	return isVideo ? loadVideo(url) : loadImage(url);
}
function loadResourceFromElement(element) {
	return new Promise((resolve, reject) => {
		if (element instanceof HTMLImageElement ? element.complete : element.readyState >= 3) resolve(element);
		else {
			element.onload = () => resolve(element);
			element.onerror = reject;
		}
	});
}
//#endregion
//#region src/bg-render/img.ts
function blurImage(imageData, radius, quality) {
	const pixels = imageData.data;
	const width = imageData.width;
	const height = imageData.height;
	let rsum;
	let gsum;
	let bsum;
	let asum;
	let x;
	let y;
	let i;
	let p;
	let p1;
	let p2;
	let yp;
	let yi;
	let yw;
	const wm = width - 1;
	const hm = height - 1;
	const rad1x = radius + 1;
	const divx = radius + rad1x;
	const rad1y = radius + 1;
	const div2 = 1 / (divx * (radius + rad1y));
	const r = [];
	const g = [];
	const b = [];
	const a = [];
	const vmin = [];
	const vmax = [];
	while (quality-- > 0) {
		yw = yi = 0;
		for (y = 0; y < height; y++) {
			rsum = pixels[yw] * rad1x;
			gsum = pixels[yw + 1] * rad1x;
			bsum = pixels[yw + 2] * rad1x;
			asum = pixels[yw + 3] * rad1x;
			for (i = 1; i <= radius; i++) {
				p = yw + ((i > wm ? wm : i) << 2);
				rsum += pixels[p++];
				gsum += pixels[p++];
				bsum += pixels[p++];
				asum += pixels[p];
			}
			for (x = 0; x < width; x++) {
				r[yi] = rsum;
				g[yi] = gsum;
				b[yi] = bsum;
				a[yi] = asum;
				if (y === 0) {
					vmin[x] = Math.min(x + rad1x, wm) << 2;
					vmax[x] = Math.max(x - radius, 0) << 2;
				}
				p1 = yw + vmin[x];
				p2 = yw + vmax[x];
				rsum += pixels[p1++] - pixels[p2++];
				gsum += pixels[p1++] - pixels[p2++];
				bsum += pixels[p1++] - pixels[p2++];
				asum += pixels[p1] - pixels[p2];
				yi++;
			}
			yw += width << 2;
		}
		for (x = 0; x < width; x++) {
			yp = x;
			rsum = r[yp] * rad1y;
			gsum = g[yp] * rad1y;
			bsum = b[yp] * rad1y;
			asum = a[yp] * rad1y;
			for (i = 1; i <= radius; i++) {
				yp += i > hm ? 0 : width;
				rsum += r[yp];
				gsum += g[yp];
				bsum += b[yp];
				asum += a[yp];
			}
			yi = x << 2;
			for (y = 0; y < height; y++) {
				pixels[yi] = rsum * div2 + .5 | 0;
				pixels[yi + 1] = gsum * div2 + .5 | 0;
				pixels[yi + 2] = bsum * div2 + .5 | 0;
				pixels[yi + 3] = asum * div2 + .5 | 0;
				if (x === 0) {
					vmin[y] = Math.min(y + rad1y, hm) * width;
					vmax[y] = Math.max(y - radius, 0) * width;
				}
				p1 = x + vmin[y];
				p2 = x + vmax[y];
				rsum += r[p1] - r[p2];
				gsum += g[p1] - g[p2];
				bsum += b[p1] - b[p2];
				asum += a[p1] - a[p2];
				yi += width << 2;
			}
		}
	}
}
//#endregion
//#region src/utils/clamp.ts
function clamp(x, min, max) {
	return Math.min(Math.max(x, min), max);
}
function clamp01(x) {
	return clamp(x, 0, 1);
}
function clampPositive(x) {
	return Math.max(0, x);
}
//#endregion
//#region src/bg-render/mesh-renderer/cp-presets.ts
/** @internal */
const p = (cx, cy, x, y, ur = 0, vr = 0, up = 1, vp = 1) => Object.freeze({
	cx,
	cy,
	x,
	y,
	ur,
	vr,
	up,
	vp
});
/** @internal */
const preset = (width, height, conf) => Object.freeze({
	width,
	height,
	conf
});
const CONTROL_POINT_PRESETS = [
	preset(5, 5, [
		p(0, 0, -1, -1, 0, 0, 1, 1),
		p(1, 0, -.5, -1, 0, 0, 1, 1),
		p(2, 0, 0, -1, 0, 0, 1, 1),
		p(3, 0, .5, -1, 0, 0, 1, 1),
		p(4, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -.5, 0, 0, 1, 1),
		p(1, 1, -.5, -.5, 0, 0, 1, 1),
		p(2, 1, -.0052029684413368305, -.6131420587090777, 0, 0, 1, 1),
		p(3, 1, .5884227308309977, -.3990805107556692, 0, 0, 1, 1),
		p(4, 1, 1, -.5, 0, 0, 1, 1),
		p(0, 2, -1, 0, 0, 0, 1, 1),
		p(1, 2, -.4210024670505933, -.11895058380429502, 0, 0, 1, 1),
		p(2, 2, -.1019613423315412, -.023812118047224606, 0, -47, .629, .849),
		p(3, 2, .40275125660925437, -.06345314544600389, 0, 0, 1, 1),
		p(4, 2, 1, 0, 0, 0, 1, 1),
		p(0, 3, -1, .5, 0, 0, 1, 1),
		p(1, 3, .06801958477287173, .5205913248960121, -31, -45, 1, 1),
		p(2, 3, .21446469120128908, .29331610114301043, 6, -56, .566, 1.321),
		p(3, 3, .5, .5, 0, 0, 1, 1),
		p(4, 3, 1, .5, 0, 0, 1, 1),
		p(0, 4, -1, 1, 0, 0, 1, 1),
		p(1, 4, -.31378372841550195, 1, 0, 0, 1, 1),
		p(2, 4, .26153633255328046, 1, 0, 0, 1, 1),
		p(3, 4, .5, 1, 0, 0, 1, 1),
		p(4, 4, 1, 1, 0, 0, 1, 1)
	]),
	preset(4, 4, [
		p(0, 0, -1, -1, 0, 0, 1, 1),
		p(1, 0, -.33333333333333337, -1, 0, 0, 1, 1),
		p(2, 0, .33333333333333326, -1, 0, 0, 1, 1),
		p(3, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -.04495399932657351, 0, 0, 1, 1),
		p(1, 1, -.24056117520129328, -.22465999020104, 0, 0, 1, 1),
		p(2, 1, .334758885767489, -.00531297192779423, 0, 0, 1, 1),
		p(3, 1, .9989920470678106, -.3382976020775408, 8, 0, .566, 1.792),
		p(0, 2, -1, .33333333333333326, 0, 0, 1, 1),
		p(1, 2, -.3425497314639411, -27501607956947893e-21, 0, 0, 1, 1),
		p(2, 2, .3321437945812673, .1981776353859399, 0, 0, 1, 1),
		p(3, 2, 1, .0766118180296832, 0, 0, 1, 1),
		p(0, 3, -1, 1, 0, 0, 1, 1),
		p(1, 3, -.33333333333333337, 1, 0, 0, 1, 1),
		p(2, 3, .33333333333333326, 1, 0, 0, 1, 1),
		p(3, 3, 1, 1, 0, 0, 1, 1)
	]),
	preset(4, 4, [
		p(0, 0, -1, -1, 0, 0, 1, 2.075),
		p(1, 0, -.33333333333333337, -1, 0, 0, 1, 1),
		p(2, 0, .33333333333333326, -1, 0, 0, 1, 1),
		p(3, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -.4545779491139603, 0, 0, 1, 1),
		p(1, 1, -.33333333333333337, -.33333333333333337, 0, 0, 1, 1),
		p(2, 1, .0889403142626457, -.6025711180694033, -32, 45, 1, 1),
		p(3, 1, 1, -.33333333333333337, 0, 0, 1, 1),
		p(0, 2, -1, -.07402408608567845, 1, 0, 1, .094),
		p(1, 2, -.2719422694359541, .09775369930903222, 25, -18, 1.321, 0),
		p(2, 2, .19877414408395877, .4307383294587789, 48, -40, .755, .975),
		p(3, 2, 1, .33333333333333326, -37, 0, 1, 1),
		p(0, 3, -1, 1, 0, 0, 1, 1),
		p(1, 3, -.33333333333333337, 1, 0, 0, 1, 1),
		p(2, 3, .5125850864305672, 1, -20, -18, 0, 1.604),
		p(3, 3, 1, 1, 0, 0, 1, 1)
	]),
	preset(5, 5, [
		p(0, 0, -1, -1, 0, 0, 1, 1),
		p(1, 0, -.4501953125, -1, 0, 55, 1, 2.075),
		p(2, 0, .1953125, -1, 0, 0, 1, 1),
		p(3, 0, .4580078125, -1, 0, -25, 1, 1),
		p(4, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -.2514475377525607, -16, 0, 2.327, .943),
		p(1, 1, -.55859375, -.6609325945787148, 47, 0, 2.358, .377),
		p(2, 1, .232421875, -.5244375756366635, -66, -25, 1.855, 1.164),
		p(3, 1, .685546875, -.3753706470552125, 0, 0, 1, 1),
		p(4, 1, 1, -.6699125300354287, 0, 0, 1, 1),
		p(0, 2, -1, .035910396862284255, 0, 0, 1, 1),
		p(1, 2, -.4921875, .005378616309457018, 90, 23, 1, 1.981),
		p(2, 2, .021484375, -.1365043639066228, 0, 42, 1, 1),
		p(3, 2, .4765625, .05925822904974043, -30, 0, 1.95, .44),
		p(4, 2, 1, .251428847823418, 0, 0, 1, 1),
		p(0, 3, -1, .6968336464764276, -68, 0, 1, .786),
		p(1, 3, -.6904296875, .5890744209958608, -68, 0, 1, 1),
		p(2, 3, .1845703125, .3879238667654693, 61, 0, 1, 1),
		p(3, 3, .60546875, .4633553246018661, -47, -59, .849, 1.73),
		p(4, 3, 1, .6214021886400309, -33, 0, .377, 1.604),
		p(0, 4, -1, 1, 0, 0, 1, 1),
		p(1, 4, -.5, 1, 0, -73, 1, 1),
		p(2, 4, -.3271484375, 1, 0, -24, .314, 2.704),
		p(3, 4, .5, 1, 0, 0, 1, 1),
		p(4, 4, 1, 1, 0, 0, 1, 1)
	]),
	preset(5, 5, [
		p(0, 0, -1, -1),
		p(1, 0, -.6393, -1, 0, 0, 1, 2.3884),
		p(2, 0, 0, -1),
		p(3, 0, .5, -1),
		p(4, 0, 1, -1),
		p(0, 1, -1, -.2301),
		p(1, 1, -.6934, -.331, 0, -.7188, 1, 1.063),
		p(2, 1, -.0082, -.6814, -.2583, 0, 1.0964, 1),
		p(3, 1, .5836, -.531, .7029, 0, 1.5466, 1),
		p(4, 1, 1, -.6407),
		p(0, 2, -1, .2973, 0, 0, 1.8352, 1),
		p(1, 2, -.4082, .0602),
		p(2, 2, -.1803, -.3646, -.2998, 0, 1.1513, 1),
		p(3, 2, .477, -.1027, .8903, -.1882, 1.0807, .8551),
		p(4, 2, 1, -.2973),
		p(0, 3, -1, .7628, 0, 0, 2.3868, 1),
		p(1, 3, -.2525, .4814, -.8406, -1.6199, 1.4093, 1.2215),
		p(2, 3, .3607, .2814, -1.0713, -.0529, 1.0025, .7611),
		p(3, 3, .4885, .623, 0, .8184, 1, 1.2876),
		p(4, 3, 1, .5),
		p(0, 4, -1, 1),
		p(1, 4, -.4033, 1),
		p(2, 4, .2672, 1),
		p(3, 4, .5967, 1),
		p(4, 4, 1, 1)
	]),
	preset(5, 5, [
		p(0, 0, -1, -1),
		p(1, 0, -.2197, -1),
		p(2, 0, .0197, -1),
		p(3, 0, .8033, -1),
		p(4, 0, 1, -1),
		p(0, 1, -1, -.5451),
		p(1, 1, -.4885, -.4035, -1.0246, -.2268, 1.1936, .8005),
		p(2, 1, -.1213, -.2867, 0, -.6981, 1, .809),
		p(3, 1, .3246, -.5628, 0, -1.2188, 1, 1.044),
		p(4, 1, 1, -.3292),
		p(0, 2, -1, .1416),
		p(1, 2, -.341, -.0142, 0, -.4004, 1, 1.1293),
		p(2, 2, -.0393, -.023, .2915, -.373, 1.044, .9879),
		p(3, 2, .3148, -.0673, -.7853, -.8962, 1.4709, 1.0247),
		p(4, 2, 1, .1912),
		p(0, 3, -1, .5),
		p(1, 3, -.2689, .2743, .3404, -.5248, 1.0184, .4391),
		p(2, 3, .0721, .269, .5302, .1244, .6723, .3225),
		p(3, 3, .4148, .3894, -.6977, -.6783, .8094, .9247),
		p(4, 3, 1, .446),
		p(0, 4, -1, 1),
		p(1, 4, -.7311, 1),
		p(2, 4, .323, 1),
		p(3, 4, .6393, 1),
		p(4, 4, 1, 1)
	])
];
//#endregion
//#region src/bg-render/mesh-renderer/cp-generate.ts
/**
* @fileoverview
* 实验性的随机控制点生成函数算法
* 目的是取代原先大量的预设控制点代码
*/
const randomRange = (min, max) => Math.random() * (max - min) + min;
function smoothstep(edge0, edge1, x) {
	const t = clamp01((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}
function smoothifyControlPoints(conf, w, h, iterations = 2, factor = .5, factorIterationModifier = .1) {
	let grid = [];
	let f = factor;
	for (let j = 0; j < h; j++) {
		grid[j] = [];
		for (let i = 0; i < w; i++) grid[j][i] = conf[j * w + i];
	}
	const kernel = [
		[
			1,
			2,
			1
		],
		[
			2,
			4,
			2
		],
		[
			1,
			2,
			1
		]
	];
	const kernelSum = 16;
	for (let iter = 0; iter < iterations; iter++) {
		const newGrid = [];
		for (let j = 0; j < h; j++) {
			newGrid[j] = [];
			for (let i = 0; i < w; i++) {
				if (i === 0 || i === w - 1 || j === 0 || j === h - 1) {
					newGrid[j][i] = grid[j][i];
					continue;
				}
				let sumX = 0;
				let sumY = 0;
				let sumUR = 0;
				let sumVR = 0;
				let sumUP = 0;
				let sumVP = 0;
				for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
					const weight = kernel[dj + 1][di + 1];
					const nb = grid[j + dj][i + di];
					sumX += nb.x * weight;
					sumY += nb.y * weight;
					sumUR += nb.ur * weight;
					sumVR += nb.vr * weight;
					sumUP += nb.up * weight;
					sumVP += nb.vp * weight;
				}
				const avgX = sumX / kernelSum;
				const avgY = sumY / kernelSum;
				const avgUR = sumUR / kernelSum;
				const avgVR = sumVR / kernelSum;
				const avgUP = sumUP / kernelSum;
				const avgVP = sumVP / kernelSum;
				const cur = grid[j][i];
				const newX = cur.x * (1 - f) + avgX * f;
				const newY = cur.y * (1 - f) + avgY * f;
				const newUR = cur.ur * (1 - f) + avgUR * f;
				const newVR = cur.vr * (1 - f) + avgVR * f;
				const newUP = cur.up * (1 - f) + avgUP * f;
				const newVP = cur.vp * (1 - f) + avgVP * f;
				newGrid[j][i] = p(i, j, newX, newY, newUR, newVR, newUP, newVP);
			}
		}
		grid = newGrid;
		f = clamp01(f + factorIterationModifier);
	}
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) conf[j * w + i] = grid[j][i];
}
function noise(x, y) {
	return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
}
function fract(x) {
	return x - Math.floor(x);
}
function smoothNoise(x, y) {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = x0 + 1;
	const y1 = y0 + 1;
	const xf = x - x0;
	const yf = y - y0;
	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);
	const n00 = noise(x0, y0);
	const n10 = noise(x1, y0);
	const n01 = noise(x0, y1);
	const n11 = noise(x1, y1);
	const nx0 = n00 * (1 - u) + n10 * u;
	const nx1 = n01 * (1 - u) + n11 * u;
	return nx0 * (1 - v) + nx1 * v;
}
function computeNoiseGradient(perlinFn, x, y, epsilon = .001) {
	const n1 = perlinFn(x + epsilon, y);
	const n2 = perlinFn(x - epsilon, y);
	const n3 = perlinFn(x, y + epsilon);
	const n4 = perlinFn(x, y - epsilon);
	const dx = (n1 - n2) / (2 * epsilon);
	const dy = (n3 - n4) / (2 * epsilon);
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	return [dx / len, dy / len];
}
function generateControlPoints(width, height, variationFraction = randomRange(.4, .6), normalOffset = randomRange(.3, .6), blendFactor = .8, smoothIters = Math.floor(randomRange(3, 5)), smoothFactor = randomRange(.2, .3), smoothModifier = randomRange(-.1, -.05)) {
	const w = width ?? Math.floor(randomRange(3, 6));
	const h = height ?? Math.floor(randomRange(3, 6));
	const conf = [];
	const dx = w === 1 ? 0 : 2 / (w - 1);
	const dy = h === 1 ? 0 : 2 / (h - 1);
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
		const baseX = (w === 1 ? 0 : i / (w - 1)) * 2 - 1;
		const baseY = (h === 1 ? 0 : j / (h - 1)) * 2 - 1;
		const isBorder = i === 0 || i === w - 1 || j === 0 || j === h - 1;
		const pertX = isBorder ? 0 : randomRange(-variationFraction * dx, variationFraction * dx);
		const pertY = isBorder ? 0 : randomRange(-variationFraction * dy, variationFraction * dy);
		let x = baseX + pertX;
		let y = baseY + pertY;
		const ur = isBorder ? 0 : randomRange(-60, 60);
		const vr = isBorder ? 0 : randomRange(-60, 60);
		const up = isBorder ? 1 : randomRange(.8, 1.2);
		const vp = isBorder ? 1 : randomRange(.8, 1.2);
		if (!isBorder) {
			const uNorm = (baseX + 1) / 2;
			const vNorm = (baseY + 1) / 2;
			const [nx, ny] = computeNoiseGradient(smoothNoise, uNorm, vNorm, .001);
			let offsetX = nx * normalOffset;
			let offsetY = ny * normalOffset;
			const weight = smoothstep(0, 1, Math.min(uNorm, 1 - uNorm, vNorm, 1 - vNorm));
			offsetX *= weight;
			offsetY *= weight;
			x = x * (1 - blendFactor) + (x + offsetX) * blendFactor;
			y = y * (1 - blendFactor) + (y + offsetY) * blendFactor;
		}
		conf.push(p(i, j, x, y, ur, vr, up, vp));
	}
	smoothifyControlPoints(conf, w, h, smoothIters, smoothFactor, smoothModifier);
	return preset(w, h, conf);
}
//#endregion
//#region \0raw:/home/runner/work/applemusic-like-lyrics/applemusic-like-lyrics/packages/core/src/bg-render/mesh-renderer/mesh.frag.glsl
var mesh_frag_default = "precision highp float;\r\n\r\nvarying vec3 v_color;\r\nvarying vec2 v_uv;\r\nuniform sampler2D u_texture;\r\nuniform float u_time;\r\nuniform float u_volume;\r\nuniform float u_alpha;\r\n\r\n// 预计算常量\r\nconst float INV_255 = 1.0 / 255.0;\r\nconst float HALF_INV_255 = 0.5 / 255.0;\r\nconst float GRADIENT_NOISE_A = 52.9829189;\r\nconst vec2 GRADIENT_NOISE_B = vec2(0.06711056, 0.00583715);\r\n\r\n/* Gradient noise from Jorge Jimenez's presentation: */\r\n/* http://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare */\r\nfloat gradientNoise(in vec2 uv) {\r\n    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));\r\n}\r\n\r\n// 优化的旋转函数，避免重复计算sin/cos\r\nvec2 rot(vec2 v, float angle) {\r\n    float s = sin(angle);\r\n    float c = cos(angle);\r\n    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);\r\n}\r\n\r\nvoid main() {\r\n    // 合并计算以减少指令数\r\n    float volumeEffect = u_volume * 2.0;\r\n    float timeVolume = u_time + u_volume;\r\n    \r\n    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;\r\n    vec2 centeredUV = v_uv - vec2(0.2);\r\n    vec2 rotatedUV = rot(centeredUV, timeVolume * 2.0);\r\n    vec2 finalUV = rotatedUV * max(0.001, 1.0 - volumeEffect) + vec2(0.5);\r\n    \r\n    vec4 result = texture2D(u_texture, finalUV);\r\n    \r\n    float alphaVolumeFactor = u_alpha * max(0.5, 1.0 - u_volume * 0.5);\r\n    result.rgb *= v_color * alphaVolumeFactor;\r\n    result.a *= alphaVolumeFactor;\r\n    \r\n    result.rgb += vec3(dither);\r\n    \r\n    float dist = distance(v_uv, vec2(0.5));\r\n    float vignette = smoothstep(0.8, 0.3, dist);\r\n    float mask = 0.6 + vignette * 0.4;\r\n    result.rgb *= mask;\r\n    \r\n    gl_FragColor = result;\r\n}\r\n";
//#endregion
//#region \0raw:/home/runner/work/applemusic-like-lyrics/applemusic-like-lyrics/packages/core/src/bg-render/mesh-renderer/mesh.vert.glsl
var mesh_vert_default = "precision highp float;\n\nattribute vec2 a_pos;\nattribute vec3 a_color;\nattribute vec2 a_uv;\nvarying vec3 v_color;\nvarying vec2 v_uv;\n\nuniform float u_aspect;\n\nvoid main() {\n    v_color = a_color;\n    v_uv = a_uv;\n    vec2 pos = a_pos;\n    if (u_aspect > 1.0) {\n        pos.y *= u_aspect;\n    } else {\n        pos.x /= u_aspect;\n    }\n    gl_Position = vec4(pos, 0.0, 1.0);\n}\n";
//#endregion
//#region src/bg-render/mesh-renderer/index.ts
/**
* @fileoverview
* 基于 Mesh Gradient 渐变渲染的渲染器
* 此渲染应该是 Apple Music 使用的背景渲染方式了
* 参考内容 https://movingparts.io/gradient-meshes
*/
const quadVertShader = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_pos * 0.5 + 0.5;
}
`;
const quadFragShader = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_alpha;
void main() {
    vec4 color = texture2D(u_texture, v_uv);
    gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`;
function easeInOutSine(x) {
	return -(Math.cos(Math.PI * x) - 1) / 2;
}
var GLProgram = class {
	gl;
	program;
	vertexShader;
	fragmentShader;
	attrs;
	constructor(gl, vertexShaderSource, fragmentShaderSource, label = "unknown") {
		this.label = label;
		this.gl = gl;
		this.vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
		this.fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
		this.program = this.createProgram();
		const num = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
		const attrs = {};
		for (let i = 0; i < num; i++) {
			const info = gl.getActiveAttrib(this.program, i);
			if (!info) continue;
			const location = gl.getAttribLocation(this.program, info.name);
			if (location === -1) continue;
			attrs[info.name] = location;
		}
		this.attrs = attrs;
	}
	createShader(type, source) {
		const gl = this.gl;
		const shader = gl.createShader(type);
		if (!shader) throw new Error("Failed to create shader");
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Failed to compile shader for type ${type} "${this.label}": ${gl.getShaderInfoLog(shader)}`);
		return shader;
	}
	createProgram() {
		const gl = this.gl;
		const program = gl.createProgram();
		if (!program) throw new Error("Failed to create program");
		gl.attachShader(program, this.vertexShader);
		gl.attachShader(program, this.fragmentShader);
		gl.linkProgram(program);
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const errLog = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Failed to link program "${this.label}": ${errLog}`);
		}
		return program;
	}
	use() {
		this.gl.useProgram(this.program);
	}
	notFoundUniforms = /* @__PURE__ */ new Set();
	warnUniformNotFound(name) {
		if (this.notFoundUniforms.has(name)) return;
		this.notFoundUniforms.add(name);
		console.warn(`Failed to get uniform location for program "${this.label}": ${name}`);
	}
	setUniform1f(name, value) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform1f(location, value);
	}
	setUniform2f(name, value1, value2) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform2f(location, value1, value2);
	}
	setUniform1i(name, value) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform1i(location, value);
	}
	dispose() {
		const gl = this.gl;
		gl.deleteShader(this.vertexShader);
		gl.deleteShader(this.fragmentShader);
		gl.deleteProgram(this.program);
	}
};
var Mesh = class {
	vertexWidth = 0;
	vertexHeight = 0;
	vertexBuffer;
	indexBuffer;
	vertexData;
	indexData;
	vertexIndexLength = 0;
	wireFrame = false;
	constructor(gl, attrPos, attrColor, attrUV) {
		this.gl = gl;
		this.attrPos = attrPos;
		this.attrColor = attrColor;
		this.attrUV = attrUV;
		const vertexBuf = gl.createBuffer();
		if (!vertexBuf) throw new Error("Failed to create vertex buffer");
		this.vertexBuffer = vertexBuf;
		const indexBuf = gl.createBuffer();
		if (!indexBuf) throw new Error("Failed to create index buffer");
		this.indexBuffer = indexBuf;
		this.bind();
		this.vertexData = new Float32Array(0);
		this.indexData = new Uint16Array(0);
		this.resize(2, 2);
		this.update();
	}
	setWireFrame(enable) {
		this.wireFrame = enable;
		this.resize(this.vertexWidth, this.vertexHeight);
	}
	setVertexPos(vx, vy, x, y) {
		const idx = (vx + vy * this.vertexWidth) * 7;
		if (idx >= this.vertexData.length - 1) {
			console.warn("Vertex position out of range", idx, this.vertexData.length);
			return;
		}
		this.vertexData[idx] = x;
		this.vertexData[idx + 1] = y;
	}
	setVertexColor(vx, vy, r, g, b) {
		const idx = (vx + vy * this.vertexWidth) * 7 + 2;
		if (idx >= this.vertexData.length - 2) {
			console.warn("Vertex color out of range", idx, this.vertexData.length);
			return;
		}
		this.vertexData[idx] = r;
		this.vertexData[idx + 1] = g;
		this.vertexData[idx + 2] = b;
	}
	setVertexUV(vx, vy, x, y) {
		const idx = (vx + vy * this.vertexWidth) * 7 + 5;
		if (idx >= this.vertexData.length - 1) {
			console.warn("Vertex UV out of range", idx, this.vertexData.length);
			return;
		}
		this.vertexData[idx] = x;
		this.vertexData[idx + 1] = y;
	}
	setVertexData(vx, vy, x, y, r, g, b, u, v) {
		const idx = (vx + vy * this.vertexWidth) * 7;
		if (idx >= this.vertexData.length - 6) {
			console.warn("Vertex data out of range", idx, this.vertexData.length);
			return;
		}
		const data = this.vertexData;
		data[idx] = x;
		data[idx + 1] = y;
		data[idx + 2] = r;
		data[idx + 3] = g;
		data[idx + 4] = b;
		data[idx + 5] = u;
		data[idx + 6] = v;
	}
	getVertexIndexLength() {
		return this.vertexIndexLength;
	}
	draw() {
		const gl = this.gl;
		if (this.wireFrame) gl.drawElements(gl.LINES, this.vertexIndexLength, gl.UNSIGNED_SHORT, 0);
		else gl.drawElements(gl.TRIANGLES, this.vertexIndexLength, gl.UNSIGNED_SHORT, 0);
	}
	resize(vertexWidth, vertexHeight) {
		this.vertexWidth = vertexWidth;
		this.vertexHeight = vertexHeight;
		this.vertexIndexLength = vertexWidth * vertexHeight * 6;
		if (this.wireFrame) this.vertexIndexLength = vertexWidth * vertexHeight * 10;
		const vertexData = new Float32Array(vertexWidth * vertexHeight * 7);
		const indexData = new Uint16Array(this.vertexIndexLength);
		this.vertexData = vertexData;
		this.indexData = indexData;
		for (let y = 0; y < vertexHeight; y++) for (let x = 0; x < vertexWidth; x++) {
			const px = x / (vertexWidth - 1) * 2 - 1;
			const py = y / (vertexHeight - 1) * 2 - 1;
			this.setVertexPos(x, y, px || 0, py || 0);
			this.setVertexColor(x, y, 1, 1, 1);
			this.setVertexUV(x, y, x / (vertexWidth - 1), y / (vertexHeight - 1));
		}
		for (let y = 0; y < vertexHeight - 1; y++) for (let x = 0; x < vertexWidth - 1; x++) if (this.wireFrame) {
			const idx = (y * vertexWidth + x) * 10;
			indexData[idx] = y * vertexWidth + x;
			indexData[idx + 1] = y * vertexWidth + x + 1;
			indexData[idx + 2] = y * vertexWidth + x + 1;
			indexData[idx + 3] = (y + 1) * vertexWidth + x;
			indexData[idx + 4] = (y + 1) * vertexWidth + x;
			indexData[idx + 5] = (y + 1) * vertexWidth + x + 1;
			indexData[idx + 6] = (y + 1) * vertexWidth + x + 1;
			indexData[idx + 7] = y * vertexWidth + x + 1;
			indexData[idx + 8] = y * vertexWidth + x;
			indexData[idx + 9] = (y + 1) * vertexWidth + x;
		} else {
			const idx = (y * vertexWidth + x) * 6;
			indexData[idx] = y * vertexWidth + x;
			indexData[idx + 1] = y * vertexWidth + x + 1;
			indexData[idx + 2] = (y + 1) * vertexWidth + x;
			indexData[idx + 3] = y * vertexWidth + x + 1;
			indexData[idx + 4] = (y + 1) * vertexWidth + x + 1;
			indexData[idx + 5] = (y + 1) * vertexWidth + x;
		}
		const gl = this.gl;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
	}
	bind() {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		if (this.attrPos !== void 0) {
			gl.vertexAttribPointer(this.attrPos, 2, gl.FLOAT, false, 28, 0);
			gl.enableVertexAttribArray(this.attrPos);
		}
		if (this.attrColor !== void 0) {
			gl.vertexAttribPointer(this.attrColor, 3, gl.FLOAT, false, 28, 8);
			gl.enableVertexAttribArray(this.attrColor);
		}
		if (this.attrUV !== void 0) {
			gl.vertexAttribPointer(this.attrUV, 2, gl.FLOAT, false, 28, 20);
			gl.enableVertexAttribArray(this.attrUV);
		}
	}
	update() {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.DYNAMIC_DRAW);
	}
	dispose() {
		this.gl.deleteBuffer(this.vertexBuffer);
		this.gl.deleteBuffer(this.indexBuffer);
	}
};
var ControlPoint = class {
	color = Vec3.fromValues(1, 1, 1);
	location = Vec2.fromValues(0, 0);
	uTangent = Vec2.fromValues(0, 0);
	vTangent = Vec2.fromValues(0, 0);
	_uRot = 0;
	_vRot = 0;
	_uScale = 1;
	_vScale = 1;
	constructor() {
		Object.seal(this);
	}
	get uRot() {
		return this._uRot;
	}
	get vRot() {
		return this._vRot;
	}
	set uRot(value) {
		this._uRot = value;
		this.updateUTangent();
	}
	set vRot(value) {
		this._vRot = value;
		this.updateVTangent();
	}
	get uScale() {
		return this._uScale;
	}
	get vScale() {
		return this._vScale;
	}
	set uScale(value) {
		this._uScale = value;
		this.updateUTangent();
	}
	set vScale(value) {
		this._vScale = value;
		this.updateVTangent();
	}
	updateUTangent() {
		this.uTangent[0] = Math.cos(this._uRot) * this._uScale;
		this.uTangent[1] = Math.sin(this._uRot) * this._uScale;
	}
	updateVTangent() {
		this.vTangent[0] = -Math.sin(this._vRot) * this._vScale;
		this.vTangent[1] = Math.cos(this._vRot) * this._vScale;
	}
};
const H = Mat4.fromValues(2, -2, 1, 1, -3, 3, -2, -1, 0, 0, 1, 0, 1, 0, 0, 0);
const H_T = Mat4.clone(H).transpose();
function meshCoefficients(p00, p01, p10, p11, axis, output = Mat4.create()) {
	const l = (p) => p.location[axis];
	const u = (p) => p.uTangent[axis];
	const v = (p) => p.vTangent[axis];
	output[0] = l(p00);
	output[1] = l(p01);
	output[2] = v(p00);
	output[3] = v(p01);
	output[4] = l(p10);
	output[5] = l(p11);
	output[6] = v(p10);
	output[7] = v(p11);
	output[8] = u(p00);
	output[9] = u(p01);
	output[10] = 0;
	output[11] = 0;
	output[12] = u(p10);
	output[13] = u(p11);
	output[14] = 0;
	output[15] = 0;
	return output;
}
function colorCoefficients(p00, p01, p10, p11, axis, output = Mat4.create()) {
	const c = (p) => p.color[axis];
	output.fill(0);
	output[0] = c(p00);
	output[1] = c(p01);
	output[4] = c(p10);
	output[5] = c(p11);
	return output;
}
var Map2D = class {
	_width = 0;
	_height = 0;
	_data = [];
	constructor(width, height) {
		this.resize(width, height);
		Object.seal(this);
	}
	resize(width, height) {
		this._width = width;
		this._height = height;
		this._data = new Array(width * height).fill(0);
	}
	set(x, y, value) {
		this._data[x + y * this._width] = value;
	}
	get(x, y) {
		return this._data[x + y * this._width];
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
};
var BHPMesh = class extends Mesh {
	/**
	* 细分级别，越大曲线越平滑，但是性能消耗也越大
	*/
	_subDivisions = 10;
	_controlPoints = new Map2D(3, 3);
	constructor(gl, attrPos, attrColor, attrUV) {
		super(gl, attrPos, attrColor, attrUV);
		this.resizeControlPoints(3, 3);
		Object.seal(this);
	}
	setWireFrame(enable) {
		super.setWireFrame(enable);
		this.updateMesh();
	}
	/**
	* 以当前的控制点矩阵大小和细分级别为参考重新设置细分级别，此操作不会重设控制点数据
	* @param subDivisions 细分级别
	*/
	resetSubdivition(subDivisions) {
		this._subDivisions = subDivisions;
		super.resize((this._controlPoints.width - 1) * subDivisions, (this._controlPoints.height - 1) * subDivisions);
	}
	/**
	* 重设控制点矩阵尺寸，将会重置所有控制点的颜色和坐标数据
	* 请在调用此方法后重新设置颜色和坐标，并调用 updateMesh 方法更新网格
	* @param width 控制点宽度数量，必须大于等于 2
	* @param height 控制点高度数量，必须大于等于 2
	*/
	resizeControlPoints(width, height) {
		if (!(width >= 2 && height >= 2)) throw new Error("Control points must be larger than 3x3 or equal");
		this._controlPoints.resize(width, height);
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			const point = new ControlPoint();
			point.location.x = x / (width - 1) * 2 - 1;
			point.location.y = y / (height - 1) * 2 - 1;
			point.uTangent.x = 2 / (width - 1);
			point.vTangent.y = 2 / (height - 1);
			this._controlPoints.set(x, y, point);
		}
		this.resetSubdivition(this._subDivisions);
	}
	/**
	* 获取指定位置的控制点，然后可以设置颜色和坐标属性
	* 留意颜色属性和坐标属性的值范围均参考 WebGL 的定义
	* 即颜色各个组件取值 [0-1]，坐标取值 [-1, 1]
	* 点的位置以画面左下角为原点 (0,0)
	* @param x 需要获取的控制点的 x 坐标
	* @param y 需要获取的控制点的 y 坐标
	* @returns 控制点对象
	*/
	getControlPoint(x, y) {
		return this._controlPoints.get(x, y);
	}
	tempX = Mat4.create();
	tempY = Mat4.create();
	tempR = Mat4.create();
	tempG = Mat4.create();
	tempB = Mat4.create();
	tempXAcc = Mat4.create();
	tempYAcc = Mat4.create();
	tempRAcc = Mat4.create();
	tempGAcc = Mat4.create();
	tempBAcc = Mat4.create();
	tempUx = Vec4.create();
	tempUy = Vec4.create();
	tempUr = Vec4.create();
	tempUg = Vec4.create();
	tempUb = Vec4.create();
	precomputeMatrix(M, output) {
		output.copy(M).transpose();
		Mat4.mul(output, output, H);
		Mat4.mul(output, H_T, output);
		return output;
	}
	/**
	* 更新最终呈现的网格数据，此方法应在所有控制点或细分参数的操作完成后调用
	*/
	updateMesh() {
		const subDivM1 = this._subDivisions - 1;
		const tW = subDivM1 * (this._controlPoints.height - 1);
		const tH = subDivM1 * (this._controlPoints.width - 1);
		const controlPointsWidth = this._controlPoints.width;
		const controlPointsHeight = this._controlPoints.height;
		const subDivisions = this._subDivisions;
		const invSubDivM1 = 1 / subDivM1;
		const invTH = 1 / tH;
		const invTW = 1 / tW;
		const normPowers = new Float32Array(subDivisions * 4);
		for (let i = 0; i < subDivisions; i++) {
			const norm = i * invSubDivM1;
			const idx = i * 4;
			normPowers[idx] = norm ** 3;
			normPowers[idx + 1] = norm ** 2;
			normPowers[idx + 2] = norm;
			normPowers[idx + 3] = 1;
		}
		for (let x = 0; x < controlPointsWidth - 1; x++) for (let y = 0; y < controlPointsHeight - 1; y++) {
			const p00 = this._controlPoints.get(x, y);
			const p01 = this._controlPoints.get(x, y + 1);
			const p10 = this._controlPoints.get(x + 1, y);
			const p11 = this._controlPoints.get(x + 1, y + 1);
			meshCoefficients(p00, p01, p10, p11, "x", this.tempX);
			meshCoefficients(p00, p01, p10, p11, "y", this.tempY);
			colorCoefficients(p00, p01, p10, p11, "r", this.tempR);
			colorCoefficients(p00, p01, p10, p11, "g", this.tempG);
			colorCoefficients(p00, p01, p10, p11, "b", this.tempB);
			this.precomputeMatrix(this.tempX, this.tempXAcc);
			this.precomputeMatrix(this.tempY, this.tempYAcc);
			this.precomputeMatrix(this.tempR, this.tempRAcc);
			this.precomputeMatrix(this.tempG, this.tempGAcc);
			this.precomputeMatrix(this.tempB, this.tempBAcc);
			const sX = x / (controlPointsWidth - 1);
			const sY = y / (controlPointsHeight - 1);
			const baseVx = y * subDivisions;
			const baseVy = x * subDivisions;
			for (let u = 0; u < subDivisions; u++) {
				const vxOffset = baseVx + u;
				const uIdx = u * 4;
				this.tempUx[0] = normPowers[uIdx];
				this.tempUx[1] = normPowers[uIdx + 1];
				this.tempUx[2] = normPowers[uIdx + 2];
				this.tempUx[3] = normPowers[uIdx + 3];
				Vec4.transformMat4(this.tempUx, this.tempUx, this.tempXAcc);
				this.tempUy[0] = normPowers[uIdx];
				this.tempUy[1] = normPowers[uIdx + 1];
				this.tempUy[2] = normPowers[uIdx + 2];
				this.tempUy[3] = normPowers[uIdx + 3];
				Vec4.transformMat4(this.tempUy, this.tempUy, this.tempYAcc);
				this.tempUr[0] = normPowers[uIdx];
				this.tempUr[1] = normPowers[uIdx + 1];
				this.tempUr[2] = normPowers[uIdx + 2];
				this.tempUr[3] = normPowers[uIdx + 3];
				Vec4.transformMat4(this.tempUr, this.tempUr, this.tempRAcc);
				this.tempUg[0] = normPowers[uIdx];
				this.tempUg[1] = normPowers[uIdx + 1];
				this.tempUg[2] = normPowers[uIdx + 2];
				this.tempUg[3] = normPowers[uIdx + 3];
				Vec4.transformMat4(this.tempUg, this.tempUg, this.tempGAcc);
				this.tempUb[0] = normPowers[uIdx];
				this.tempUb[1] = normPowers[uIdx + 1];
				this.tempUb[2] = normPowers[uIdx + 2];
				this.tempUb[3] = normPowers[uIdx + 3];
				Vec4.transformMat4(this.tempUb, this.tempUb, this.tempBAcc);
				for (let v = 0; v < subDivisions; v++) {
					const vy = baseVy + v;
					const vIdx = v * 4;
					const v0 = normPowers[vIdx];
					const v1 = normPowers[vIdx + 1];
					const v2 = normPowers[vIdx + 2];
					const v3 = normPowers[vIdx + 3];
					const px = v0 * this.tempUx[0] + v1 * this.tempUx[1] + v2 * this.tempUx[2] + v3 * this.tempUx[3];
					const py = v0 * this.tempUy[0] + v1 * this.tempUy[1] + v2 * this.tempUy[2] + v3 * this.tempUy[3];
					const pr = v0 * this.tempUr[0] + v1 * this.tempUr[1] + v2 * this.tempUr[2] + v3 * this.tempUr[3];
					const pg = v0 * this.tempUg[0] + v1 * this.tempUg[1] + v2 * this.tempUg[2] + v3 * this.tempUg[3];
					const pb = v0 * this.tempUb[0] + v1 * this.tempUb[1] + v2 * this.tempUb[2] + v3 * this.tempUb[3];
					const uvX = sX + v * invTH;
					const uvY = 1 - sY - u * invTW;
					this.setVertexData(vxOffset, vy, px, py, pr, pg, pb, uvX, uvY);
				}
			}
		}
		this.update();
	}
};
var GLTexture = class {
	tex;
	constructor(gl, albumImageData) {
		this.gl = gl;
		const albumTexture = gl.createTexture();
		if (!albumTexture) throw new Error("Failed to create texture");
		this.tex = albumTexture;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, albumTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, albumImageData);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
	}
	bind() {
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
	}
	dispose() {
		this.gl.deleteTexture(this.tex);
	}
};
function createOffscreenCanvas(width, height) {
	if ("OffscreenCanvas" in window) return new OffscreenCanvas(width, height);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}
var MeshGradientRenderer = class extends BaseRenderer {
	gl;
	lastFrameTime = 0;
	frameTime = 0;
	lastTickTime = 0;
	smoothedVolume = 0;
	volume = 0;
	tickHandle = 0;
	maxFPS = 60;
	paused = false;
	staticMode = false;
	mainProgram;
	quadProgram;
	quadBuffer;
	fbo = null;
	fboTexture = null;
	manualControl = false;
	reduceImageSizeCanvas = createOffscreenCanvas(32, 32);
	targetSize = Vec2.fromValues(0, 0);
	currentSize = Vec2.fromValues(0, 0);
	isNoCover = true;
	meshStates = [];
	_disposed = false;
	frameCount = 0;
	lastFPSUpdate = 0;
	currentFPS = 0;
	enablePerformanceMonitoring = false;
	setManualControl(enable) {
		this.manualControl = enable;
	}
	setWireFrame(enable) {
		for (const state of this.meshStates) state.mesh.setWireFrame(enable);
	}
	getControlPoint(x, y) {
		return this.meshStates[this.meshStates.length - 1]?.mesh?.getControlPoint(x, y);
	}
	resizeControlPoints(width, height) {
		this.meshStates[this.meshStates.length - 1]?.mesh?.resizeControlPoints(width, height);
	}
	resetSubdivition(subDivisions) {
		this.meshStates[this.meshStates.length - 1]?.mesh?.resetSubdivition(subDivisions);
	}
	onTick(tickTime) {
		this.tickHandle = 0;
		if (this.paused) return;
		if (this._disposed) return;
		this.updatePerformanceStats(tickTime);
		const interval = 1e3 / this.maxFPS;
		const delta = tickTime - this.lastTickTime;
		if (delta < interval) {
			this.requestTick();
			return;
		}
		if (Number.isNaN(this.lastFrameTime)) this.lastFrameTime = tickTime;
		const frameDelta = tickTime - this.lastFrameTime;
		this.lastFrameTime = tickTime;
		this.lastTickTime = tickTime - delta % interval;
		this.frameTime += frameDelta * this.flowSpeed;
		if (!(this.onRedraw(this.frameTime, frameDelta) && this.staticMode)) this.requestTick();
		else if (this.staticMode) this.lastFrameTime = NaN;
	}
	checkIfResize() {
		const [tW, tH] = [this.targetSize.x, this.targetSize.y];
		const [cW, cH] = [this.currentSize.x, this.currentSize.y];
		if (tW !== cW || tH !== cH) {
			super.onResize(tW, tH);
			const gl = this.gl;
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, tW, tH);
			this.currentSize.x = tW;
			this.currentSize.y = tH;
			if (tW > 0 && tH > 0) this.updateFBO(tW, tH);
		}
	}
	updateFBO(width, height) {
		const gl = this.gl;
		if (this.fbo) gl.deleteFramebuffer(this.fbo);
		if (this.fboTexture) gl.deleteTexture(this.fboTexture);
		this.fboTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		this.fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTexture, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	onRedraw(tickTime, delta) {
		const latestMeshState = this.meshStates[this.meshStates.length - 1];
		let canBeStatic = false;
		const deltaFactor = delta / 500;
		if (latestMeshState) {
			latestMeshState.mesh.bind();
			if (this.manualControl) latestMeshState.mesh.updateMesh();
			if (this.isNoCover) {
				let hasActiveStates = false;
				for (let i = this.meshStates.length - 1; i >= 0; i--) {
					const state = this.meshStates[i];
					if (state.alpha <= -.1) {
						state.mesh.dispose();
						state.texture.dispose();
						this.meshStates.splice(i, 1);
					} else {
						state.alpha = Math.max(-.1, state.alpha - deltaFactor);
						hasActiveStates = true;
					}
				}
				canBeStatic = !hasActiveStates;
			} else {
				if (latestMeshState.alpha >= 1.1) {
					const deleted = this.meshStates.splice(0, this.meshStates.length - 1);
					for (const state of deleted) {
						state.mesh.dispose();
						state.texture.dispose();
					}
				} else latestMeshState.alpha = Math.min(1.1, latestMeshState.alpha + deltaFactor);
				canBeStatic = this.meshStates.length === 1 && latestMeshState.alpha >= 1.1;
			}
		}
		const gl = this.gl;
		this.checkIfResize();
		if (!this.fbo) return canBeStatic;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		const lerpFactor = Math.min(1, delta / 100);
		this.smoothedVolume += (this.volume - this.smoothedVolume) * lerpFactor;
		for (const state of this.meshStates) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
			gl.disable(gl.BLEND);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this.mainProgram.use();
			gl.activeTexture(gl.TEXTURE0);
			this.mainProgram.setUniform1f("u_time", tickTime / 1e4);
			this.mainProgram.setUniform1f("u_aspect", this.manualControl ? 1 : this.canvas.width / this.canvas.height);
			this.mainProgram.setUniform1i("u_texture", 0);
			this.mainProgram.setUniform1f("u_volume", this.volume);
			this.mainProgram.setUniform1f("u_alpha", 1);
			state.texture.bind();
			state.mesh.bind();
			state.mesh.draw();
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			this.quadProgram.use();
			this.quadProgram.setUniform1i("u_texture", 0);
			this.quadProgram.setUniform1f("u_alpha", easeInOutSine(clamp01(state.alpha)));
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
			const a_pos = this.quadProgram.attrs.a_pos;
			gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(a_pos);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			gl.disableVertexAttribArray(a_pos);
		}
		gl.flush();
		return canBeStatic;
	}
	onTickBinded = this.onTick.bind(this);
	requestTick() {
		if (this._disposed) return;
		if (this.tickHandle === 0) this.tickHandle = requestAnimationFrame(this.onTickBinded);
	}
	constructor(canvas) {
		super(canvas);
		const gl = canvas.getContext("webgl", { antialias: true });
		if (!gl) throw new Error("WebGL not supported");
		if (!gl.getExtension("EXT_color_buffer_float")) console.warn("EXT_color_buffer_float not supported");
		if (!gl.getExtension("EXT_float_blend")) console.warn("EXT_float_blend not supported");
		if (!gl.getExtension("OES_texture_float_linear")) console.warn("OES_texture_float_linear not supported");
		if (!gl.getExtension("OES_texture_float")) console.warn("OES_texture_float not supported");
		this.gl = gl;
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.ALWAYS);
		this.mainProgram = new GLProgram(gl, mesh_vert_default, mesh_frag_default, "main-program-mg");
		this.quadProgram = new GLProgram(gl, quadVertShader, quadFragShader, "quad-program");
		const quadBuffer = gl.createBuffer();
		if (!quadBuffer) throw new Error("Failed to create quad buffer");
		this.quadBuffer = quadBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1,
			-1,
			1,
			-1,
			-1,
			1,
			-1,
			1,
			1,
			-1,
			1,
			1
		]), gl.STATIC_DRAW);
		this.requestTick();
	}
	onResize(width, height) {
		this.targetSize.x = Math.ceil(width);
		this.targetSize.y = Math.ceil(height);
		this.requestTick();
	}
	setStaticMode(enable) {
		this.staticMode = enable;
		this.lastFrameTime = performance.now();
		this.requestTick();
	}
	setFPS(fps) {
		this.maxFPS = fps;
	}
	pause() {
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this.paused = true;
	}
	resume() {
		this.paused = false;
		this.requestTick();
	}
	async setAlbum(albumSource, isVideo) {
		if (albumSource === void 0 || typeof albumSource === "string" && albumSource.trim().length === 0) {
			this.isNoCover = true;
			return;
		}
		let res = null;
		let blob = null;
		let remainRetryTimes = 5;
		while (!res && remainRetryTimes > 0) try {
			if (typeof albumSource === "string") if (!isVideo && "createImageBitmap" in window) {
				blob = await (await fetch(albumSource)).blob();
				res = await loadResourceFromUrl(URL.createObjectURL(blob), false);
			} else res = await loadResourceFromUrl(albumSource, isVideo);
			else res = await loadResourceFromElement(albumSource);
		} catch (error) {
			console.warn(`failed on loading album resource, retrying (${remainRetryTimes})`, {
				albumSource,
				error
			});
			remainRetryTimes--;
		}
		if (!res) {
			console.error("Failed to load album resource", albumSource);
			this.isNoCover = true;
			return;
		}
		this.isNoCover = false;
		const c = this.reduceImageSizeCanvas;
		const ctx = c.getContext("2d", { willReadFrequently: true });
		if (!ctx) throw new Error("Failed to create canvas context");
		ctx.clearRect(0, 0, c.width, c.height);
		const imgw = res instanceof HTMLVideoElement ? res.videoWidth : res.naturalWidth;
		const imgh = res instanceof HTMLVideoElement ? res.videoHeight : res.naturalHeight;
		if (imgw * imgh === 0) throw new Error("Invalid image size");
		let bitmap = null;
		try {
			if ("createImageBitmap" in window) if (blob) {
				bitmap = await createImageBitmap(blob, {
					resizeWidth: c.width,
					resizeHeight: c.height,
					resizeQuality: "low"
				});
				URL.revokeObjectURL(res.src);
			} else bitmap = await createImageBitmap(res, {
				resizeWidth: c.width,
				resizeHeight: c.height,
				resizeQuality: "low"
			});
		} catch (e) {
			console.warn("createImageBitmap failed", e);
		}
		if (bitmap) {
			ctx.drawImage(bitmap, 0, 0);
			bitmap.close();
		} else ctx.drawImage(res, 0, 0, imgw, imgh, 0, 0, c.width, c.height);
		const imageData = ctx.getImageData(0, 0, c.width, c.height);
		const pixels = imageData.data;
		for (let i = 0; i < pixels.length; i += 4) {
			let r = pixels[i];
			let g = pixels[i + 1];
			let b = pixels[i + 2];
			r = (r - 128) * .4 + 128;
			g = (g - 128) * .4 + 128;
			b = (b - 128) * .4 + 128;
			const gray = r * .3 + g * .59 + b * .11;
			r = gray * -2 + r * 3;
			g = gray * -2 + g * 3;
			b = gray * -2 + b * 3;
			r = (r - 128) * 1.7 + 128;
			g = (g - 128) * 1.7 + 128;
			b = (b - 128) * 1.7 + 128;
			pixels[i] = r * .75;
			pixels[i + 1] = g * .75;
			pixels[i + 2] = b * .75;
		}
		blurImage(imageData, 2, 4);
		if (this.manualControl && this.meshStates.length > 0) {
			this.meshStates[0].texture.dispose();
			this.meshStates[0].texture = new GLTexture(this.gl, imageData);
		} else {
			const newMesh = new BHPMesh(this.gl, this.mainProgram.attrs.a_pos, this.mainProgram.attrs.a_color, this.mainProgram.attrs.a_uv);
			newMesh.resetSubdivition(50);
			const chosenPreset = Math.random() > .8 ? generateControlPoints(6, 6) : CONTROL_POINT_PRESETS[Math.floor(Math.random() * CONTROL_POINT_PRESETS.length)];
			newMesh.resizeControlPoints(chosenPreset.width, chosenPreset.height);
			const uPower = 2 / (chosenPreset.width - 1);
			const vPower = 2 / (chosenPreset.height - 1);
			for (const cp of chosenPreset.conf) {
				const p = newMesh.getControlPoint(cp.cx, cp.cy);
				p.location.x = cp.x;
				p.location.y = cp.y;
				p.uRot = cp.ur * Math.PI / 180;
				p.vRot = cp.vr * Math.PI / 180;
				p.uScale = uPower * cp.up;
				p.vScale = vPower * cp.vp;
			}
			newMesh.updateMesh();
			const newState = {
				mesh: newMesh,
				texture: new GLTexture(this.gl, imageData),
				alpha: 0
			};
			this.meshStates.push(newState);
		}
		this.requestTick();
	}
	setLowFreqVolume(volume) {
		this.volume = volume / 10;
	}
	setHasLyric(_hasLyric) {}
	dispose() {
		super.dispose();
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this._disposed = true;
		this.mainProgram.dispose();
		this.quadProgram.dispose();
		this.gl.deleteBuffer(this.quadBuffer);
		if (this.fbo) this.gl.deleteFramebuffer(this.fbo);
		if (this.fboTexture) this.gl.deleteTexture(this.fboTexture);
		for (const state of this.meshStates) {
			state.mesh.dispose();
			state.texture.dispose();
		}
	}
	enablePerformanceMonitor(enable) {
		this.enablePerformanceMonitoring = enable;
		if (enable) {
			this.frameCount = 0;
			this.lastFPSUpdate = performance.now();
		}
	}
	getCurrentFPS() {
		return this.currentFPS;
	}
	updatePerformanceStats(tickTime) {
		if (!this.enablePerformanceMonitoring) return;
		this.frameCount++;
		if (tickTime - this.lastFPSUpdate > 1e3) {
			this.currentFPS = this.frameCount;
			this.frameCount = 0;
			this.lastFPSUpdate = tickTime;
		}
	}
};
//#endregion
//#region src/bg-render/pixi-renderer.ts
var TimedContainer = class extends Container {
	time = 0;
};
var PixiRenderer = class extends BaseRenderer {
	app;
	curContainer;
	staticMode = false;
	lastContainer = /* @__PURE__ */ new Set();
	onTick = (delta) => {
		for (const lastContainer of this.lastContainer) {
			lastContainer.alpha = clampPositive(lastContainer.alpha - delta / 60);
			if (lastContainer.alpha <= 0) {
				this.app.stage.removeChild(lastContainer);
				this.lastContainer.delete(lastContainer);
				lastContainer.destroy(true);
			}
		}
		if (this.curContainer) {
			this.curContainer.alpha = Math.min(1, this.curContainer.alpha + delta / 60);
			const [s1, s2, s3, s4] = this.curContainer.children;
			const maxSize = Math.max(this.app.screen.width, this.app.screen.height);
			s1.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
			s2.position.set(this.app.screen.width / 2.5, this.app.screen.height / 2.5);
			s3.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
			s4.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
			s1.width = maxSize * Math.sqrt(2);
			s1.height = s1.width;
			s2.width = maxSize * .8;
			s2.height = s2.width;
			s3.width = maxSize * .5;
			s3.height = s3.width;
			s4.width = maxSize * .25;
			s4.height = s4.width;
			this.curContainer.time += delta * this.flowSpeed;
			s1.rotation += delta / 1e3 * this.flowSpeed;
			s2.rotation -= delta / 500 * this.flowSpeed;
			s3.rotation += delta / 1e3 * this.flowSpeed;
			s4.rotation -= delta / 750 * this.flowSpeed;
			s3.x = this.app.screen.width / 2 + this.app.screen.width / 4 * Math.cos(this.curContainer.time / 1e3 * .75);
			s3.y = this.app.screen.height / 2 + this.app.screen.width / 4 * Math.cos(this.curContainer.time / 1e3 * .75);
			s4.x = this.app.screen.width / 2 + this.app.screen.width / 4 * .1 + Math.cos(this.curContainer.time * .006 * .75);
			s4.y = this.app.screen.height / 2 + this.app.screen.width / 4 * .1 + Math.cos(this.curContainer.time * .006 * .75);
			if (this.curContainer.alpha >= 1 && this.lastContainer.size === 0 && this.staticMode) this.app.ticker.stop();
		}
	};
	constructor(canvas) {
		super(canvas);
		this.canvas = canvas;
		this.app = new Application({
			view: canvas,
			resizeTo: this.canvas,
			powerPreference: "low-power",
			backgroundAlpha: 1
		});
		this.rebuildFilters();
		this.app.ticker.maxFPS = 30;
		this.app.ticker.add(this.onTick);
		this.app.ticker.start();
	}
	onResize(width, height) {
		super.onResize(width, height);
		this.app.resize();
		this.rebuildFilters();
	}
	setRenderScale(scale) {
		super.setRenderScale(scale);
		this.rebuildFilters();
	}
	rebuildFilters() {
		const minBorder = Math.min(this.canvas.width, this.canvas.height);
		const maxBorder = Math.max(this.canvas.width, this.canvas.height);
		const c0 = new ColorMatrixFilter();
		c0.saturate(1.2, false);
		const c1 = new ColorMatrixFilter();
		c1.brightness(.6, false);
		const c2 = new ColorMatrixFilter();
		c2.contrast(.3, true);
		for (const filter of this.app.stage.filters ?? []) filter.destroy();
		this.app.stage.filters = [];
		this.app.stage.filters.push(new BlurFilter(5, 1));
		this.app.stage.filters.push(new BlurFilter(10, 1));
		this.app.stage.filters.push(new BlurFilter(20, 2));
		this.app.stage.filters.push(new BlurFilter(40, 2));
		this.app.stage.filters.push(new BlurFilter(80, 2));
		if (minBorder > 768) this.app.stage.filters.push(new BlurFilter(160, 4));
		if (minBorder > 768 * 2) this.app.stage.filters.push(new BlurFilter(320, 4));
		this.app.stage.filters.push(c0, c1, c2);
		this.app.stage.filters.push(new BlurFilter(5, 1));
		if (Math.random() > .5) {
			this.app.stage.filters.push(new BulgePinchFilter({
				radius: (maxBorder + minBorder) / 2,
				strength: 1,
				center: [.25, 1]
			}));
			this.app.stage.filters.push(new BulgePinchFilter({
				radius: (maxBorder + minBorder) / 2,
				strength: 1,
				center: [.75, 0]
			}));
		} else {
			this.app.stage.filters.push(new BulgePinchFilter({
				radius: (maxBorder + minBorder) / 2,
				strength: 1,
				center: [.75, 1]
			}));
			this.app.stage.filters.push(new BulgePinchFilter({
				radius: (maxBorder + minBorder) / 2,
				strength: 1,
				center: [.25, 0]
			}));
		}
	}
	setStaticMode(enable = false) {
		this.staticMode = enable;
		this.app.ticker.start();
	}
	setFPS(fps) {
		this.app.ticker.maxFPS = fps;
	}
	pause() {
		this.app.ticker.stop();
		this.app.render();
	}
	resume() {
		this.app.ticker.start();
	}
	setLowFreqVolume(_volume) {}
	setHasLyric(_hasLyric) {}
	async setAlbum(albumSource, isVideo) {
		if (!albumSource || typeof albumSource === "string" && albumSource.trim().length === 0) return;
		let res = null;
		let remainRetryTimes = 5;
		let tex = null;
		while (!tex?.baseTexture?.resource?.valid && remainRetryTimes > 0) try {
			if (typeof albumSource === "string") res = await loadResourceFromUrl(albumSource, isVideo);
			else res = await loadResourceFromElement(albumSource);
			tex = Texture.from(res, { resourceOptions: { autoLoad: false } });
			await tex.baseTexture.resource.load();
		} catch (error) {
			console.warn(`failed on loading album image, retrying (${remainRetryTimes})`, albumSource, error);
			tex = null;
			remainRetryTimes--;
		}
		if (!tex) return;
		const container = new TimedContainer();
		const s1 = new Sprite(tex);
		const s2 = new Sprite(tex);
		const s3 = new Sprite(tex);
		const s4 = new Sprite(tex);
		s1.anchor.set(.5, .5);
		s2.anchor.set(.5, .5);
		s3.anchor.set(.5, .5);
		s4.anchor.set(.5, .5);
		s1.rotation = Math.random() * Math.PI * 2;
		s2.rotation = Math.random() * Math.PI * 2;
		s3.rotation = Math.random() * Math.PI * 2;
		s4.rotation = Math.random() * Math.PI * 2;
		container.addChild(s1, s2, s3, s4);
		if (this.curContainer) this.lastContainer.add(this.curContainer);
		this.curContainer = container;
		this.app.stage.addChild(container);
		this.curContainer.alpha = 0;
		this.app.ticker.start();
	}
	dispose() {
		super.dispose();
		this.app.ticker.remove(this.onTick);
		this.app.destroy(true);
	}
	getElement() {
		return this.canvas;
	}
};
//#endregion
//#region src/bg-render/index.ts
var BackgroundRender = class BackgroundRender {
	element;
	renderer;
	constructor(renderer, canvas) {
		this.renderer = renderer;
		this.element = canvas;
		canvas.style.pointerEvents = "none";
		canvas.style.zIndex = "-1";
		canvas.style.contain = "strict";
	}
	static new(type) {
		const newCanvas = document.createElement("canvas");
		return new BackgroundRender(new type(newCanvas), newCanvas);
	}
	setRenderScale(scale) {
		this.renderer.setRenderScale(scale);
	}
	setFlowSpeed(speed) {
		this.renderer.setFlowSpeed(speed);
	}
	setStaticMode(enable) {
		this.renderer.setStaticMode(enable);
	}
	setFPS(fps) {
		this.renderer.setFPS(fps);
	}
	pause() {
		this.renderer.pause();
	}
	resume() {
		this.renderer.resume();
	}
	setLowFreqVolume(volume) {
		this.renderer.setLowFreqVolume(volume);
	}
	setHasLyric(hasLyric) {
		this.renderer.setHasLyric(hasLyric);
	}
	setAlbum(albumSource, isVideo) {
		return this.renderer.setAlbum(albumSource, isVideo);
	}
	getElement() {
		return this.element;
	}
	dispose() {
		this.renderer.dispose();
		this.element.remove();
	}
};
//#endregion
//#region src/styles/lyric-player.module.css
var lyric_player_module_default = {
	"active": "FmKaba_active",
	"bgWrapper": "FmKaba_bgWrapper",
	"bgWrapperActive": "FmKaba_bgWrapperActive",
	"bgWrapperHidden": "FmKaba_bgWrapperHidden",
	"bgWrapperTop": "FmKaba_bgWrapperTop",
	"bottomLine": "FmKaba_bottomLine",
	"dirty": "FmKaba_dirty",
	"disableSpring": "FmKaba_disableSpring",
	"duet": "FmKaba_duet",
	"emphasize": "FmKaba_emphasize",
	"emphasizeWrapper": "FmKaba_emphasizeWrapper",
	"enabled": "FmKaba_enabled",
	"hasDuetLine": "FmKaba_hasDuetLine",
	"interludeDots": "FmKaba_interludeDots",
	"lyricBgLine": "FmKaba_lyricBgLine",
	"lyricDuetLine": "FmKaba_lyricDuetLine",
	"lyricLine": "FmKaba_lyricLine",
	"lyricLineWrapper": "FmKaba_lyricLineWrapper",
	"lyricMainLine": "FmKaba_lyricMainLine",
	"lyricSubLine": "FmKaba_lyricSubLine",
	"playing": "FmKaba_playing",
	"romanWord": "FmKaba_romanWord",
	"rubyWord": "FmKaba_rubyWord",
	"tmpDisableTransition": "FmKaba_tmpDisableTransition",
	"wordBody": "FmKaba_wordBody",
	"wordWithRuby": "FmKaba_wordWithRuby"
};
//#endregion
//#region src/utils/optimize-lyric.ts
const DEFAULT_OPTIMIZE_OPTIONS = {
	normalizeSpaces: true,
	resetLineTimestamps: true,
	convertExcessiveBackgroundLines: true,
	syncMainAndBackgroundLines: true,
	cleanUnintentionalOverlaps: true,
	tryAdvanceStartTime: true
};
/**
* 规范化歌词中的空格，将多个连续空格替换为一个空格
*/
function normalizeSpaces(lines) {
	for (const line of lines) for (const word of line.words) word.word = word.word.replace(/\s+/g, " ");
}
/**
* 将行级时间戳强行设为字级时间戳
*/
function resetLineTimestamps(lines) {
	for (const line of lines) if (line.words.length === 1 && line.words[0].startTime === 0 && line.words[0].endTime === 0 && (line.startTime !== 0 || line.endTime !== 0)) {
		line.words[0].startTime = line.startTime;
		line.words[0].endTime = line.endTime;
	} else if (line.words.length > 0) {
		const firstWord = line.words[0];
		const lastWord = line.words[line.words.length - 1];
		line.startTime = firstWord.startTime;
		line.endTime = lastWord.endTime;
	}
}
/**
* 把多行背景人声转换为单行背景人声 + 主歌词行的形式
*/
function convertExcessiveBackgroundLines(lines) {
	let consecutiveBgCount = 0;
	for (const line of lines) if (line.isBG) {
		consecutiveBgCount++;
		if (consecutiveBgCount > 1) line.isBG = false;
	} else consecutiveBgCount = 0;
}
/**
* 同步主歌词与背景人声的时间
*
* 取两者中最早的开始时间和最晚的结束时间，应用给双方
*/
function syncMainAndBackgroundLines(lines) {
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line.isBG) continue;
		const nextLine = lines[i + 1];
		if (nextLine?.isBG) {
			const allWords = [...line.words, ...nextLine.words].filter((w) => w.word.trim().length > 0);
			if (allWords.length > 0) {
				const minStart = Math.min(...allWords.map((w) => w.startTime));
				const maxEnd = Math.max(...allWords.map((w) => w.endTime));
				const finalStart = Math.min(minStart, line.startTime, nextLine.startTime);
				const finalEnd = Math.max(maxEnd, line.endTime, nextLine.endTime);
				line.startTime = finalStart;
				line.endTime = finalEnd;
				nextLine.startTime = finalStart;
				nextLine.endTime = finalEnd;
			}
		}
	}
}
/**
* 清洗非刻意的重叠
*
* 如果重叠大于100ms 且 重叠超过下一行时长的10%，则视为刻意重叠，否则将结束时间设为下一行的开始时间
*/
function cleanUnintentionalOverlaps(lines) {
	for (let i = 0; i < lines.length - 1; i++) {
		const line = lines[i];
		if (line.isBG) continue;
		let nextMainIndex = i + 1;
		while (nextMainIndex < lines.length && lines[nextMainIndex].isBG) nextMainIndex++;
		if (nextMainIndex < lines.length) {
			const nextLine = lines[nextMainIndex];
			const overlap = line.endTime - nextLine.startTime;
			if (overlap > 0) {
				const percentageThreshold = (nextLine.endTime - nextLine.startTime) * .1;
				if (!(overlap > 100 && overlap > percentageThreshold)) {
					line.endTime = nextLine.startTime;
					const attachedBgLine = lines[i + 1];
					if (attachedBgLine?.isBG) attachedBgLine.endTime = nextLine.startTime;
				}
			}
		}
	}
}
/**
* 尝试让歌词提前最多 600ms 开始，如果有重叠则尝试最多提前 400ms 或上一行时长的 30%
*/
function tryAdvanceStartTime(lines) {
	const defaultAdvanceAmount = 600;
	const fallbackAdvanceAmount = 400;
	const fallbackAdvanceRatio = .3;
	let prevLineStartTime = 0;
	let prevLineEndTime = 0;
	let prevMainGroupStartTime = 0;
	let prevMainGroupEndTime = 0;
	let hasPrevLine = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.isBG) continue;
		const originalStartTime = line.startTime;
		const originalEndTime = line.endTime;
		let targetAdvanceAmount = 0;
		let safeBoundary = 0;
		if (hasPrevLine) if (originalStartTime >= prevLineEndTime) {
			targetAdvanceAmount = defaultAdvanceAmount;
			safeBoundary = prevMainGroupEndTime;
		} else {
			targetAdvanceAmount = fallbackAdvanceAmount;
			const prevDuration = prevLineEndTime - prevLineStartTime;
			safeBoundary = prevLineStartTime + prevDuration * fallbackAdvanceRatio;
		}
		else {
			targetAdvanceAmount = defaultAdvanceAmount;
			safeBoundary = 0;
		}
		const targetTime = line.startTime - targetAdvanceAmount;
		const newStartTime = Math.max(safeBoundary, targetTime);
		if (newStartTime < line.startTime) line.startTime = newStartTime;
		const nextLine = lines[i + 1];
		if (nextLine?.isBG) nextLine.startTime = line.startTime;
		if (hasPrevLine) if (originalStartTime < prevMainGroupEndTime && originalEndTime > prevMainGroupStartTime) {
			prevMainGroupStartTime = Math.min(prevMainGroupStartTime, originalStartTime);
			prevMainGroupEndTime = Math.max(prevMainGroupEndTime, originalEndTime);
		} else {
			prevMainGroupStartTime = originalStartTime;
			prevMainGroupEndTime = originalEndTime;
		}
		else {
			prevMainGroupStartTime = originalStartTime;
			prevMainGroupEndTime = originalEndTime;
		}
		prevLineStartTime = originalStartTime;
		prevLineEndTime = originalEndTime;
		hasPrevLine = true;
	}
}
/**
* 优化歌词行的展示效果
*
* 注意会直接原地修改入参，确保你已经提前深克隆了歌词行数组
* @param lines 歌词行数组
* @param options 优化的可选配置，默认全部开启
*/
function optimizeLyricLines(lines, options) {
	const config = {
		...DEFAULT_OPTIMIZE_OPTIONS,
		...options
	};
	if (config.normalizeSpaces) normalizeSpaces(lines);
	if (config.resetLineTimestamps) resetLineTimestamps(lines);
	if (config.convertExcessiveBackgroundLines) convertExcessiveBackgroundLines(lines);
	if (config.syncMainAndBackgroundLines) syncMainAndBackgroundLines(lines);
	if (config.cleanUnintentionalOverlaps) cleanUnintentionalOverlaps(lines);
	if (config.tryAdvanceStartTime) tryAdvanceStartTime(lines);
}
//#endregion
//#region src/lyric-player/dom/interlude-dots.ts
function easeInOutBack(x) {
	const c2 = 1.70158 * 1.525;
	return x < .5 ? (2 * x) ** 2 * ((c2 + 1) * 2 * x - c2) / 2 : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}
function easeOutExpo(x) {
	return x === 1 ? 1 : 1 - 2 ** (-10 * x);
}
var InterludeDots = class {
	element = document.createElement("div");
	dot0 = document.createElement("span");
	dot1 = document.createElement("span");
	dot2 = document.createElement("span");
	left = 0;
	top = 0;
	playing = true;
	lastStyle = "";
	currentInterlude;
	currentTime = 0;
	targetBreatheDuration = 1500;
	constructor() {
		this.element.className = lyric_player_module_default.interludeDots;
		this.element.appendChild(this.dot0);
		this.element.appendChild(this.dot1);
		this.element.appendChild(this.dot2);
	}
	getElement() {
		return this.element;
	}
	setTransform(left = this.left, top = this.top) {
		this.left = left;
		this.top = top;
		this.update();
	}
	setInterlude(interlude) {
		this.currentInterlude = interlude;
		this.currentTime = interlude?.[0] ?? 0;
		if (interlude) this.element.classList.add(lyric_player_module_default.enabled);
		else this.element.classList.remove(lyric_player_module_default.enabled);
	}
	pause() {
		this.playing = false;
		this.element.classList.remove(lyric_player_module_default.playing);
	}
	resume() {
		this.playing = true;
		this.element.classList.add(lyric_player_module_default.playing);
	}
	update(delta = 0) {
		if (!this.playing) return;
		this.currentTime += delta;
		let curStyle = "";
		curStyle += `transform:translate(${this.left.toFixed(2)}px, ${this.top.toFixed(2)}px)`;
		if (this.currentInterlude) {
			const interludeDuration = this.currentInterlude[1] - this.currentInterlude[0];
			const currentDuration = this.currentTime - this.currentInterlude[0];
			if (currentDuration <= interludeDuration) {
				const breatheDuration = interludeDuration / Math.ceil(interludeDuration / this.targetBreatheDuration);
				let scale = 1;
				let globalOpacity = 1;
				scale *= Math.sin(1.5 * Math.PI - currentDuration / breatheDuration * 2) / 20 + 1;
				if (currentDuration < 2e3) scale *= easeOutExpo(currentDuration / 2e3);
				if (currentDuration < 500) globalOpacity = 0;
				else if (currentDuration < 1e3) globalOpacity *= (currentDuration - 500) / 500;
				if (interludeDuration - currentDuration < 750) scale *= 1 - easeInOutBack((750 - (interludeDuration - currentDuration)) / 750 / 2);
				if (interludeDuration - currentDuration < 375) globalOpacity *= clamp01((interludeDuration - currentDuration) / 375);
				const dotsDuration = clampPositive(interludeDuration - 750);
				scale = clampPositive(scale) * .7;
				curStyle += ` scale(${scale})`;
				const dot0Opacity = clamp(.25, currentDuration * 3 / dotsDuration * .75, 1);
				const dot1Opacity = clamp(.25, (currentDuration - dotsDuration / 3) * 3 / dotsDuration * .75, 1);
				const dot2Opacity = clamp(.25, (currentDuration - dotsDuration / 3 * 2) * 3 / dotsDuration * .75, 1);
				this.dot0.style.opacity = `${clamp01(globalOpacity * dot0Opacity)}`;
				this.dot1.style.opacity = `${clamp01(globalOpacity * dot1Opacity)}`;
				this.dot2.style.opacity = `${clamp01(globalOpacity * dot2Opacity)}`;
			} else {
				curStyle += " scale(0)";
				this.dot0.style.opacity = "0";
				this.dot1.style.opacity = "0";
				this.dot2.style.opacity = "0";
			}
			curStyle += ";";
			if (this.lastStyle !== curStyle) {
				this.element.setAttribute("style", curStyle);
				this.lastStyle = curStyle;
			}
		}
	}
	dispose() {
		this.element.remove();
	}
};
//#endregion
//#region src/utils/schedule.ts
const measureTasks = [];
const mutateTasks = [];
let scheduled = false;
function onFlush() {
	let tmp = mutateTasks.shift();
	while (tmp) {
		try {
			tmp.resolve(tmp.task());
		} catch (error) {
			tmp.reject(error);
		}
		tmp = mutateTasks.shift();
	}
	tmp = measureTasks.shift();
	while (tmp) {
		try {
			tmp.resolve(tmp.task());
		} catch (error) {
			tmp.reject(error);
		}
		tmp = measureTasks.shift();
	}
	scheduled = false;
}
function scheduleFlush() {
	if (!scheduled) {
		scheduled = true;
		requestAnimationFrame(onFlush);
	}
}
function measure(callback) {
	const task = {
		task: callback,
		resolve: () => {},
		reject: () => {}
	};
	const promise = new Promise((resolve, reject) => {
		task.resolve = resolve;
		task.reject = reject;
	});
	measureTasks.push(task);
	scheduleFlush();
	return promise;
}
//#endregion
//#region src/utils/derivative.ts
function derivative(f) {
	const h = .001;
	return (x) => (f(x + h) - f(x - h)) / (2 * h);
}
function getVelocity(f) {
	return derivative(f);
}
//#endregion
//#region src/utils/spring.ts
var Spring = class {
	currentPosition = 0;
	targetPosition = 0;
	currentTime = 0;
	params = {};
	currentSolver;
	getV;
	getV2;
	queueParams;
	queuePosition;
	constructor(currentPosition = 0) {
		this.targetPosition = currentPosition;
		this.currentPosition = this.targetPosition;
		this.currentSolver = () => this.targetPosition;
		this.getV = () => 0;
		this.getV2 = () => 0;
	}
	resetSolver() {
		const curV = this.getV(this.currentTime);
		this.currentTime = 0;
		this.currentSolver = solveSpring(this.currentPosition, curV, this.targetPosition, 0, this.params);
		this.getV = getVelocity(this.currentSolver);
		this.getV2 = getVelocity(this.getV);
	}
	arrived() {
		return Math.abs(this.targetPosition - this.currentPosition) < .01 && this.getV(this.currentTime) < .01 && this.getV2(this.currentTime) < .01 && this.queueParams === void 0 && this.queuePosition === void 0;
	}
	setPosition(targetPosition) {
		this.targetPosition = targetPosition;
		this.currentPosition = targetPosition;
		this.currentSolver = () => this.targetPosition;
		this.getV = () => 0;
		this.getV2 = () => 0;
	}
	update(delta = 0) {
		this.currentTime += delta;
		this.currentPosition = this.currentSolver(this.currentTime);
		if (this.queueParams) {
			this.queueParams.time -= delta;
			if (this.queueParams.time <= 0) this.updateParams({ ...this.queueParams });
		}
		if (this.queuePosition) {
			this.queuePosition.time -= delta;
			if (this.queuePosition.time <= 0) this.setTargetPosition(this.queuePosition.position);
		}
		if (this.arrived()) this.setPosition(this.targetPosition);
	}
	updateParams(params, delay = 0) {
		if (delay > 0) this.queueParams = {
			...this.queuePosition ?? {},
			...params,
			time: delay
		};
		else {
			this.queuePosition = void 0;
			this.params = {
				...this.params,
				...params
			};
			this.resetSolver();
		}
	}
	setTargetPosition(targetPosition, delay = 0) {
		if (delay > 0) this.queuePosition = {
			...this.queuePosition ?? {},
			position: targetPosition,
			time: delay
		};
		else {
			this.queuePosition = void 0;
			this.targetPosition = targetPosition;
			this.resetSolver();
		}
	}
	getCurrentPosition() {
		return this.currentPosition;
	}
};
function solveSpring(from, velocity, to, delay = 0, params) {
	const soft = params?.soft ?? false;
	const stiffness = params?.stiffness ?? 100;
	const damping = params?.damping ?? 10;
	const mass = params?.mass ?? 1;
	const delta = to - from;
	if (soft || 1 <= damping / (2 * Math.sqrt(stiffness * mass))) {
		const angular_frequency = -Math.sqrt(stiffness / mass);
		const leftover = -angular_frequency * delta - velocity;
		return (t) => {
			t -= delay;
			if (t < 0) return from;
			return to - (delta + t * leftover) * Math.E ** (t * angular_frequency);
		};
	}
	const damping_frequency = Math.sqrt(4 * mass * stiffness - damping ** 2);
	const leftover = (damping * delta - 2 * mass * velocity) / damping_frequency;
	const dfm = .5 * damping_frequency / mass;
	const dm = -(.5 * damping) / mass;
	return (t) => {
		t -= delay;
		if (t < 0) return from;
		return to - (Math.cos(t * dfm) * delta + Math.sin(t * dfm) * leftover) * Math.E ** (t * dm);
	};
}
//#endregion
//#region src/lyric-player/base/bottom-line.ts
var BottomLineEl = class {
	element = document.createElement("div");
	left = 0;
	top = 0;
	delay = 0;
	lineSize = [0, 0];
	lineTransforms = {
		posX: new Spring(0),
		posY: new Spring(0)
	};
	isFocused = false;
	blur = 0;
	constructor(lyricPlayer) {
		this.lyricPlayer = lyricPlayer;
		this.element.setAttribute("class", `${lyric_player_module_default.lyricLine} ${lyric_player_module_default.bottomLine}`);
		this.element.dataset.bottomLine = "true";
		this.rebuildStyle();
	}
	async measureSize() {
		return await measure(() => [this.element.clientWidth, this.element.clientHeight]);
	}
	lastStyle = "";
	show() {
		this.rebuildStyle();
	}
	hide() {
		this.rebuildStyle();
	}
	setFocused(focused) {
		if (this.isFocused !== focused) {
			this.isFocused = focused;
			if (focused) this.element.dataset.focused = "true";
			else delete this.element.dataset.focused;
		}
	}
	rebuildStyle() {
		let style = `transform:translate(${this.lineTransforms.posX.getCurrentPosition().toFixed(2)}px,${this.lineTransforms.posY.getCurrentPosition().toFixed(2)}px);`;
		if (!this.lyricPlayer.getEnableSpring() && this.isInSight) style += `transition-delay:${this.delay}ms;`;
		style += `filter:blur(${Math.min(5, this.blur)}px);`;
		if (style !== this.lastStyle) {
			this.lastStyle = style;
			this.element.setAttribute("style", style);
		}
	}
	getElement() {
		return this.element;
	}
	setTransform(left = this.left, top = this.top, blur = 0, force = false, delay = 0) {
		this.left = left;
		this.top = top;
		this.delay = delay * 1e3 | 0;
		if (force || !this.lyricPlayer.getEnableSpring()) {
			this.blur = Math.min(32, blur);
			if (force) this.element.classList.add(lyric_player_module_default.tmpDisableTransition);
			this.lineTransforms.posX.setPosition(left);
			this.lineTransforms.posY.setPosition(top);
			if (!this.lyricPlayer.getEnableSpring()) this.show();
			else this.rebuildStyle();
			if (force) requestAnimationFrame(() => {
				this.element.classList.remove(lyric_player_module_default.tmpDisableTransition);
			});
		} else {
			this.blur = Math.min(5, blur);
			this.lineTransforms.posX.setTargetPosition(left, delay);
			this.lineTransforms.posY.setTargetPosition(top, delay);
		}
	}
	update(delta = 0) {
		if (!this.lyricPlayer.getEnableSpring()) return;
		this.lineTransforms.posX.update(delta);
		this.lineTransforms.posY.update(delta);
		if (this.isInSight) this.show();
		else this.hide();
	}
	get isInSight() {
		const l = this.lineTransforms.posX.getCurrentPosition();
		const t = this.lineTransforms.posY.getCurrentPosition();
		const r = l + this.lineSize[0];
		const b = t + this.lineSize[1];
		const pr = this.lyricPlayer.size[0];
		const pb = this.lyricPlayer.size[1];
		return !(l > pr || t > pb || r < 0 || b < 0);
	}
	dispose() {
		this.element.remove();
	}
};
//#endregion
//#region src/lyric-player/base/consts.ts
/** 歌词中不雅用语的掩码模式 */
const MaskObsceneWordsMode = {
	/** 禁用任何不雅用语掩码 */
	Disabled: "",
	/** 完全掩码所有不雅用语 */
	FullMask: "full-mask",
	/** 保留首尾字符，屏蔽中间字符 */
	PartialMask: "partial-mask"
};
/**
* 歌词行的渲染模式
* @internal
*/
const LyricLineRenderMode = {
	SOLID: 0,
	GRADIENT: 1
};
/** 布局对齐锚点 */
const LayoutAlignAnchor = {
	Top: "top",
	Center: "center",
	Bottom: "bottom"
};
//#endregion
//#region src/lyric-player/base/layout.ts
/**
* 根据当前时间与当前目标行，计算当前是否处于某个可展示的间奏区间。
*
* 仅识别时间轴上的间奏空档，不涉及具体 DOM 元素的创建与摆放。
* 若当前不应展示间奏动画，则返回 `undefined`。
*/
function computeCurrentInterlude(input) {
	const currentTime = input.currentTime + 20;
	const currentIndex = input.scrollToIndex;
	const groups = input.currentGroups;
	const checkGap = (k) => {
		if (k < -1 || k >= groups.length - 1) return void 0;
		const prevGroup = k === -1 ? null : groups[k];
		const nextGroup = groups[k + 1];
		const gapStart = prevGroup ? prevGroup.endTime : 0;
		const gapEnd = Math.max(gapStart, nextGroup.startTime - 250);
		if (gapEnd - gapStart < 4e3) return void 0;
		if (gapEnd > currentTime && gapStart < currentTime) return {
			startTime: Math.max(gapStart, currentTime),
			endTime: gapEnd,
			anchorLineIndex: k,
			isNextDuet: nextGroup.mainLine.getLine().isDuet
		};
	};
	return checkGap(currentIndex - 1) || checkGap(currentIndex) || checkGap(currentIndex + 1);
}
/**
* 根据当前播放上下文计算歌词纵向滚动动画的弹簧参数。
*
* 其策略为：
* - seeking 或间奏时使用更稳定的固定参数
* - 普通播放时根据相邻歌词的时间间隔动态调整 stiffness / damping
*/
function computeLinePosYSpringParams(input) {
	const { enabled, currentGroups, scrollToIndex, isSeeking, isInterludeActive } = input;
	if (!enabled || currentGroups.length === 0) return { shouldUpdate: false };
	if (isSeeking || isInterludeActive) return {
		shouldUpdate: true,
		params: {
			stiffness: 90,
			damping: 15
		}
	};
	const currentGroup = currentGroups[scrollToIndex];
	const prevGroup = currentGroups[scrollToIndex - 1];
	if (!currentGroup || !prevGroup) return { shouldUpdate: false };
	const interval = currentGroup.startTime - prevGroup.startTime;
	const MIN_INTERVAL = 100;
	const MAX_INTERVAL = 800;
	const clampedInterval = clamp(interval, MIN_INTERVAL, MAX_INTERVAL);
	const MAX_STIFFNESS = 220;
	const MIN_STIFFNESS = 170;
	let ratio = 1 - (clampedInterval - MIN_INTERVAL) / (MAX_INTERVAL - MIN_INTERVAL);
	ratio = ratio ** .2;
	const targetStiffness = MIN_STIFFNESS + ratio * (MAX_STIFFNESS - MIN_STIFFNESS);
	return {
		shouldUpdate: true,
		params: {
			stiffness: targetStiffness,
			damping: Math.sqrt(targetStiffness) * 2.2
		}
	};
}
/**
* 计算一组歌词在当前布局中的视觉呈现参数。
*
* 根据播放状态、缓冲状态、布局模式与间奏信息，
* 生成一组歌词最终应使用的活跃状态、不透明度与模糊值。
*/
function computeGroupPresentation(input) {
	const { groupIndex, scrollToIndex, latestIndex, hasBuffered, hidePassedLines, isPlaying, isNonDynamic, enableBlur, isUserScrolling, isCompact, interlude } = input;
	const isActive = hasBuffered || groupIndex >= scrollToIndex && groupIndex < latestIndex;
	const blurLevel = computeLineBlur({
		enableBlur,
		isUserScrolling,
		isActive,
		itemIndex: groupIndex,
		scrollToIndex,
		latestIndex,
		isCompact
	});
	let targetOpacity;
	if (hidePassedLines) if (groupIndex < (interlude ? interlude.anchorLineIndex + 1 : scrollToIndex) && isPlaying) targetOpacity = 1e-4;
	else if (hasBuffered) targetOpacity = .85;
	else targetOpacity = isNonDynamic ? .2 : 1;
	else if (hasBuffered) targetOpacity = .85;
	else targetOpacity = isNonDynamic ? .2 : 1;
	return {
		isActive,
		targetOpacity,
		blurLevel
	};
}
/**
* 计算一行歌词在当前布局中的模糊等级。
*
* 越远离当前对齐区域的歌词会得到更高的模糊值；
* 活跃行、滚动交互中或关闭模糊效果时返回 `0`。
*/
function computeLineBlur(input) {
	const { enableBlur, isUserScrolling, isActive, itemIndex, scrollToIndex, latestIndex, isCompact } = input;
	if (!enableBlur || isUserScrolling || isActive) return 0;
	let blurLevel = 1;
	if (itemIndex < scrollToIndex) blurLevel += Math.abs(scrollToIndex - itemIndex) + 1;
	else blurLevel += Math.abs(itemIndex - Math.max(scrollToIndex, latestIndex));
	return isCompact ? blurLevel * .8 : blurLevel;
}
//#endregion
//#region src/lyric-player/base/scroll.ts
/**
* 将滚动偏移量限制在当前允许的滚动边界内。
*
* 当手势滚动、滚轮滚动或惯性滚动更新了 {@link PlayerScrollState.scrollOffset}
* 后，应调用本函数以避免视图越界。
*/
function clampPlayerScrollOffset(scrollState) {
	scrollState.scrollOffset = clamp(scrollState.scrollOffset, scrollState.scrollBoundary.minOffset, scrollState.scrollBoundary.maxOffset);
}
/**
* 重置滚动状态到未发生用户滚动时的初始状态。
*
* 本函数会清除当前偏移，并结束“已滚动”与“正在滚动”的标记；
* **不会清理**外部持有的计时器或事件监听器。
*/
function resetPlayerScrollState(scrollState) {
	scrollState.isScrolled = false;
	scrollState.scrollOffset = 0;
	scrollState.isUserScrolling = false;
}
/**
* 向指定元素挂载歌词滚动相关的交互处理器。
*
* 该函数会处理：
* - 触摸拖拽滚动
* - 触摸结束后的惯性滚动
* - 滚轮滚动
* - 轻触时的点击透传
*
* 只更新 {@link PlayerScrollState} 并通过回调通知宿主执行布局或其它副作用，
* 不直接依赖具体的播放器类实现。
*/
function attachPlayerScrollHandlers(element, scrollState, callbacks) {
	let startScrollY = 0;
	let startTouchPosY = 0;
	let startTouchStartX = 0;
	let startTouchStartY = 0;
	let lastMoveY = 0;
	let startScrollTime = 0;
	let scrollSpeed = 0;
	let curScrollId = 0;
	element.addEventListener("touchstart", (evt) => {
		if (callbacks.onBeginScroll()) {
			scrollState.isUserScrolling = true;
			evt.preventDefault();
			startScrollY = scrollState.scrollOffset;
			startTouchPosY = evt.touches[0].screenY;
			lastMoveY = startTouchPosY;
			startTouchStartX = evt.touches[0].screenX;
			startTouchStartY = evt.touches[0].screenY;
			startScrollTime = Date.now();
			scrollSpeed = 0;
			callbacks.onLayout(true, true);
		}
	});
	element.addEventListener("touchmove", (evt) => {
		if (callbacks.onBeginScroll()) {
			evt.preventDefault();
			const currentY = evt.touches[0].screenY;
			const deltaY = currentY - startTouchPosY;
			scrollState.scrollOffset = startScrollY - deltaY;
			clampPlayerScrollOffset(scrollState);
			const now = Date.now();
			const dt = now - startScrollTime;
			if (dt > 0) scrollSpeed = (currentY - lastMoveY) / dt;
			lastMoveY = currentY;
			startScrollTime = now;
			callbacks.onLayout(true, true);
		}
	});
	element.addEventListener("touchend", (evt) => {
		if (callbacks.onBeginScroll()) {
			evt.preventDefault();
			const touch = evt.changedTouches[0];
			const moveX = Math.abs(touch.screenX - startTouchStartX);
			const moveY = Math.abs(touch.screenY - startTouchStartY);
			if (moveX < 10 && moveY < 10) {
				const target = document.elementFromPoint(touch.clientX, touch.clientY);
				if (target instanceof HTMLElement && callbacks.containsTarget(target)) callbacks.clickTarget(target);
				scrollState.isUserScrolling = false;
				callbacks.onEndScroll();
				return;
			}
			startTouchPosY = 0;
			const scrollId = ++curScrollId;
			if (Math.abs(scrollSpeed) < .1) scrollSpeed = 0;
			let lastFrameTime = performance.now();
			const onScrollFrame = (time) => {
				if (scrollId !== curScrollId) return;
				const dt = time - lastFrameTime;
				lastFrameTime = time;
				if (dt <= 0 || dt > 100) {
					requestAnimationFrame(onScrollFrame);
					return;
				}
				if (Math.abs(scrollSpeed) > .05) {
					scrollState.scrollOffset -= scrollSpeed * dt;
					clampPlayerScrollOffset(scrollState);
					const frictionFactor = .95 ** (dt / 16);
					scrollSpeed *= frictionFactor;
					callbacks.onLayout(true, true);
					requestAnimationFrame(onScrollFrame);
				} else {
					scrollState.isUserScrolling = false;
					callbacks.onEndScroll();
				}
			};
			requestAnimationFrame(onScrollFrame);
		} else scrollState.isUserScrolling = false;
	});
	element.addEventListener("wheel", (evt) => {
		if (callbacks.onBeginScroll()) {
			evt.preventDefault();
			if (evt.deltaMode === evt.DOM_DELTA_PIXEL) {
				scrollState.scrollOffset += evt.deltaY;
				clampPlayerScrollOffset(scrollState);
				callbacks.onLayout(true, false);
			} else {
				scrollState.scrollOffset += evt.deltaY * 50;
				clampPlayerScrollOffset(scrollState);
				callbacks.onLayout(false, false);
			}
		}
	}, { passive: false });
}
//#endregion
//#region src/utils/eq-set.ts
const eqSet = (xs, ys) => xs.size === ys.size && [...xs].every((x) => ys.has(x));
//#endregion
//#region src/lyric-player/base/timeline.ts
/**
* 计算指定时间点的热行/缓冲行状态转移的纯函数。其行为包括：
*
* - 根据当前时间和已有的热行状态，计算出新的热行状态，并返回应新增的热行 ID 和应移除的热行 ID
* - 根据新的热行状态和已有的缓冲行状态，计算出应移除的缓冲行 ID
*/
function computePlayerTimeState(input) {
	const { time, currentGroups, timelineState: { hotGroups, bufferedGroups } } = input;
	const nextHotGroups = new Set(hotGroups);
	const addedIds = /* @__PURE__ */ new Set();
	const removedHotIds = /* @__PURE__ */ new Set();
	const removedBufferedIds = /* @__PURE__ */ new Set();
	for (const lastHotId of hotGroups) {
		const group = currentGroups[lastHotId];
		if (!group || time < group.startTime || group.endTime <= time) {
			nextHotGroups.delete(lastHotId);
			removedHotIds.add(lastHotId);
		}
	}
	for (let id = 0; id < currentGroups.length; id++) {
		const group = currentGroups[id];
		if (!group) continue;
		if (group.startTime <= time && group.endTime > time && !nextHotGroups.has(id)) {
			nextHotGroups.add(id);
			addedIds.add(id);
		}
	}
	for (const id of bufferedGroups) if (!nextHotGroups.has(id)) removedBufferedIds.add(id);
	return {
		nextHotGroups,
		addedIds,
		removedHotIds,
		removedBufferedIds
	};
}
/**
* 在 seeking 场景下，根据当前时间选出应对齐滚动到的目标行索引。
*
* 若当前仍存在缓冲行，则优先对齐到最靠前的缓冲行；
* 否则对齐到第一条开始时间不小于当前时间的歌词行。
*/
function pickScrollToIndexForSeek(time, currentGroups, bufferedGroups) {
	if (bufferedGroups.size > 0) return Math.min(...bufferedGroups);
	const foundIndex = currentGroups.findIndex((group) => group.startTime >= time);
	return foundIndex === -1 ? currentGroups.length : foundIndex;
}
/**
* 提交时间线状态转移的纯函数。
*
* 把一次时间线状态转移写回 {@link PlayerTimelineState}，
* 并返回一份供宿主执行的副作用应用计划，例如启用/禁用哪些歌词行、
* 是否需要重置用户滚动状态、是否需要触发布局。
*/
function commitPlayerTimeState(input) {
	const { timelineState, time, currentGroups, hasBottomContent, stateResult } = input;
	const { addedIds, removedHotIds, removedBufferedIds } = stateResult;
	const { isSeeking } = timelineState;
	timelineState.currentTime = time;
	timelineState.hotGroups = stateResult.nextHotGroups;
	let shouldLayout = false;
	let shouldResetScroll = false;
	const groupsToEnable = [];
	const groupsToDisable = /* @__PURE__ */ new Set();
	if (isSeeking) {
		timelineState.bufferedGroups = new Set([...timelineState.hotGroups]);
		timelineState.scrollToIndex = pickScrollToIndexForSeek(time, currentGroups, timelineState.bufferedGroups);
		for (const id of removedHotIds) groupsToDisable.add(id);
		for (const id of timelineState.hotGroups) groupsToEnable.push(id);
		for (const id of removedBufferedIds) groupsToDisable.add(id);
		shouldResetScroll = true;
		shouldLayout = true;
	} else if (addedIds.size > 0) {
		for (const id of addedIds) {
			timelineState.bufferedGroups.add(id);
			groupsToEnable.push(id);
		}
		for (const id of removedBufferedIds) {
			timelineState.bufferedGroups.delete(id);
			groupsToDisable.add(id);
		}
		if (timelineState.bufferedGroups.size > 0) timelineState.scrollToIndex = Math.min(...timelineState.bufferedGroups);
		shouldLayout = true;
	} else if (removedBufferedIds.size > 0 && eqSet(removedBufferedIds, timelineState.bufferedGroups)) {
		for (const id of timelineState.bufferedGroups) {
			if (timelineState.hotGroups.has(id)) continue;
			timelineState.bufferedGroups.delete(id);
			groupsToDisable.add(id);
		}
		shouldLayout = true;
	}
	if (timelineState.bufferedGroups.size === 0 && currentGroups.length > 0) {
		if (time >= currentGroups[currentGroups.length - 1].endTime) {
			const targetIndex = hasBottomContent ? currentGroups.length : currentGroups.length - 1;
			if (timelineState.scrollToIndex !== targetIndex) {
				timelineState.scrollToIndex = targetIndex;
				shouldLayout = true;
			}
		}
	}
	timelineState.lastCurrentTime = time;
	return {
		shouldLayout,
		shouldResetScroll,
		groupsToEnable,
		groupsToDisable: [...groupsToDisable]
	};
}
//#endregion
//#region src/lyric-player/base/index.ts
/**
* 歌词播放器的基类，已经包含了有关歌词操作和排版的功能，
* 子类需要为其实现对应的显示展示操作
*/
var LyricPlayerBase = class extends EventTarget {
	element = document.createElement("div");
	/** 播放时间线状态 */
	timelineState = {
		currentTime: 0,
		lastCurrentTime: 0,
		hotGroups: /* @__PURE__ */ new Set(),
		bufferedGroups: /* @__PURE__ */ new Set(),
		scrollToIndex: 0,
		isSeeking: false,
		isPlaying: true,
		initialLayoutFinished: false
	};
	/** @internal */
	lyricGroupElementMap = /* @__PURE__ */ new WeakMap();
	currentLyricLines = [];
	processedLines = [];
	lyricLinesIndexes = /* @__PURE__ */ new WeakMap();
	isNonDynamic = false;
	hasDuetLine = false;
	disableSpring = false;
	layoutState = {
		interludeDotsSize: [0, 0],
		targetAlignIndex: 0,
		lastInterludeState: false,
		alignAnchor: LayoutAlignAnchor.Center,
		alignPosition: .35,
		overscanPx: 300
	};
	interludeDots = new InterludeDots();
	bottomLine = new BottomLineEl(this);
	enableBlur = true;
	enableScale = true;
	maskObsceneWords = MaskObsceneWordsMode.Disabled;
	maskObsceneWordChar = "*";
	hidePassedLines = false;
	scrollState = {
		scrollBoundary: {
			minOffset: 0,
			maxOffset: 0
		},
		scrollOffset: 0,
		allowScroll: true,
		isScrolled: false,
		isUserScrolling: false
	};
	currentLyricGroups = [];
	lyricGroupSize = /* @__PURE__ */ new WeakMap();
	size = [0, 0];
	isPageVisible = true;
	optimizeOptions = {};
	/** 是否强制让背景人声行始终后置（即始终在主歌词下方显示，不前置背景人声） */
	alwaysPostpositionBackground = false;
	posXSpringParams = {
		mass: 1,
		damping: 10,
		stiffness: 100
	};
	posYSpringParams = {
		mass: .9,
		damping: 15,
		stiffness: 90
	};
	scaleSpringParams = {
		mass: 2,
		damping: 25,
		stiffness: 100
	};
	scaleForBGSpringParams = {
		mass: 1,
		damping: 20,
		stiffness: 50
	};
	onPageShow = () => {
		this.isPageVisible = true;
		this.setCurrentTime(this.timelineState.currentTime, true);
	};
	onPageHide = () => {
		this.isPageVisible = false;
	};
	scrolledHandler;
	/** @internal */
	resizeObserver = new ResizeObserver(((entries) => {
		let shouldRelayout = false;
		let shouldRebuildPlayerStyle = false;
		for (const entry of entries) if (entry.target === this.element) {
			const rect = entry.contentRect;
			this.size[0] = rect.width;
			this.size[1] = rect.height;
			shouldRebuildPlayerStyle = true;
		} else if (entry.target === this.interludeDots.getElement()) {
			this.layoutState.interludeDotsSize[0] = entry.target.clientWidth;
			this.layoutState.interludeDotsSize[1] = entry.target.clientHeight;
			shouldRelayout = true;
		} else if (entry.target === this.bottomLine.getElement()) {
			const newSize = [entry.target.clientWidth, entry.target.clientHeight];
			const oldSize = this.bottomLine.lineSize;
			if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
				this.bottomLine.lineSize = newSize;
				shouldRelayout = true;
			}
		} else {
			const groupObj = this.lyricGroupElementMap.get(entry.target);
			if (groupObj) {
				const newSize = [entry.target.clientWidth, entry.target.clientHeight];
				const oldSize = this.lyricGroupSize.get(groupObj) ?? [0, 0];
				if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
					this.lyricGroupSize.set(groupObj, newSize);
					groupObj.onLineSizeChange(newSize);
					shouldRelayout = true;
				}
			}
		}
		if (shouldRelayout) this.calcLayout(true);
		if (shouldRebuildPlayerStyle) this.onResize();
	}));
	wordFadeWidth = .5;
	constructor(element) {
		super();
		if (element) this.element = element;
		this.element.classList.add("amll-lyric-player");
		this.resizeObserver.observe(this.element);
		this.resizeObserver.observe(this.interludeDots.getElement());
		this.element.appendChild(this.interludeDots.getElement());
		this.element.appendChild(this.bottomLine.getElement());
		this.interludeDots.setTransform(0, 200);
		window.addEventListener("pageshow", this.onPageShow);
		window.addEventListener("pagehide", this.onPageHide);
		attachPlayerScrollHandlers(this.element, this.scrollState, {
			onBeginScroll: () => this.beginScrollHandler(),
			onEndScroll: () => this.endScrollHandler(),
			onLayout: (sync, force) => this.calcLayout(sync, force),
			containsTarget: (target) => this.element.contains(target),
			clickTarget: (target) => target.click()
		});
	}
	beginScrollHandler() {
		const allowed = this.scrollState.allowScroll;
		if (allowed) {
			this.scrollState.isScrolled = true;
			clearTimeout(this.scrolledHandler);
			this.scrolledHandler = setTimeout(() => {
				this.scrollState.isScrolled = false;
				this.scrollState.scrollOffset = 0;
			}, 5e3);
		}
		return allowed;
	}
	endScrollHandler() {}
	/**
	* 设置文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5，即一个全角字符的一半宽度
	*
	* 如果要模拟 Apple Music for Android 的效果，可以设置为 1
	*
	* 如果要模拟 Apple Music for iPad 的效果，可以设置为 0.5
	*
	* 如果想要近乎禁用渐变效果，可以设置成非常接近 0 的小数（例如 `0.0001` ），但是**不可以为 0**
	*
	* @param value 需要设置的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5
	*/
	setWordFadeWidth(value = .5) {
		this.wordFadeWidth = Math.max(1e-4, value);
	}
	/**
	* 是否启用歌词行缩放效果，默认启用
	*
	* 如果启用，非选中的歌词行会轻微缩小以凸显当前播放歌词行效果
	*
	* 此效果对性能影响微乎其微，推荐启用
	* @param enable 是否启用歌词行缩放效果
	*/
	setEnableScale(enable = true) {
		this.enableScale = enable;
		this.calcLayout();
	}
	/**
	* 获取当前是否启用了歌词行缩放效果
	* @returns 是否启用歌词行缩放效果
	*/
	getEnableScale() {
		return this.enableScale;
	}
	/**
	* 获取当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
	* @returns 当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
	*/
	getWordFadeWidth() {
		return this.wordFadeWidth;
	}
	setIsSeeking(isSeeking) {
		this.timelineState.isSeeking = isSeeking;
	}
	/**
	* 设置是否隐藏已经播放过的歌词行，默认不隐藏
	* @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
	*/
	setHidePassedLines(hide) {
		this.hidePassedLines = hide;
		this.calcLayout();
	}
	/**
	* 设置是否启用歌词行的模糊效果
	* @param enable 是否启用
	*/
	setEnableBlur(enable) {
		if (this.enableBlur === enable) return;
		this.enableBlur = enable;
		this.calcLayout();
	}
	/**
	* 设置歌词中不雅用语的掩码模式
	* @param mode 掩码模式
	* @see {@link MaskObsceneWordsMode}
	*/
	setMaskObsceneWords(mode) {
		if (this.maskObsceneWords === mode) return;
		this.maskObsceneWords = mode;
		this.rebuildLyricLines();
		this.calcLayout();
	}
	/**
	* 设置不雅用语掩码使用的字符，默认为 `*`
	* @param char 单个字符，用于替换不雅用语中的字符
	*/
	setMaskObsceneWordChar(char) {
		const c = char.charAt(0) || "*";
		if (this.maskObsceneWordChar === c) return;
		this.maskObsceneWordChar = c;
		if (this.maskObsceneWords !== MaskObsceneWordsMode.Disabled) {
			this.rebuildLyricLines();
			this.calcLayout();
		}
	}
	rebuildLyricLines() {
		for (const group of this.currentLyricGroups) group.rebuildAllLines();
	}
	/**
	* 根据当前配置处理不雅用语单词
	* @param word 单词对象
	* @internal
	*/
	processObsceneWord(word) {
		const text = word.word;
		if (!word.obscene || this.maskObsceneWords === MaskObsceneWordsMode.Disabled) return text;
		const maskChar = this.maskObsceneWordChar;
		if (this.maskObsceneWords === MaskObsceneWordsMode.FullMask) return text.replace(/\S/g, maskChar);
		if (this.maskObsceneWords === MaskObsceneWordsMode.PartialMask) {
			const trimmed = text.trim();
			if (trimmed.length <= 2) return text.replace(/\S/g, maskChar);
			const startPos = text.indexOf(trimmed);
			const endPos = startPos + trimmed.length - 1;
			return text.slice(0, startPos + 1) + text.slice(startPos + 1, endPos).replace(/\S/g, maskChar) + text.slice(endPos);
		}
		return text;
	}
	/**
	* 设置目标歌词行的对齐方式，默认为 `center`
	*
	* - 设置成 `top` 的话将会向目标歌词行的顶部对齐
	* - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
	* - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
	* @param alignAnchor 歌词行对齐方式，详情见函数说明
	*/
	setAlignAnchor(alignAnchor) {
		this.layoutState.alignAnchor = alignAnchor;
	}
	/**
	* 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
	* @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
	*/
	setAlignPosition(alignPosition) {
		this.layoutState.alignPosition = alignPosition;
	}
	/**
	* 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
	* @param px 像素值，默认 300
	*/
	setOverscanPx(px) {
		this.layoutState.overscanPx = clampPositive(px | 0);
	}
	/** 获取当前 overscan 像素距离 */
	getOverscanPx() {
		return this.layoutState.overscanPx;
	}
	/**
	* 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
	*
	* 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
	*
	* 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
	*/
	setEnableSpring(enable = true) {
		this.disableSpring = !enable;
		if (enable) this.element.classList.remove(lyric_player_module_default.disableSpring);
		else this.element.classList.add(lyric_player_module_default.disableSpring);
		this.calcLayout(true);
	}
	/**
	* 获取当前是否启用了物理弹簧
	* @returns 是否启用物理弹簧
	*/
	getEnableSpring() {
		return !this.disableSpring;
	}
	/**
	* 设置歌词的优化配置项，这些配置项默认全部开启
	*
	* 注意，如果在 `setLyricLines` 之后修改此配置，需要重新调用 `setLyricLines()` 才能对当前歌词生效
	* @param options 优化配置选项
	* @see {@link OptimizeLyricOptions}
	*/
	setOptimizeOptions(options) {
		this.optimizeOptions = {
			...this.optimizeOptions,
			...options
		};
	}
	/**
	* 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	* @param lines 歌词数组
	* @param initialTime 初始时间，默认为 0
	*/
	setLyricLines(lines, initialTime = 0) {
		if (process.env.NODE_ENV !== "production") console.log("设置歌词行", lines, initialTime);
		this.timelineState.initialLayoutFinished = true;
		this.timelineState.lastCurrentTime = initialTime;
		this.timelineState.currentTime = initialTime;
		this.currentLyricLines = structuredClone(lines);
		this.processedLines = structuredClone(this.currentLyricLines);
		optimizeLyricLines(this.processedLines, this.optimizeOptions);
		this.isNonDynamic = true;
		for (const line of this.processedLines) if (line.words.length > 1) {
			this.isNonDynamic = false;
			break;
		}
		this.hasDuetLine = this.processedLines.some((line) => line.isDuet);
		for (const group of this.currentLyricGroups) group.dispose();
		this.currentLyricGroups = [];
		this.interludeDots.setInterlude(void 0);
		this.timelineState.hotGroups.clear();
		this.timelineState.bufferedGroups.clear();
		if (process.env.NODE_ENV !== "production") console.log("歌词处理完成", this);
	}
	/**
	* 获取当前是否在播放
	* @returns 当前是否在播放
	*/
	getIsPlaying() {
		return this.timelineState.isPlaying;
	}
	/**
	* 设置当前播放进度，此时将会更新内部的歌词进度信息。
	*
	* 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好。
	* 调用完成后，应每帧调用 {@link update} 方法来执行歌词动画效果。**此函数本身不会触发动画效果**。
	*
	* @param time 当前播放进度，单位为毫秒
	*/
	setCurrentTime(time, isSeek = false) {
		time = Math.round(time);
		const { timelineState } = this;
		timelineState.isSeeking = Boolean(isSeek);
		timelineState.currentTime = time;
		if (!timelineState.initialLayoutFinished && !timelineState.isSeeking) return;
		const stateResult = computePlayerTimeState({
			time,
			currentGroups: this.currentLyricGroups,
			timelineState
		});
		const hasBottomContent = this.bottomLine.getElement().innerHTML.trim().length > 0;
		const commitResult = commitPlayerTimeState({
			timelineState,
			time,
			currentGroups: this.currentLyricGroups,
			hasBottomContent,
			stateResult
		});
		for (const id of commitResult.groupsToDisable) this.currentLyricGroups[id]?.disable();
		for (const id of commitResult.groupsToEnable) this.currentLyricGroups[id]?.enable();
		if (commitResult.shouldResetScroll) this.resetScroll();
		if (commitResult.shouldLayout) this.calcLayout();
	}
	/**
	* 重新布局定位歌词行的位置，调用完成后再逐帧调用 `update`
	* 函数即可让歌词通过动画移动到目标位置。
	*
	* 函数有一个 `force` 参数，用于指定是否强制修改布局，也就是不经过动画直接调整元素位置和大小。
	*
	* 此函数还有一个 `reflow` 参数，用于指定是否需要重新计算布局
	*
	* 因为计算布局必定会导致浏览器重排布局，所以会大幅度影响流畅度和性能，故请只在以下情况下将其​设置为 true：
	*
	* 1. 歌词页面大小发生改变时（这个组件会自行处理）
	* 2. 加载了新的歌词时（不论前后歌词是否完全一样）
	* 3. 用户自行跳转了歌曲播放位置（不论距离远近）
	*
	* @param sync 是否同步执行，通常用于初始化或 Resize 时立即布局
	* @param force 是否绕过弹簧效果强制更新位置
	*/
	async calcLayout(sync = false, force = false) {
		const interlude = computeCurrentInterlude({
			currentTime: this.timelineState.currentTime,
			scrollToIndex: this.timelineState.scrollToIndex,
			currentGroups: this.currentLyricGroups
		});
		const isInterludeActive = !!interlude;
		if (this.layoutState.targetAlignIndex !== this.timelineState.scrollToIndex || this.layoutState.lastInterludeState !== isInterludeActive) {
			this.layoutState.lastInterludeState = isInterludeActive;
			const springParams = computeLinePosYSpringParams({
				enabled: this.getEnableSpring(),
				currentGroups: this.currentLyricGroups,
				scrollToIndex: this.timelineState.scrollToIndex,
				isSeeking: this.timelineState.isSeeking,
				isInterludeActive
			});
			if (springParams.shouldUpdate && springParams.params) this.setLinePosYSpringParams(springParams.params);
		}
		let curPos = -this.scrollState.scrollOffset;
		const targetAlignIndex = this.timelineState.scrollToIndex;
		let isNextDuet = false;
		if (interlude) isNextDuet = interlude.isNextDuet;
		else this.interludeDots.setInterlude(void 0);
		const dotMargin = (this.baseFontSize || 24) * .4;
		const totalInterludeHeight = this.layoutState.interludeDotsSize[1] + dotMargin * 2;
		if (interlude) {
			if (interlude.anchorLineIndex !== -1) curPos -= totalInterludeHeight;
		}
		const LINE_HEIGHT_FALLBACK = this.size[1] / 5;
		const scrollOffset = this.currentLyricGroups.slice(0, targetAlignIndex).reduce((acc, group) => acc + (this.lyricGroupSize.get(group)?.[1] ?? LINE_HEIGHT_FALLBACK), 0);
		this.scrollState.scrollBoundary.minOffset = -scrollOffset;
		curPos -= scrollOffset;
		curPos += this.size[1] * this.layoutState.alignPosition;
		const curGroup = this.currentLyricGroups[targetAlignIndex];
		this.layoutState.targetAlignIndex = targetAlignIndex;
		const isBottomFocused = targetAlignIndex === this.currentLyricGroups.length;
		this.bottomLine.setFocused(isBottomFocused);
		const targetLineHeight = curGroup ? this.lyricGroupSize.get(curGroup)?.[1] ?? LINE_HEIGHT_FALLBACK : isBottomFocused ? this.bottomLine.lineSize[1] : 0;
		if (targetLineHeight > 0) switch (this.layoutState.alignAnchor) {
			case LayoutAlignAnchor.Bottom:
				curPos -= targetLineHeight;
				break;
			case LayoutAlignAnchor.Center:
				curPos -= targetLineHeight / 2;
				break;
			case LayoutAlignAnchor.Top: break;
		}
		const latestIndex = Math.max(...this.timelineState.bufferedGroups);
		let delay = 0;
		let baseDelay = sync ? 0 : .05;
		let setDots = false;
		this.currentLyricGroups.forEach((group, i) => {
			const hasBuffered = this.timelineState.bufferedGroups.has(i);
			const shouldShowDots = interlude && i === interlude.anchorLineIndex + 1;
			if (!setDots && shouldShowDots) {
				setDots = true;
				curPos += dotMargin;
				let targetX = 0;
				if (interlude && isNextDuet) targetX = this.size[0] - this.layoutState.interludeDotsSize[0];
				this.interludeDots.setTransform(targetX, curPos);
				if (interlude) this.interludeDots.setInterlude([interlude.startTime, interlude.endTime]);
				curPos += this.layoutState.interludeDotsSize[1];
				curPos += dotMargin;
			}
			const presentation = computeGroupPresentation({
				groupIndex: i,
				scrollToIndex: this.timelineState.scrollToIndex,
				latestIndex,
				hasBuffered,
				hidePassedLines: this.hidePassedLines,
				isPlaying: this.timelineState.isPlaying,
				isNonDynamic: this.isNonDynamic,
				enableBlur: this.enableBlur,
				isUserScrolling: this.scrollState.isUserScrolling,
				isCompact: window.innerWidth <= 1024,
				interlude
			});
			group.setTransform(curPos, force, delay, presentation.isActive, presentation.targetOpacity, presentation.blurLevel);
			curPos += this.lyricGroupSize.get(group)?.[1] ?? LINE_HEIGHT_FALLBACK;
			if (curPos >= 0 && !this.timelineState.isSeeking) {
				delay += baseDelay;
				if (i >= this.timelineState.scrollToIndex) baseDelay /= 1.05;
			}
		});
		this.scrollState.scrollBoundary.maxOffset = curPos + this.scrollState.scrollOffset - this.size[1] / 2;
		const bottomIndex = this.currentLyricGroups.length;
		const finalBottomBlur = computeLineBlur({
			enableBlur: this.enableBlur,
			isUserScrolling: this.scrollState.isUserScrolling,
			isActive: isBottomFocused,
			itemIndex: bottomIndex,
			scrollToIndex: this.timelineState.scrollToIndex,
			latestIndex,
			isCompact: window.innerWidth <= 1024
		});
		this.bottomLine.setTransform(0, curPos, finalBottomBlur, force, delay);
	}
	/**
	* 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
	*
	* @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	* @deprecated 考虑到横向弹簧效果并不常见，所以这个函数将会在未来的版本中移除
	*/
	setLinePosXSpringParams(_params = {}) {}
	/**
	* 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
	*
	* @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	*/
	setLinePosYSpringParams(params = {}) {
		this.posYSpringParams = {
			...this.posYSpringParams,
			...params
		};
		this.bottomLine.lineTransforms.posY.updateParams(this.posYSpringParams);
		for (const group of this.currentLyricGroups) {
			group.posY.updateParams(this.posYSpringParams);
			group.bgSlideY.updateParams(this.posYSpringParams);
		}
	}
	/**
	* 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
	*
	* @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	*/
	setLineScaleSpringParams(params = {}) {
		this.scaleSpringParams = {
			...this.scaleSpringParams,
			...params
		};
		this.scaleForBGSpringParams = {
			...this.scaleForBGSpringParams,
			...params
		};
		for (const group of this.currentLyricGroups) {
			group.mainLine.lineTransforms.scale.updateParams(this.scaleSpringParams);
			group.bgLine?.lineTransforms.scale.updateParams(this.scaleForBGSpringParams);
		}
	}
	/**
	* 暂停部分效果演出，目前会暂停播放间奏点的动画，且将背景歌词显示出来
	*/
	pause() {
		this.interludeDots.pause();
		if (this.timelineState.isPlaying) {
			this.timelineState.isPlaying = false;
			this.calcLayout();
		}
	}
	/**
	* 恢复部分效果演出，目前会恢复播放间奏点的动画
	*/
	resume() {
		this.interludeDots.resume();
		if (!this.timelineState.isPlaying) {
			this.timelineState.isPlaying = true;
			this.calcLayout();
		}
	}
	/**
	* 更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：
	*
	* 1. 刚刚调用完设置歌词函数的时候
	* @param delta 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数）
	*/
	update(delta = 0) {
		this.bottomLine.update(delta / 1e3);
		this.interludeDots.update(delta);
	}
	onResize() {}
	/**
	* 获取一个特殊的底栏元素，默认是空白的，可以往内部添加任意元素
	*
	* 这个元素始终在歌词的底部，可以用于显示歌曲创作者等信息
	*
	* 但是请勿删除该元素，只能在内部存放元素
	*
	* @returns 一个元素，可以往内部添加任意元素
	*/
	getBottomLineElement() {
		return this.bottomLine.getElement();
	}
	/**
	* 重置用户滚动状态
	*
	* 请在用户完成滚动点击跳转歌词时调用本事件再调用 `calcLayout` 以正确滚动到目标位置
	*/
	resetScroll() {
		resetPlayerScrollState(this.scrollState);
		clearTimeout(this.scrolledHandler);
	}
	/**
	* 获取当前歌词数组
	*
	* 一般和最后调用 `setLyricLines` 给予的参数一样
	* @returns 当前歌词数组
	*/
	getLyricLines() {
		return this.currentLyricLines;
	}
	/**
	* 获取当前歌词的播放位置
	*
	* 一般和最后调用 `setCurrentTime` 给予的参数一样
	* @returns 当前播放位置
	*/
	getCurrentTime() {
		return this.timelineState.currentTime;
	}
	/**
	* 设置是否让背景人声行始终后置显示
	*
	* 默认情况下，如果背景歌词开始时间早于主歌词，会在主歌词上方展示；
	* 如果设置为 `true`，则无论时间顺序如何，背景歌词都会始终在主歌词下方展示
	* @param enable 是否启用始终后置
	*/
	setAlwaysPostpositionBackground(enable) {
		if (this.alwaysPostpositionBackground === enable) return;
		this.alwaysPostpositionBackground = enable;
		this.rebuildLyricLines();
		this.calcLayout();
	}
	/** 获取当前是否设置了让背景人声行始终后置显示 */
	getAlwaysPostpositionBackground() {
		return this.alwaysPostpositionBackground;
	}
	getElement() {
		return this.element;
	}
	dispose() {
		this.element.remove();
		window.removeEventListener("pageshow", this.onPageShow);
		window.removeEventListener("pagehide", this.onPageHide);
	}
};
//#endregion
//#region src/lyric-player/base/group.ts
var LyricLineGroupBase = class {
	posY = new Spring(0);
	bgSlideY = new Spring(-80);
	top = 0;
	delay = 0;
	isActive = false;
	opacity = 1;
	blur = 0;
	isBgFirst = false;
	constructor(mainLine, bgLine) {
		this.mainLine = mainLine;
		this.bgLine = bgLine;
	}
	get startTime() {
		return this.mainLine.getLine().startTime;
	}
	get endTime() {
		return this.mainLine.getLine().endTime;
	}
	onLineSizeChange(size) {
		this.mainLine.onLineSizeChange(size);
		this.bgLine?.onLineSizeChange(size);
	}
	setTransform(top, force, delay, isActive, opacity, blur) {
		this.top = top;
		this.delay = delay;
		this.isActive = isActive;
		this.opacity = opacity;
		this.blur = blur;
		this.setLineTransformations(force, delay);
		const enableSpring = this.lyricPlayer.getEnableSpring();
		const hiddenSlideY = (this.lyricPlayer.getAlwaysPostpositionBackground() ? false : this.isBgFirst) ? 80 : -80;
		const isPlaying = this.lyricPlayer.getIsPlaying();
		const targetBgSlideY = isActive || !isPlaying ? 0 : hiddenSlideY;
		if (force || !enableSpring) {
			this.posY.setPosition(top);
			this.bgSlideY.setPosition(targetBgSlideY);
			this.renderStyles();
		} else {
			this.posY.setTargetPosition(top, delay);
			this.bgSlideY.setTargetPosition(targetBgSlideY, delay);
		}
	}
	setLineTransformations(force, delay) {
		const enableScale = this.lyricPlayer.getEnableScale();
		const isPlaying = this.lyricPlayer.getIsPlaying();
		const renderMode = this.isActive ? LyricLineRenderMode.GRADIENT : LyricLineRenderMode.SOLID;
		const SCALE_ASPECT = enableScale ? 97 : 100;
		let mainScale = 100;
		if (!this.isActive && isPlaying) mainScale = SCALE_ASPECT;
		this.mainLine.setTransform(mainScale, 1, 0, force, delay, renderMode);
		let bgScale = 100;
		if (!this.isActive && isPlaying) bgScale = 75;
		this.bgLine?.setTransform(bgScale, 1, 0, force, delay, renderMode);
	}
	update(delta) {
		if (this.lyricPlayer.getEnableSpring()) {
			this.posY.update(delta);
			this.bgSlideY.update(delta);
			this.renderStyles();
		}
		this.mainLine.update(delta);
		this.bgLine?.update(delta);
	}
	rebuildAllLines() {
		this.mainLine.rebuildElement();
		this.bgLine?.rebuildElement();
	}
	enable(time, shouldPlay) {
		this.mainLine.enable(time, shouldPlay);
		this.bgLine?.enable(time, shouldPlay);
	}
	disable() {
		this.mainLine.disable();
		this.bgLine?.disable();
	}
	dispose() {
		this.mainLine.dispose();
		this.bgLine?.dispose();
	}
};
//#endregion
//#region src/lyric-player/dom/lyric-group.ts
var LyricLineGroup = class extends LyricLineGroupBase {
	element;
	bgWrapper;
	lastIsActive;
	constructor(lyricPlayer, mainLine) {
		super(mainLine);
		this.lyricPlayer = lyricPlayer;
		this.element = document.createElement("div");
		this.element.className = lyric_player_module_default.lyricLineWrapper;
		this.element.appendChild(mainLine.getElement());
		this.posY.setPosition(window.innerHeight * 2);
		lyricPlayer.resizeObserver.observe(this.element);
	}
	get isInSight() {
		const t = this.posY.getCurrentPosition();
		let h = this.lyricPlayer.lyricGroupSize?.get(this)?.[1];
		if (h === void 0 || h === 0) h = this.element.clientHeight || 0;
		const pb = this.lyricPlayer.size[1];
		const ov = this.lyricPlayer.getOverscanPx();
		return !(t > pb + h + ov || t < -h - ov);
	}
	show() {
		if (!this.element.parentElement) {
			const playerEl = this.lyricPlayer.getElement();
			const groups = this.lyricPlayer.currentLyricGroups;
			const myIndex = groups.indexOf(this);
			let referenceNode = null;
			if (myIndex !== -1) {
				for (let i = myIndex + 1; i < groups.length; i++) if (groups[i].element.parentElement === playerEl) {
					referenceNode = groups[i].element;
					break;
				}
			}
			playerEl.insertBefore(this.element, referenceNode);
			this.lyricPlayer.resizeObserver.observe(this.element);
		}
		this.mainLine.show();
		this.bgLine?.show();
	}
	hide() {
		if (this.element.parentElement) {
			this.lyricPlayer.resizeObserver.unobserve(this.element);
			this.element.remove();
			this.mainLine.teardownContent();
			this.bgLine?.teardownContent();
		}
	}
	update(delta) {
		if (this.isInSight) this.show();
		else this.hide();
		super.update(delta);
	}
	addBgLine(bgLine) {
		if (this.bgLine) this.bgLine.dispose();
		if (this.bgWrapper) this.bgWrapper.remove();
		this.bgLine = bgLine;
		const bgStartTime = bgLine.getLine().words[0]?.startTime ?? bgLine.getLine().startTime;
		const mainStartTime = this.mainLine.getLine().words[0]?.startTime ?? this.mainLine.getLine().startTime;
		this.isBgFirst = bgStartTime < mainStartTime;
		if (this.mainLine.getLine().isDuet) bgLine.getElement().classList.add(lyric_player_module_default.lyricDuetLine);
		this.bgWrapper = document.createElement("div");
		this.bgWrapper.className = lyric_player_module_default.bgWrapper;
		this.bgWrapper.appendChild(bgLine.getElement());
		if (!this.lyricPlayer.getAlwaysPostpositionBackground() && this.isBgFirst) {
			this.bgWrapper.classList.add(lyric_player_module_default.bgWrapperTop);
			this.element.insertBefore(this.bgWrapper, this.mainLine.getElement());
			this.bgSlideY.setPosition(80);
		} else this.element.appendChild(this.bgWrapper);
	}
	renderStyles() {
		const y = this.posY.getCurrentPosition().toFixed(1);
		this.element.style.transform = `translateY(${y}px)`;
		this.element.style.opacity = this.opacity.toString();
		this.element.style.filter = `blur(${Math.min(5, this.blur)}px)`;
		if (!this.lyricPlayer.getEnableSpring()) this.element.style.transitionDelay = `${this.delay}ms`;
		if (this.bgWrapper) {
			if (this.lastIsActive !== this.isActive) {
				this.lastIsActive = this.isActive;
				this.bgWrapper.classList.toggle(lyric_player_module_default.bgWrapperActive, this.isActive);
			}
			const slideY = this.bgSlideY.getCurrentPosition();
			const slideYStr = slideY.toFixed(1);
			const activeProgress = clamp01(1 - Math.abs(slideY) / 80);
			const scaleStr = (.8 + activeProgress * .2).toFixed(3);
			this.bgWrapper.style.transform = `translateY(${slideYStr}%) scale(${scaleStr})`;
			const shouldBgFirst = !this.lyricPlayer.getAlwaysPostpositionBackground() && this.isBgFirst;
			if (shouldBgFirst) {
				const currentMarginTop = -(this.bgWrapper.clientHeight || 0) * (1 - activeProgress);
				this.bgWrapper.style.marginTop = `${currentMarginTop.toFixed(1)}px`;
			} else this.bgWrapper.style.marginTop = "";
			const isHidden = slideYStr === (shouldBgFirst ? "80.0" : "-80.0") && !this.isActive;
			this.bgWrapper.classList.toggle(lyric_player_module_default.bgWrapperHidden, isHidden);
		}
	}
	dispose() {
		super.dispose();
		this.lyricPlayer.resizeObserver.unobserve(this.element);
		this.element.remove();
	}
};
//#endregion
//#region src/utils/is-cjk.ts
const isCJK = (char) => {
	return /^[\p{Unified_Ideograph}\u0800-\u9FFC]+$/u.test(char);
};
//#endregion
//#region src/lyric-player/base/line.ts
/**
* 所有标准歌词行的基类
* @internal
*/
var LyricLineBase = class extends EventTarget {
	top = 0;
	scale = 1;
	blur = 0;
	opacity = 1;
	delay = 0;
	lineTransforms = { scale: new Spring(100) };
	/**
	* 用于 CJK 词语边界检测的分词器
	*/
	static wordSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "word" }) : null;
	/**
	* Unicode 标准的全局 Grapheme Cluster 分词器
	* 用于正确处理 emoji、复合字符等
	*/
	static graphemeSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
	setTransform(scale = this.scale, opacity = this.opacity, blur = this.blur, _force = false, delay = 0, _mode = LyricLineRenderMode.SOLID) {
		this.scale = scale;
		this.opacity = opacity;
		this.blur = blur;
		this.delay = delay;
	}
	rebuildElement() {}
	/**
	* 判定歌词是否可以应用强调辉光效果
	*
	* 果子在对辉光效果的解释是一种强调（emphasized）效果
	*
	* 条件是一个单词时长大于等于 1s 且长度小于等于 7
	*
	* @param word 单词
	* @returns 是否可以应用强调辉光效果
	*/
	static shouldEmphasize(word) {
		if (isCJK(word.word)) return word.endTime - word.startTime >= 1e3;
		return word.endTime - word.startTime >= 1e3 && word.word.trim().length <= 7 && word.word.trim().length > 1;
	}
	dispose() {}
};
//#endregion
//#region src/utils/lyric-line-break.ts
/**
* 单个词超过容器宽度时的大惩罚倍数
*/
const OVERFLOW_PENALTY_MULTIPLIER = 1e3;
/**
* 截断 CJK 词组边界的惩罚比例
*
* 相对于容器宽度
*/
const CJK_BREAK_PENALTY_RATIO = .15;
/**
* 截断普通文本（非空格、非 CJK 词界）的惩罚比例
*/
const NORMAL_BREAK_PENALTY_RATIO = .5;
/**
* 在空格处断开的奖励比例
*/
const SPACE_BREAK_REWARD_RATIO = .4;
/**
* 在标点符号处断开的奖励比例
*
* 比空格更高以便优先一点在标点处换行
*/
const PUNCTUATION_BREAK_REWARD_RATIO = .6;
const PUNCTUATION_REGEX = /[,.;:!?，。；：！？、）】》」』’”)[\]}>~…]$/;
/**
* 计算平均行长度的断点位置
* @param children 子节点信息
* @param containerWidth 容器可用内容宽度
* @param fullText 完整的行文本
* @param segmenter 预创建的 Intl.Segmenter 分词器
* @returns 需要在其前面插入 `<br>` 的子节点索引数组，升序
*/
function calcBalancedBreaks(children, containerWidth, fullText, segmenter) {
	const n = children.length;
	if (n === 0 || containerWidth <= 0) return [];
	const cjkBoundaries = /* @__PURE__ */ new Set();
	let offset = 0;
	for (const { segment, isWordLike } of segmenter.segment(fullText)) {
		if (offset > 0 && isWordLike) {
			if ([...segment].some((ch) => isCJK(ch))) cjkBoundaries.add(offset);
		}
		offset += segment.length;
	}
	const charOffsets = new Int32Array(n + 1);
	const prefixWidth = new Float64Array(n + 1);
	for (let i = 0; i < n; i++) {
		charOffsets[i + 1] = charOffsets[i] + children[i].text.length;
		prefixWidth[i + 1] = prefixWidth[i] + children[i].width;
	}
	if (prefixWidth[n] <= containerWidth) return [];
	/**
	* dp[i] 表示将 index i 到 n-1 的节点进行排版的最小代价
	*/
	const dp = new Float64Array(n + 1).fill(Number.POSITIVE_INFINITY);
	const nextBreak = new Int32Array(n + 1).fill(-1);
	dp[n] = 0;
	const PENALTY_CJK = (containerWidth * CJK_BREAK_PENALTY_RATIO) ** 2;
	const PENALTY_NORMAL = (containerWidth * NORMAL_BREAK_PENALTY_RATIO) ** 2;
	for (let i = n - 1; i >= 0; i--) for (let j = i + 1; j <= n; j++) {
		const w = prefixWidth[j] - prefixWidth[i];
		let lineCost = 0;
		if (w > containerWidth) if (j === i + 1) lineCost = (w - containerWidth) ** 2 * OVERFLOW_PENALTY_MULTIPLIER;
		else continue;
		else lineCost = (containerWidth - w) ** 2;
		let breakPenalty = 0;
		if (j < n) {
			const prevChild = children[j - 1];
			if (PUNCTUATION_REGEX.test(prevChild.text)) breakPenalty = -((containerWidth * PUNCTUATION_BREAK_REWARD_RATIO) ** 2);
			else if (prevChild.isSpace) breakPenalty = -((containerWidth * SPACE_BREAK_REWARD_RATIO) ** 2);
			else if (cjkBoundaries.has(charOffsets[j])) breakPenalty = PENALTY_CJK;
			else breakPenalty = PENALTY_NORMAL;
		}
		const totalCost = lineCost + breakPenalty + dp[j];
		if (totalCost < dp[i]) {
			dp[i] = totalCost;
			nextBreak[i] = j;
		}
	}
	const breaks = [];
	let curr = 0;
	while (curr < n) {
		curr = nextBreak[curr];
		if (curr > 0 && curr < n) breaks.push(curr);
	}
	return breaks;
}
//#endregion
//#region src/utils/line-balancer.ts
let sharedCanvasCtx = null;
function getMeasurementContext() {
	if (!sharedCanvasCtx) sharedCanvasCtx = document.createElement("canvas").getContext("2d");
	return sharedCanvasCtx;
}
/**
* 用于平衡歌词行在换行后的各行长度
*/
var LineBalancer = class {
	isBalancing = false;
	lastBalancedContainerWidth = -1;
	constructor(mainElement) {
		this.mainElement = mainElement;
	}
	balanceLineBreaks(isNonDynamic, hasSplittedWords, wordSegmenter) {
		if (this.isBalancing || !this.mainElement) return;
		const computedStyle = getComputedStyle(this.mainElement);
		const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
		const containerWidth = this.mainElement.clientWidth - paddingLeft - paddingRight;
		if (containerWidth <= 0) return;
		if (isNonDynamic) {
			this.balanceNonDynamicLineBreaks(containerWidth, computedStyle, wordSegmenter);
			return;
		}
		if (!hasSplittedWords) return;
		this.balanceDynamicLineBreaks(containerWidth, wordSegmenter);
	}
	reset() {
		this.lastBalancedContainerWidth = -1;
	}
	executeLineBalance(containerWidth, adapter, wordSegmenter) {
		const existingBrs = this.mainElement.querySelectorAll("br");
		if (containerWidth === this.lastBalancedContainerWidth && existingBrs.length > 0) return;
		adapter.resetDOM();
		const prevWhiteSpace = this.mainElement.style.whiteSpace;
		this.mainElement.style.whiteSpace = "nowrap";
		const parentElement = this.mainElement.parentElement;
		let prevTransform = "";
		let transformChanged = false;
		if (parentElement) {
			prevTransform = parentElement.style.transform;
			if (prevTransform && prevTransform !== "none") {
				parentElement.style.transform = "none";
				transformChanged = true;
			}
		}
		let lockAcquired = false;
		try {
			const { childInfos, fullText } = adapter.buildChildInfos();
			let layoutWidth = childInfos.reduce((sum, c) => sum + c.width, 0);
			if (adapter.needsCalibration) {
				const range = document.createRange();
				range.selectNodeContents(this.mainElement);
				const visualWidth = range.getBoundingClientRect().width;
				if (layoutWidth > 0 && visualWidth > 0) {
					const scale = visualWidth / layoutWidth;
					for (const info of childInfos) info.width *= scale;
				}
				layoutWidth = visualWidth;
			}
			const safeContainerWidth = Math.max(1, containerWidth);
			if (layoutWidth <= safeContainerWidth) {
				this.lastBalancedContainerWidth = containerWidth;
				return;
			}
			const breaks = calcBalancedBreaks(childInfos, safeContainerWidth, fullText, wordSegmenter);
			if (breaks.length === 0) {
				this.lastBalancedContainerWidth = containerWidth;
				return;
			}
			this.isBalancing = true;
			lockAcquired = true;
			adapter.applyBreaks(breaks, childInfos);
			this.lastBalancedContainerWidth = containerWidth;
			this.isBalancing = false;
		} finally {
			this.mainElement.style.whiteSpace = prevWhiteSpace;
			if (transformChanged && parentElement) parentElement.style.transform = prevTransform;
			if (lockAcquired) this.isBalancing = false;
		}
	}
	balanceDynamicLineBreaks(containerWidth, wordSegmenter) {
		const infoToNode = [];
		this.executeLineBalance(containerWidth, {
			resetDOM: () => {
				this.mainElement.querySelectorAll("br").forEach((br) => {
					br.remove();
				});
			},
			buildChildInfos: () => {
				infoToNode.length = 0;
				const childNodes = Array.from(this.mainElement.childNodes);
				const childInfos = [];
				const range = document.createRange();
				for (const node of childNodes) if (node.nodeType === Node.TEXT_NODE) {
					const text = node.textContent ?? "";
					if (text.length === 0) continue;
					range.selectNodeContents(node);
					childInfos.push({
						width: range.getBoundingClientRect().width,
						text,
						isSpace: text.trim().length === 0
					});
					infoToNode.push(node);
				} else if (node.nodeType === Node.ELEMENT_NODE) {
					const el = node;
					const rect = el.getBoundingClientRect();
					const elStyle = getComputedStyle(el);
					const marginLeft = Number.parseFloat(elStyle.marginLeft) || 0;
					const marginRight = Number.parseFloat(elStyle.marginRight) || 0;
					childInfos.push({
						width: clampPositive(rect.width + marginLeft + marginRight),
						text: el.textContent ?? "",
						isSpace: false
					});
					infoToNode.push(node);
				}
				return {
					childInfos,
					fullText: childInfos.map((c) => c.text).join("")
				};
			},
			applyBreaks: (breaks) => {
				for (let i = breaks.length - 1; i >= 0; i--) {
					const breakIndex = breaks[i];
					if (breakIndex >= 0 && breakIndex < infoToNode.length) this.mainElement.insertBefore(document.createElement("br"), infoToNode[breakIndex]);
				}
			},
			needsCalibration: false
		}, wordSegmenter);
	}
	balanceNonDynamicLineBreaks(containerWidth, computedStyle, wordSegmenter) {
		const fullText = this.mainElement.textContent ?? "";
		if (fullText.trim().length === 0) return;
		this.executeLineBalance(containerWidth, {
			resetDOM: () => {
				this.mainElement.innerHTML = "";
				this.mainElement.textContent = fullText;
			},
			buildChildInfos: () => {
				const ctx = getMeasurementContext();
				if (!ctx) {
					console.debug("Canvas 2D context is not supported, skipping line balancing");
					return {
						childInfos: [],
						fullText
					};
				}
				ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
				if ("letterSpacing" in ctx) ctx.letterSpacing = computedStyle.letterSpacing !== "normal" ? computedStyle.letterSpacing : "0px";
				if ("wordSpacing" in ctx) ctx.wordSpacing = computedStyle.wordSpacing !== "normal" ? computedStyle.wordSpacing : "0px";
				const childInfos = [];
				for (const { segment } of wordSegmenter.segment(fullText)) childInfos.push({
					width: ctx.measureText(segment).width,
					text: segment,
					isSpace: segment.trim().length === 0
				});
				return {
					childInfos,
					fullText
				};
			},
			applyBreaks: (breaks, childInfos) => {
				this.mainElement.innerHTML = "";
				const breakSet = new Set(breaks);
				const fragment = document.createDocumentFragment();
				for (let i = 0; i < childInfos.length; i++) {
					if (breakSet.has(i)) fragment.appendChild(document.createElement("br"));
					fragment.appendChild(document.createTextNode(childInfos[i].text));
				}
				this.mainElement.appendChild(fragment);
			},
			needsCalibration: true
		}, wordSegmenter);
	}
};
//#endregion
//#region src/utils/lyric-split-words.ts
const SPLIT_WHITESPACE_RE = /(\s+)/;
const WHITESPACE_RE = /\s/g;
/**
* 将输入的单词重新分组，之间没有空格的单词将会组合成一个单词数组
*
* 例如输入：`["Life", " ", "is", " a", " su", "gar so", "sweet"]`
*
* 应该返回：`["Life", " ", "is", " a", [" su", "gar"], "so", "sweet"]`
* @param words 输入的单词数组
* @returns 重新分组后的单词数组
*/
function chunkAndSplitLyricWords(words) {
	const result = [];
	let currentGroup = [];
	const flushGroup = () => {
		if (currentGroup.length > 0) {
			result.push(currentGroup.length === 1 ? currentGroup[0] : [...currentGroup]);
			currentGroup = [];
		}
	};
	const processAtom = (atom) => {
		const isSpace = atom.word.trim().length === 0;
		const hasRuby = (atom.ruby?.length ?? 0) > 0;
		const isCJKChar = isCJK(atom.word);
		if (!isSpace && !hasRuby && !isCJKChar) currentGroup.push(atom);
		else {
			flushGroup();
			result.push(atom);
		}
	};
	for (const w of words) {
		const isSpace = w.word.trim().length === 0;
		const romanWord = w.romanWord ?? "";
		const obscene = w.obscene ?? false;
		const hasRuby = (w.ruby?.length ?? 0) > 0;
		if (isSpace || hasRuby) {
			processAtom({ ...w });
			continue;
		}
		const parts = w.word.split(SPLIT_WHITESPACE_RE).filter((p) => p.length > 0);
		const totalLength = w.word.replace(WHITESPACE_RE, "").length || 1;
		const timePerUnit = (w.endTime - w.startTime) / totalLength;
		let currentOffset = 0;
		for (const part of parts) {
			if (!part.trim()) {
				const startTime = w.startTime + currentOffset * timePerUnit;
				processAtom({
					word: part,
					romanWord: "",
					startTime,
					endTime: startTime,
					obscene
				});
				continue;
			}
			if (isCJK(part) && part.length > 1 && romanWord.trim().length === 0) {
				const chars = part.split("");
				for (const char of chars) {
					const startTime = w.startTime + currentOffset * timePerUnit;
					processAtom({
						word: char,
						romanWord: "",
						startTime,
						endTime: startTime + timePerUnit,
						obscene
					});
					currentOffset += 1;
				}
			} else {
				const partRealLen = part.length;
				const startTime = w.startTime + currentOffset * timePerUnit;
				processAtom({
					word: part,
					romanWord,
					startTime,
					endTime: startTime + partRealLen * timePerUnit,
					obscene
				});
				currentOffset += partRealLen;
			}
		}
	}
	flushGroup();
	return result;
}
//#endregion
//#region src/utils/matrix.ts
function createMatrix4() {
	return [
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		1
	];
}
function scaleMatrix4(m, scale = 1, origin = {
	x: 0,
	y: 0
}) {
	const [ox, oy] = [origin.x, origin.y];
	return [
		m[0] * scale,
		m[1] * scale,
		m[2] * scale,
		m[3],
		m[4] * scale,
		m[5] * scale,
		m[6] * scale,
		m[7],
		m[8] * scale,
		m[9] * scale,
		m[10] * scale,
		m[11],
		m[12] - ox * scale + ox,
		m[13] - oy * scale + oy,
		m[14],
		m[15]
	];
}
function matrix4ToCSS(m, fractionDigits = 4) {
	const format = (n, _) => n.toFixed(fractionDigits);
	return `matrix3d(${m.map(format).join(", ")})`;
}
//#endregion
//#region src/lyric-player/dom/lyric-line.ts
const ANIMATION_FRAME_QUANTITY = 32;
const norNum = (min, max) => (x) => clamp01((x - min) / (max - min));
const EMP_EASING_MID = .5;
const beginNum = norNum(0, EMP_EASING_MID);
const endNum = norNum(EMP_EASING_MID, 1);
const bezIn = bezier(.2, .4, .58, 1);
const bezOut = bezier(.3, 0, .58, 1);
const makeEmpEasing = (mid) => {
	return (x) => x < mid ? bezIn(beginNum(x)) : 1 - bezOut(endNum(x));
};
function generateFadeGradient(width, padding = 0, bright = "rgba(0,0,0,var(--bright-mask-alpha, 1.0))", dark = "rgba(0,0,0,var(--dark-mask-alpha, 1.0))") {
	const totalAspect = 2 + width + padding;
	const widthInTotal = width / totalAspect;
	const leftPos = (1 - widthInTotal) / 2;
	return [`linear-gradient(to right,${bright} ${leftPos * 100}%,${dark} ${(leftPos + widthInTotal) * 100}%)`, totalAspect];
}
var RawLyricLineMouseEvent = class extends MouseEvent {
	constructor(line, event) {
		super(event.type, event);
		this.line = line;
	}
};
var LyricLineEl = class extends LyricLineBase {
	element = document.createElement("div");
	splittedWords = [];
	built = false;
	lineSize = [0, 0];
	renderMode = LyricLineRenderMode.SOLID;
	currentBrightAlpha = 1;
	currentDarkAlpha = .2;
	targetBrightAlpha = 1;
	targetDarkAlpha = .2;
	/**
	* 用于平衡换行、尽量减少各行长度差异的类
	*/
	balancer;
	constructor(lyricPlayer, lyricLine = {
		words: [],
		translatedLyric: "",
		romanLyric: "",
		startTime: 0,
		endTime: 0,
		isBG: false,
		isDuet: false
	}) {
		super();
		this.lyricPlayer = lyricPlayer;
		this.lyricLine = lyricLine;
		this.element.setAttribute("class", lyric_player_module_default.lyricLine);
		if (this.lyricLine.isBG) this.element.classList.add(lyric_player_module_default.lyricBgLine);
		if (this.lyricLine.isDuet) this.element.classList.add(lyric_player_module_default.lyricDuetLine);
		this.element.appendChild(document.createElement("div"));
		this.element.appendChild(document.createElement("div"));
		this.element.appendChild(document.createElement("div"));
		const main = this.element.children[0];
		const trans = this.element.children[1];
		const roman = this.element.children[2];
		main.setAttribute("class", lyric_player_module_default.lyricMainLine);
		trans.setAttribute("class", lyric_player_module_default.lyricSubLine);
		roman.setAttribute("class", lyric_player_module_default.lyricSubLine);
		if (LyricLineBase.wordSegmenter) this.balancer = new LineBalancer(main);
		this.rebuildStyle();
	}
	listenersMap = /* @__PURE__ */ new Map();
	onMouseEvent = (e) => {
		const wrapped = new RawLyricLineMouseEvent(this, e);
		for (const listener of this.listenersMap.get(e.type) ?? []) listener.call(this, wrapped);
		if (!this.dispatchEvent(wrapped) || wrapped.defaultPrevented) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	};
	addMouseEventListener(type, callback, options) {
		if (callback) {
			const listeners = this.listenersMap.get(type) ?? /* @__PURE__ */ new Set();
			if (listeners.size === 0) this.element.addEventListener(type, this.onMouseEvent, options);
			listeners.add(callback);
			this.listenersMap.set(type, listeners);
		}
	}
	removeMouseEventListener(type, callback, options) {
		if (callback) {
			const listeners = this.listenersMap.get(type);
			if (listeners) {
				listeners.delete(callback);
				if (listeners.size === 0) this.element.removeEventListener(type, this.onMouseEvent, options);
			}
		}
	}
	areWordsOnSameLine(word1, word2) {
		if (word1?.mainElement && word2?.mainElement) {
			const word1el = word1.mainElement;
			const word2el = word2.mainElement;
			const rect1 = word1el.getBoundingClientRect();
			const rect2 = word2el.getBoundingClientRect();
			return Math.abs(rect1.top - rect2.top) < 10;
		}
		return true;
	}
	isEnabled = false;
	async enable(maskAnimationTime = this.lyricPlayer.getCurrentTime(), shouldPlay = this.lyricPlayer.getIsPlaying()) {
		this.isEnabled = true;
		this.element.classList.add(lyric_player_module_default.active);
		const main = this.element.children[0];
		const relativeTime = clampPositive(maskAnimationTime - this.lyricLine.startTime);
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				a.currentTime = relativeTime;
				a.playbackRate = 1;
				const timing = a.effect?.getComputedTiming();
				const duration = Number(timing?.duration ?? 0);
				const endTime = Number(timing?.delay ?? 0) + duration;
				if (shouldPlay && relativeTime < endTime) a.play();
				else a.pause();
			}
			for (const a of word.maskAnimations) {
				const t = Math.min(this.totalDuration, relativeTime);
				a.currentTime = t;
				a.playbackRate = 1;
				const timing = a.effect?.getComputedTiming();
				const duration = Number(timing?.duration ?? 0);
				const endTime = Number(timing?.delay ?? 0) + duration;
				if (shouldPlay && t < endTime) a.play();
				else a.pause();
			}
		}
		main.classList.add(lyric_player_module_default.active);
	}
	disable() {
		this.isEnabled = false;
		this.element.classList.remove(lyric_player_module_default.active);
		this.renderMode = LyricLineRenderMode.SOLID;
		const main = this.element.children[0];
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) if (a.id === "float-word" || a.id.includes("emphasize-word-float-only")) {
				a.playbackRate = -1;
				a.play();
			}
			for (const a of word.maskAnimations) a.pause();
		}
		main.classList.remove(lyric_player_module_default.active);
	}
	lastWord;
	async resume() {
		if (!this.isEnabled) return;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) if (!this.lastWord || this.splittedWords.indexOf(this.lastWord) < this.splittedWords.indexOf(word)) {
				const timing = a.effect?.getComputedTiming();
				const duration = timing?.duration || 0;
				const endTime = (timing?.delay || 0) + duration;
				const currentTime = a.currentTime || 0;
				if (a.playState !== "finished" && currentTime < endTime) a.play();
			}
			for (const a of word.maskAnimations) if (!this.lastWord || this.splittedWords.indexOf(this.lastWord) < this.splittedWords.indexOf(word)) {
				const timing = a.effect?.getComputedTiming();
				const duration = timing?.duration || 0;
				const endTime = (timing?.delay || 0) + duration;
				const currentTime = a.currentTime || 0;
				if (a.playState !== "finished" && currentTime < endTime) a.play();
			}
		}
	}
	async pause() {
		if (!this.isEnabled) return;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) a.pause();
			for (const a of word.maskAnimations) a.pause();
		}
	}
	setMaskAnimationState(maskAnimationTime = 0) {
		const t = maskAnimationTime - this.lyricLine.startTime;
		for (const word of this.splittedWords) for (const a of word.maskAnimations) {
			a.currentTime = clamp(t, 0, this.totalDuration);
			a.playbackRate = 1;
			if (t >= 0 && t < this.totalDuration) a.play();
			else a.pause();
		}
	}
	getLine() {
		return this.lyricLine;
	}
	lastStyle = "";
	show() {
		if (!this.built) {
			this.rebuildElement();
			this.built = true;
			this.updateMaskImageSync();
		}
	}
	rebuildStyle() {
		let style = "";
		style += `transform: scale(${(this.lineTransforms.scale.getCurrentPosition() / 100).toFixed(4)});`;
		if (!this.lyricPlayer.getEnableSpring()) style += `transition-delay:${this.delay}ms;`;
		style += `filter:blur(${Math.min(5, this.blur)}px);`;
		if (style !== this.lastStyle) {
			this.lastStyle = style;
			this.element.setAttribute("style", style);
		}
	}
	rebuildElement() {
		this.disposeElements();
		const main = this.element.children[0];
		const trans = this.element.children[1];
		const roman = this.element.children[2];
		if (this.lyricPlayer._getIsNonDynamic()) {
			main.innerText = this.lyricLine.words.map((w) => this.lyricPlayer.processObsceneWord(w)).join("");
			this.setSubLinesText(trans, roman);
			return;
		}
		const chunkedWords = chunkAndSplitLyricWords(this.lyricLine.words);
		const hasRubyLine = this.lyricLine.words.some((word) => (word.ruby?.length ?? 0) > 0);
		const hasRomanLine = this.lyricLine.words.some((word) => (word.romanWord?.trim().length ?? 0) > 0);
		main.innerHTML = "";
		for (const chunk of chunkedWords) this.buildWord(chunk, main, hasRubyLine, hasRomanLine);
		this.setSubLinesText(trans, roman);
	}
	/** 设置翻译与音译行文本 */
	setSubLinesText(trans, roman) {
		trans.innerText = this.lyricLine.translatedLyric;
		roman.innerText = this.lyricLine.romanLyric;
	}
	getRubyCharCount(word) {
		return (word.ruby ?? []).reduce((total, ruby) => total + ruby.word.length, 0);
	}
	getRubySegments(word) {
		return (word.ruby ?? []).filter((ruby) => (ruby?.word?.trim().length ?? 0) > 0);
	}
	createWord(word, shouldEmphasize, hasRubyLine, hasRomanLine) {
		const mainWordEl = document.createElement("span");
		const subElements = [];
		const romanWord = word.romanWord?.trim() ?? "";
		const wordContainer = hasRubyLine ? document.createElement("div") : mainWordEl;
		if (hasRubyLine) {
			const rubyWordEl = document.createElement("div");
			const rubySegments = this.getRubySegments(word);
			for (const ruby of rubySegments) {
				const rubyPartEl = document.createElement("span");
				rubyPartEl.innerText = ruby.word;
				rubyPartEl.dataset.startTime = String(ruby.startTime);
				rubyPartEl.dataset.endTime = String(ruby.endTime);
				rubyWordEl.appendChild(rubyPartEl);
			}
			rubyWordEl.classList.add(lyric_player_module_default.rubyWord);
			mainWordEl.classList.add(lyric_player_module_default.wordWithRuby);
			wordContainer.classList.add(lyric_player_module_default.wordBody);
			mainWordEl.appendChild(rubyWordEl);
			mainWordEl.appendChild(wordContainer);
		}
		const displayWord = this.lyricPlayer.processObsceneWord(word);
		if (shouldEmphasize) {
			mainWordEl.classList.add(lyric_player_module_default.emphasize);
			const trimmedWord = displayWord.trim();
			if (LyricLineBase.graphemeSegmenter) for (const { segment } of LyricLineBase.graphemeSegmenter.segment(trimmedWord)) {
				const charEl = document.createElement("span");
				charEl.innerText = segment;
				subElements.push(charEl);
				wordContainer.appendChild(charEl);
			}
			else for (const segment of Array.from(trimmedWord)) {
				const charEl = document.createElement("span");
				charEl.innerText = segment;
				subElements.push(charEl);
				wordContainer.appendChild(charEl);
			}
		} else if (hasRomanLine) {
			const wordEl = document.createElement("div");
			wordEl.innerText = displayWord.trim();
			wordContainer.appendChild(wordEl);
		} else if (romanWord.length === 0) wordContainer.innerText = displayWord.trim();
		if (hasRomanLine) {
			const romanWordEl = document.createElement("div");
			romanWordEl.innerText = romanWord.length > 0 ? romanWord : "\xA0";
			romanWordEl.classList.add(lyric_player_module_default.romanWord);
			wordContainer.appendChild(romanWordEl);
		}
		return {
			...word,
			mainElement: mainWordEl,
			subElements,
			elementAnimations: [this.initFloatAnimation(word, mainWordEl)],
			maskAnimations: [],
			width: 0,
			height: 0,
			padding: 0,
			shouldEmphasize
		};
	}
	buildWord(input, main, hasRubyLine, hasRomanLine) {
		const chunk = Array.isArray(input) ? input : [input];
		if (chunk.length === 0) return;
		if (chunk.every((w) => !w.word.trim())) {
			const textContent = chunk.map((w) => w.word).join("");
			main.appendChild(document.createTextNode(textContent));
			return;
		}
		const merged = chunk.reduce((a, b) => {
			a.endTime = Math.max(a.endTime, b.endTime);
			a.startTime = Math.min(a.startTime, b.startTime);
			a.word += b.word;
			return a;
		}, {
			word: "",
			romanWord: "",
			startTime: Number.POSITIVE_INFINITY,
			endTime: Number.NEGATIVE_INFINITY,
			wordType: "normal",
			obscene: false
		});
		let emp = chunk.some((word) => LyricLineBase.shouldEmphasize(word));
		if (!isCJK(merged.word)) emp = emp || LyricLineBase.shouldEmphasize(merged);
		const wrapperWordEl = document.createElement("span");
		wrapperWordEl.classList.add(lyric_player_module_default.emphasizeWrapper);
		const characterElements = [];
		for (const word of chunk) {
			if (!word.word.trim()) {
				wrapperWordEl.appendChild(document.createTextNode(word.word));
				continue;
			}
			const realWord = this.createWord(word, emp, hasRubyLine, hasRomanLine);
			if (emp) characterElements.push(...realWord.subElements);
			this.splittedWords.push(realWord);
			wrapperWordEl.appendChild(realWord.mainElement);
		}
		if (emp && this.splittedWords.length > 0) {
			const lastWordOfChunk = this.splittedWords[this.splittedWords.length - 1];
			const rubyCharCount = chunk.reduce((total, word) => total + this.getRubyCharCount(word), 0);
			lastWordOfChunk.elementAnimations.push(...this.initEmphasizeAnimation(merged, characterElements, merged.endTime - merged.startTime, merged.startTime - this.lyricLine.startTime, rubyCharCount));
		}
		main.appendChild(wrapperWordEl);
	}
	initFloatAnimation(word, wordEl) {
		const delay = word.startTime - this.lyricLine.startTime;
		const duration = Math.max(1e3, word.endTime - word.startTime);
		let up = .05;
		if (this.lyricLine.isBG) up *= 2;
		const a = wordEl.animate([{ transform: "translateY(0px)" }, { transform: `translateY(${-up}em)` }], {
			duration: Number.isFinite(duration) ? duration : 0,
			delay: Number.isFinite(delay) ? delay : 0,
			id: "float-word",
			composite: "add",
			fill: "both",
			easing: "ease-out"
		});
		a.pause();
		return a;
	}
	initEmphasizeAnimation(word, characterElements, duration, delay, rubyCharCount) {
		const de = clampPositive(delay);
		let du = Math.max(1e3, duration);
		const anchorCharCount = rubyCharCount > 0 ? rubyCharCount : Math.max(1, characterElements.length);
		let result = [];
		let amount = du / 2e3;
		amount = amount > 1 ? Math.sqrt(amount) : amount ** 3;
		let blur = du / 3e3;
		blur = blur > 1 ? Math.sqrt(blur) : blur ** 3;
		amount *= .6;
		blur *= .5;
		if (this.lyricLine.words.length > 0 && word.word.includes(this.lyricLine.words[this.lyricLine.words.length - 1].word)) {
			amount *= 1.6;
			blur *= 1.5;
			du *= 1.2;
		}
		amount = Math.min(1.2, amount);
		blur = Math.min(.8, blur);
		const animateDu = Number.isFinite(du) ? du : 0;
		const empEasing = makeEmpEasing(EMP_EASING_MID);
		result = characterElements.flatMap((el, i, arr) => {
			const wordDe = de + du / 2.5 / anchorCharCount * i;
			const result = [];
			const frames = new Array(ANIMATION_FRAME_QUANTITY).fill(0).map((_, j) => {
				const x = (j + 1) / ANIMATION_FRAME_QUANTITY;
				const transX = empEasing(x);
				const glowLevel = empEasing(x) * blur;
				const mat = scaleMatrix4(createMatrix4(), 1 + transX * .1 * amount);
				const offsetX = -transX * .03 * amount * (arr.length / 2 - i);
				const offsetY = -transX * .025 * amount;
				return {
					offset: x,
					transform: `${matrix4ToCSS(mat, 4)} translate(${offsetX}em, ${offsetY}em)`,
					textShadow: `0 0 ${Math.min(.3, blur * .3)}em rgba(255, 255, 255, ${glowLevel})`
				};
			});
			const glow = el.animate(frames, {
				duration: animateDu,
				delay: Number.isFinite(wordDe) ? wordDe : 0,
				id: `emphasize-word-${el.innerText}-${i}`,
				iterations: 1,
				composite: "replace",
				fill: "both"
			});
			glow.onfinish = () => {
				glow.pause();
			};
			glow.pause();
			result.push(glow);
			const floatFrame = new Array(ANIMATION_FRAME_QUANTITY).fill(0).map((_, j) => {
				const x = (j + 1) / ANIMATION_FRAME_QUANTITY;
				let y = Math.sin(x * Math.PI);
				if (this.lyricLine.isBG) y *= 2;
				return {
					offset: x,
					transform: `translateY(${-y * .05}em)`
				};
			});
			const float = el.animate(floatFrame, {
				duration: animateDu * 1.4,
				delay: Number.isFinite(wordDe) ? wordDe - 400 : 0,
				id: "emphasize-word-float",
				iterations: 1,
				composite: "add",
				fill: "both"
			});
			float.onfinish = () => {
				float.pause();
			};
			float.pause();
			result.push(float);
			return result;
		});
		return result;
	}
	get totalDuration() {
		return this.lyricLine.endTime - this.lyricLine.startTime;
	}
	onLineSizeChange(_size) {
		this.updateMaskImageSync();
	}
	updateMaskImageSync() {
		for (const word of this.splittedWords) {
			const el = word.mainElement;
			if (el) {
				word.padding = Number.parseFloat(getComputedStyle(el).paddingLeft);
				word.width = el.clientWidth - word.padding * 2;
				word.height = el.clientHeight - word.padding * 2;
			} else {
				word.width = 0;
				word.height = 0;
				word.padding = 0;
			}
		}
		if (this.balancer && LyricLineBase.wordSegmenter) this.balancer.balanceLineBreaks(this.lyricPlayer._getIsNonDynamic(), this.splittedWords.length > 0, LyricLineBase.wordSegmenter);
		if (this.lyricPlayer.supportMaskImage) this.generateWebAnimationBasedMaskImage();
		else this.generateCalcBasedMaskImage();
		if (this.isEnabled) {
			const isPlayerRunning = this.lyricPlayer.getIsPlaying?.() ?? true;
			this.enable(this.lyricPlayer.getCurrentTime(), isPlayerRunning);
		}
	}
	generateCalcBasedMaskImage() {
		for (const word of this.splittedWords) {
			const wordEl = word.mainElement;
			if (wordEl) {
				word.width = wordEl.clientWidth;
				word.height = wordEl.clientHeight;
				const fadeWidth = word.height * this.lyricPlayer.getWordFadeWidth();
				const [maskImage, totalAspect] = generateFadeGradient(fadeWidth / word.width);
				const totalAspectStr = `${totalAspect * 100}% 100%`;
				if (this.lyricPlayer.supportMaskImage) {
					wordEl.style.maskImage = maskImage;
					wordEl.style.maskRepeat = "no-repeat";
					wordEl.style.maskOrigin = "left";
					wordEl.style.maskSize = totalAspectStr;
				} else {
					wordEl.style.webkitMaskImage = maskImage;
					wordEl.style.webkitMaskRepeat = "no-repeat";
					wordEl.style.webkitMaskOrigin = "left";
					wordEl.style.webkitMaskSize = totalAspectStr;
				}
				const w = word.width + fadeWidth;
				const maskPos = `clamp(${-w}px,calc(${-w}px + (var(--amll-player-time) - ${word.startTime})*${w / Math.abs(word.endTime - word.startTime)}px),0px) 0px, left top`;
				wordEl.style.maskPosition = maskPos;
				wordEl.style.webkitMaskPosition = maskPos;
			}
		}
	}
	generateWebAnimationBasedMaskImage() {
		const totalFadeDuration = Math.max(0, ...this.splittedWords.map((w) => w.endTime), this.lyricLine.endTime) - this.lyricLine.startTime;
		this.splittedWords.forEach((word, i) => {
			const wordEl = word.mainElement;
			if (wordEl) {
				const fadeWidth = word.height * this.lyricPlayer.getWordFadeWidth();
				const [maskImage, totalAspect] = generateFadeGradient(fadeWidth / (word.width + word.padding * 2));
				const totalAspectStr = `${totalAspect * 100}% 100%`;
				if (this.lyricPlayer.supportMaskImage) {
					wordEl.style.maskImage = maskImage;
					wordEl.style.maskRepeat = "no-repeat";
					wordEl.style.maskOrigin = "left";
					wordEl.style.maskSize = totalAspectStr;
				} else {
					wordEl.style.webkitMaskImage = maskImage;
					wordEl.style.webkitMaskRepeat = "no-repeat";
					wordEl.style.webkitMaskOrigin = "left";
					wordEl.style.webkitMaskSize = totalAspectStr;
				}
				const widthBeforeSelf = this.splittedWords.slice(0, i).reduce((a, b) => a + b.width, 0) + (this.splittedWords[0] ? fadeWidth : 0);
				const minOffset = -(word.width + word.padding * 2 + fadeWidth);
				const clampOffset = (x) => clamp(x, minOffset, 0);
				let curPos = -widthBeforeSelf - word.width - word.padding - fadeWidth;
				let timeOffset = 0;
				const frames = [];
				let lastPos = curPos;
				let lastTime = 0;
				const pushFrame = () => {
					const moveOffset = curPos - lastPos;
					const time = clamp01(timeOffset);
					const duration = time - lastTime;
					const d = Math.abs(duration / moveOffset);
					if (curPos > minOffset && lastPos < minOffset) {
						const staticTime = Math.abs(lastPos - minOffset) * d;
						const value = `${clampOffset(lastPos)}px 0`;
						const frame = {
							offset: lastTime + staticTime,
							maskPosition: value
						};
						frames.push(frame);
					}
					if (curPos > 0 && lastPos < 0) {
						const staticTime = Math.abs(lastPos) * d;
						const value = `${clampOffset(curPos)}px 0`;
						const frame = {
							offset: lastTime + staticTime,
							maskPosition: value
						};
						frames.push(frame);
					}
					const frame = {
						offset: time,
						maskPosition: `${clampOffset(curPos)}px 0`
					};
					frames.push(frame);
					lastPos = curPos;
					lastTime = time;
				};
				pushFrame();
				let lastTimeStamp = 0;
				this.splittedWords.forEach((otherWord, j) => {
					{
						const curTimeStamp = otherWord.startTime - this.lyricLine.startTime;
						const staticDuration = curTimeStamp - lastTimeStamp;
						timeOffset += staticDuration / totalFadeDuration;
						if (staticDuration > 0) pushFrame();
						lastTimeStamp = curTimeStamp;
					}
					{
						const fadeDuration = clampPositive(otherWord.endTime - otherWord.startTime);
						const rubySegments = this.getRubySegments(otherWord);
						const rubyCharCount = rubySegments.reduce((total, ruby) => total + ruby.word.length, 0);
						if (rubyCharCount > 0) {
							const widthPerChar = otherWord.width / rubyCharCount;
							let charIndex = 0;
							for (const ruby of rubySegments) {
								const rubyStartTime = Number.isFinite(ruby.startTime) ? ruby.startTime : otherWord.startTime;
								const rubyEndTime = Number.isFinite(ruby.endTime) ? ruby.endTime : otherWord.endTime;
								const rubyStart = Math.max(rubyStartTime, otherWord.startTime);
								const rubyEnd = Math.min(Math.max(rubyEndTime, rubyStart), otherWord.endTime);
								const rubyStartStamp = rubyStart - this.lyricLine.startTime;
								const rubyStaticDuration = rubyStartStamp - lastTimeStamp;
								timeOffset += rubyStaticDuration / totalFadeDuration;
								if (rubyStaticDuration > 0) pushFrame();
								lastTimeStamp = rubyStartStamp;
								const perCharDuration = clampPositive(rubyEnd - rubyStart) / ruby.word.length;
								for (let rubyCharIndex = 0; rubyCharIndex < ruby.word.length; rubyCharIndex++) {
									timeOffset += perCharDuration / totalFadeDuration;
									curPos += widthPerChar;
									if (j === 0 && charIndex === 0) curPos += fadeWidth * 1.5;
									if (j === this.splittedWords.length - 1 && charIndex === rubyCharCount - 1) curPos += fadeWidth * .5;
									if (perCharDuration > 0) pushFrame();
									lastTimeStamp += perCharDuration;
									charIndex++;
								}
							}
							const wordEndStamp = Math.max(otherWord.endTime - this.lyricLine.startTime, lastTimeStamp);
							const wordTailDuration = wordEndStamp - lastTimeStamp;
							timeOffset += wordTailDuration / totalFadeDuration;
							if (wordTailDuration > 0) pushFrame();
							lastTimeStamp = wordEndStamp;
						} else {
							const segmentCount = 1;
							const segmentWidth = otherWord.width / segmentCount;
							const segmentDuration = fadeDuration / segmentCount;
							for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
								timeOffset += segmentDuration / totalFadeDuration;
								curPos += segmentWidth;
								if (j === 0 && segmentIndex === 0) curPos += fadeWidth * 1.5;
								if (j === this.splittedWords.length - 1 && segmentIndex === segmentCount - 1) curPos += fadeWidth * .5;
								if (segmentDuration > 0) pushFrame();
								lastTimeStamp += segmentDuration;
							}
						}
					}
				});
				for (const a of word.maskAnimations) a.cancel();
				try {
					const ani = wordEl.animate(frames, {
						duration: totalFadeDuration || 1,
						id: `fade-word-${word.word}-${i}`,
						fill: "both"
					});
					ani.pause();
					word.maskAnimations = [ani];
				} catch (err) {
					console.warn("应用渐变动画发生错误", frames, totalFadeDuration, err);
				}
			}
		});
	}
	getElement() {
		return this.element;
	}
	updateMaskAlphaTargets(scale) {
		const factor = clamp01((scale - .97) / .03);
		const dynamicDarkAlpha = factor * .2 + .2;
		const dynamicBrightAlpha = factor * .8 + .2;
		if (this.renderMode === LyricLineRenderMode.SOLID) {
			this.targetBrightAlpha = dynamicDarkAlpha;
			this.targetDarkAlpha = dynamicDarkAlpha;
		} else {
			this.targetBrightAlpha = dynamicBrightAlpha;
			this.targetDarkAlpha = dynamicDarkAlpha;
		}
	}
	applyAlphaToDom(delta) {
		const dt = delta || .016;
		const ATTACK_SPEED = 50;
		const RELEASE_SPEED = 7;
		const getFactor = (speed) => 1 - Math.exp(-speed * dt);
		const brightFactor = getFactor(this.targetBrightAlpha > this.currentBrightAlpha ? ATTACK_SPEED : RELEASE_SPEED);
		if (Math.abs(this.targetBrightAlpha - this.currentBrightAlpha) < .001) this.currentBrightAlpha = this.targetBrightAlpha;
		else this.currentBrightAlpha += (this.targetBrightAlpha - this.currentBrightAlpha) * brightFactor;
		const darkFactor = getFactor(this.targetDarkAlpha > this.currentDarkAlpha ? ATTACK_SPEED : RELEASE_SPEED);
		if (Math.abs(this.targetDarkAlpha - this.currentDarkAlpha) < .001) this.currentDarkAlpha = this.targetDarkAlpha;
		else this.currentDarkAlpha += (this.targetDarkAlpha - this.currentDarkAlpha) * darkFactor;
		this.element.style.setProperty("--bright-mask-alpha", this.currentBrightAlpha.toFixed(3));
		this.element.style.setProperty("--dark-mask-alpha", this.currentDarkAlpha.toFixed(3));
	}
	setTransform(scale = this.scale, opacity = 1, blur = 0, force = false, delay = 0, mode = LyricLineRenderMode.SOLID) {
		super.setTransform(scale, opacity, blur, force, delay);
		this.renderMode = mode;
		const enableSpring = this.lyricPlayer.getEnableSpring();
		this.top = 0;
		this.scale = scale;
		this.delay = delay * 1e3 | 0;
		const main = this.element.children[0];
		main.style.opacity = `${opacity}`;
		if (force || !enableSpring) {
			this.blur = Math.min(32, blur);
			this.lineTransforms.scale.setPosition(scale);
			this.rebuildStyle();
			const currentScale = this.lineTransforms.scale.getCurrentPosition();
			this.updateMaskAlphaTargets(currentScale / 100);
			this.currentBrightAlpha = this.targetBrightAlpha;
			this.currentDarkAlpha = this.targetDarkAlpha;
			this.element.style.setProperty("--bright-mask-alpha", String(this.currentBrightAlpha));
			this.element.style.setProperty("--dark-mask-alpha", String(this.currentDarkAlpha));
		} else {
			this.lineTransforms.scale.setTargetPosition(scale);
			if (this.blur !== Math.min(5, blur)) {
				this.blur = Math.min(5, blur);
				this.element.style.filter = `blur(${blur.toFixed(3)}px)`;
			}
		}
	}
	update(delta = 0) {
		if (!this.lyricPlayer.getEnableSpring()) return;
		this.lineTransforms.scale.update(delta);
		this.rebuildStyle();
		if (!this.built) return;
		const currentScale = this.lineTransforms.scale.getCurrentPosition() / 100;
		this.updateMaskAlphaTargets(currentScale);
		this.applyAlphaToDom(delta);
	}
	_getDebugTargetPos() {
		return `[位移: ${this.top}; 缩放: ${this.scale}; 延时: ${this.delay}]`;
	}
	teardownContent() {
		if (this.built) {
			this.disposeElements();
			this.built = false;
		}
	}
	disposeElements() {
		this.balancer?.reset();
		for (const realWord of this.splittedWords) {
			for (const a of realWord.elementAnimations) a.cancel();
			for (const a of realWord.maskAnimations) a.cancel();
			for (const sub of realWord.subElements) {
				sub.remove();
				sub.parentNode?.removeChild(sub);
			}
			realWord.elementAnimations = [];
			realWord.maskAnimations = [];
			realWord.subElements = [];
			if (realWord.mainElement?.parentNode) realWord.mainElement.parentNode.removeChild(realWord.mainElement);
		}
		this.splittedWords = [];
		const main = this.element.children[0];
		const trans = this.element.children[1];
		const roman = this.element.children[2];
		if (main) main.innerHTML = "";
		if (trans) trans.innerHTML = "";
		if (roman) roman.innerHTML = "";
	}
	dispose() {
		this.disposeElements();
		this.lyricPlayer.resizeObserver.unobserve(this.element);
		this.element.remove();
	}
};
//#endregion
//#region src/lyric-player/dom/index.ts
/**
* 歌词行鼠标相关事件，可以获取到歌词行的索引和歌词行元素
*/
var LyricLineMouseEvent = class extends MouseEvent {
	constructor(lineIndex, line, event) {
		super(`line-${event.type}`, event);
		this.lineIndex = lineIndex;
		this.line = line;
	}
};
/**
* 歌词播放组件，本框架的核心组件
*
* 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
*/
var DomLyricPlayer = class extends LyricPlayerBase {
	currentLyricGroups = [];
	onResize() {
		const computedStyles = getComputedStyle(this.element);
		this._baseFontSize = Number.parseFloat(computedStyles.fontSize);
		this.rebuildStyle();
	}
	supportPlusLighter = CSS.supports("mix-blend-mode", "plus-lighter");
	supportMaskImage = CSS.supports("mask-image", "none");
	innerSize = [0, 0];
	onLineClickedHandler = (e) => {
		const evt = new LyricLineMouseEvent(this.lyricLinesIndexes.get(e.line) ?? -1, e.line, e);
		if (!this.dispatchEvent(evt)) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	};
	/**
	* 是否为非逐词歌词
	* @internal
	*/
	_getIsNonDynamic() {
		return this.isNonDynamic;
	}
	_baseFontSize = Number.parseFloat(getComputedStyle(this.element).fontSize);
	get baseFontSize() {
		return this._baseFontSize;
	}
	constructor() {
		super();
		this.onResize();
		this.element.classList.add("amll-lyric-player", "dom");
		if (this.disableSpring) this.element.classList.add(lyric_player_module_default.disableSpring);
	}
	rebuildStyle() {}
	setWordFadeWidth(value = .5) {
		super.setWordFadeWidth(value);
		for (const group of this.currentLyricGroups) {
			group.mainLine.updateMaskImageSync();
			group.bgLine?.updateMaskImageSync();
		}
	}
	/**
	* 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	* @param lines 歌词数组
	* @param initialTime 初始时间，默认为 0
	*/
	setLyricLines(lines, initialTime = 0) {
		super.setLyricLines(lines, initialTime);
		if (this.hasDuetLine) this.element.classList.add(lyric_player_module_default.hasDuetLine);
		else this.element.classList.remove(lyric_player_module_default.hasDuetLine);
		if (!this.supportMaskImage) this.element.style.setProperty("--amll-player-time", `${initialTime}`);
		for (const group of this.currentLyricGroups) {
			const linesToDispose = [group.mainLine, group.bgLine].filter((line) => !!line);
			for (const line of linesToDispose) {
				line.removeMouseEventListener("click", this.onLineClickedHandler);
				line.removeMouseEventListener("contextmenu", this.onLineClickedHandler);
			}
			group.dispose();
		}
		this.currentLyricGroups = [];
		let currentGroup = null;
		for (let i = 0; i < this.processedLines.length; i++) {
			const line = this.processedLines[i];
			const lineEl = new LyricLineEl(this, line);
			lineEl.addMouseEventListener("click", this.onLineClickedHandler);
			lineEl.addMouseEventListener("contextmenu", this.onLineClickedHandler);
			this.lyricLinesIndexes.set(lineEl, i);
			if (!line.isBG || !currentGroup) {
				currentGroup = new LyricLineGroup(this, lineEl);
				this.currentLyricGroups.push(currentGroup);
				this.lyricGroupElementMap.set(currentGroup.element, currentGroup);
			} else currentGroup.addBgLine(lineEl);
		}
		this.setLinePosXSpringParams({});
		this.setLinePosYSpringParams({});
		this.setLineScaleSpringParams({});
		this.setCurrentTime(initialTime, true);
		this.calcLayout(true);
		this.update(0);
	}
	pause() {
		super.pause();
		this.element.classList.remove(lyric_player_module_default.playing);
		this.interludeDots.pause();
		for (const group of this.currentLyricGroups) {
			group.mainLine.pause();
			group.bgLine?.pause();
		}
	}
	resume() {
		super.resume();
		this.element.classList.add(lyric_player_module_default.playing);
		this.interludeDots.resume();
		for (const group of this.currentLyricGroups) {
			group.mainLine.resume();
			group.bgLine?.resume();
		}
	}
	update(delta = 0) {
		if (!this.timelineState.initialLayoutFinished) return;
		super.update(delta);
		if (!this.supportMaskImage) this.element.style.setProperty("--amll-player-time", `${this.timelineState.currentTime}`);
		if (!this.isPageVisible) return;
		const deltaS = delta / 1e3;
		for (const group of this.currentLyricGroups) group.update(deltaS);
	}
	dispose() {
		super.dispose();
		this.element.remove();
		for (const group of this.currentLyricGroups) group.dispose();
		this.bottomLine.dispose();
		this.interludeDots.dispose();
	}
};
//#endregion
export { AbstractBaseRenderer, BackgroundRender, BaseRenderer, DomLyricPlayer, DomLyricPlayer as LyricPlayer, LayoutAlignAnchor, LyricLineMouseEvent, LyricLineRenderMode, LyricPlayerBase, MaskObsceneWordsMode, MeshGradientRenderer, PixiRenderer };

//# sourceMappingURL=amll-core.mjs.map