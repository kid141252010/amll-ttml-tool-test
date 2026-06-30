import { Vec2, Vec3 } from "gl-matrix";

//#region \0rolldown/runtime.js
//#endregion
//#region src/interfaces.d.ts
/**
* 拥有一个 HTML 元素的接口
*
* 可以通过 `getElement` 获取这个类所对应的 HTML 元素实例
*/
interface HasElement {
  /** 获取这个类所对应的 HTML 元素实例 */
  getElement(): HTMLElement;
}
/**
* 实现了这个接口的东西需要在使用完毕后
*
* 手动调用 `dispose` 函数来销毁清除占用资源
*
* 以免产生泄露
*/
interface Disposable {
  /**
  * 销毁实现了该接口的对象实例，释放占用的资源
  *
  * 一般情况下，调用本函数后就不可以再调用对象的任何函数了
  */
  dispose(): void;
}
/** 一个歌词单词 */
interface LyricWordBase {
  /** 单词的起始时间，单位为毫秒 */
  startTime: number;
  /** 单词的结束时间，单位为毫秒 */
  endTime: number;
  /** 单词内容 */
  word: string;
}
interface LyricWord extends LyricWordBase {
  /** 单词的音译内容 */
  romanWord?: string;
  /** 单词内容是否包含冒犯性的不雅用语 */
  obscene?: boolean;
  /** 单词的注音内容 */
  ruby?: LyricWordBase[];
}
/** 一行歌词，存储多个单词 */
interface LyricLine {
  /**
  * 该行的所有单词
  * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词且通常其始末时间和本结构的 `startTime` 和 `endTime` 相同
  */
  words: LyricWord[];
  /** 该行的翻译歌词，将会显示在主歌词行的下方 */
  translatedLyric: string;
  /** 该行的音译歌词，将会显示在翻译歌词行的下方 */
  romanLyric: string;
  /** 句子的起始时间，单位为毫秒 */
  startTime: number;
  /** 句子的结束时间，单位为毫秒 */
  endTime: number;
  /** 该行是否为背景歌词行，当该行歌词的上一句非背景歌词被激活时，这行歌词将会显示出来，注意每个非背景歌词下方只能拥有一个背景歌词 */
  isBG: boolean;
  /** 该行是否为对唱歌词行（即歌词行靠右对齐） */
  isDuet: boolean;
}
/**
* 优化歌词行的配置选项
*/
interface OptimizeLyricOptions {
  /**
  * 规范化歌词中的空格
  *
  * 将多个连续空格替换为一个空格
  * @default true
  */
  normalizeSpaces?: boolean;
  /**
  * 是否将行级时间戳强行设为字级时间戳
  * @default true
  */
  resetLineTimestamps?: boolean;
  /**
  * 把多行背景人声转换为单行背景人声 + 主歌词行的形式
  * @default true
  */
  convertExcessiveBackgroundLines?: boolean;
  /**
  * 是否同步主歌词与背景人声的时间
  * @default true
  */
  syncMainAndBackgroundLines?: boolean;
  /**
  * 清洗非刻意的重叠，以免不必要的多行高亮效果
  *
  * 如果两行时间轴有重叠的歌词满足下列条件之一：
  * * 重叠小于 100ms
  * * 重叠时长不足下一行时长的 10%
  *
  * 则截断上一行歌词的结束时间为下一行歌词的开始时间
  * @default true
  */
  cleanUnintentionalOverlaps?: boolean;
  /**
  * 尝试让歌词提前最多 1 秒开始
  *
  * 有重叠则尝试最多提前 400ms 或上一行时长的 30%
  * @default true
  */
  tryAdvanceStartTime?: boolean;
}
//#endregion
//#region src/bg-render/base.d.ts
declare abstract class AbstractBaseRenderer implements Disposable, HasElement {
  /**
  * 修改背景的流动速度，数字越大越快，默认为 8
  * @param speed 背景的流动速度，默认为 8
  */
  abstract setFlowSpeed(speed: number): void;
  /**
  * 修改背景的渲染比例，默认是 0.5
  *
  * 一般情况下这个程度既没有明显瑕疵也不会特别吃性能
  * @param scale 背景的渲染比例
  */
  abstract setRenderScale(scale: number): void;
  /**
  * 是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能
  * @param enable 是否启用静态模式
  */
  abstract setStaticMode(enable: boolean): void;
  /**
  * 修改背景动画帧率，默认是 30 FPS
  *
  * 如果设置成 0 则会停止动画
  * @param fps 目标帧率，默认 30 FPS
  */
  abstract setFPS(fps: number): void;
  /**
  * 暂停背景动画，画面即便是更新了图片也不会发生变化
  */
  abstract pause(): void;
  /**
  * 恢复播放背景动画
  */
  abstract resume(): void;
  /**
  * 设置背景专辑资源，纹理加载并设置完成后会返回
  * @param albumSource 专辑的资源链接，可以是图片或视频链接，抑或是任意 img/video 元素，如果提供字符串链接且为视频则需要指定第二个参数
  */
  abstract setAlbum(albumSource: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
  /**
  * 设置低频的音量大小，范围在 80hz-120hz 之间为宜，取值范围在 [0.0-1.0] 之间
  *
  * 部分渲染器会根据音量大小调整背景效果（例如根据鼓点跳动）
  *
  * 如果无法获取到类似的数据，请传入 1.0 作为默认值，或不做任何处理（默认值即 1.0）
  * @param volume 低频的音量大小，范围在 50hz-120hz 之间为宜，取值范围在 [0.0-1.0] 之间
  */
  abstract setLowFreqVolume(volume: number): void;
  /**
  * 设置背景是否根据“是否有歌词”这个特征调整自身效果，例如有歌词时会变得更加活跃
  *
  * 部分渲染器会根据这个特征调整自身效果
  *
  * 如果不确定是否需要赋值或无法知晓是否包含歌词，请传入 true 或不做任何处理（默认值为 true）
  *
  * @param hasLyric 是否有歌词，如不确定是否需要赋值，请传入 true 或不做任何处理（默认值为 true）
  */
  abstract setHasLyric(hasLyric: boolean): void;
  abstract dispose(): void;
  abstract getElement(): HTMLElement;
}
declare abstract class BaseRenderer extends AbstractBaseRenderer {
  protected canvas: HTMLCanvasElement;
  private observer;
  protected flowSpeed: number;
  protected currerntRenderScale: number;
  constructor(canvas: HTMLCanvasElement);
  setRenderScale(scale: number): void;
  /**
  * 当画板元素大小发生变化时此函数会被调用
  * 可以在此处重设和渲染器相关的尺寸设置
  * 考虑到初始化的时候元素不一定在文档中或出于某些特殊样式状态，尺寸长宽有可能会为 0，请注意进行特判处理
  * @param width 画板元素实际的物理像素宽度，有可能为 0
  * @param height 画板元素实际的物理像素高度，有可能为 0
  */
  protected onResize(width: number, height: number): void;
  /**
  * 修改背景的流动速度，数字越大越快，默认为 1
  * @param speed 背景的流动速度，默认为 1
  */
  setFlowSpeed(speed: number): void;
  /**
  * 是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能
  * @param enable 是否启用静态模式
  */
  abstract override setStaticMode(enable: boolean): void;
  /**
  * 修改背景动画帧率，默认是 30 FPS
  *
  * 如果设置成 0 则会停止动画
  * @param fps 目标帧率，默认 30 FPS
  */
  abstract override setFPS(fps: number): void;
  /**
  * 暂停背景动画，画面即便是更新了图片也不会发生变化
  */
  abstract override pause(): void;
  /**
  * 恢复播放背景动画
  */
  abstract override resume(): void;
  /**
  * 设置背景专辑资源，纹理加载并设置完成后会返回
  * @param albumSource 专辑的资源链接，可以是图片或视频链接，抑或是任意 img/video 元素，如果提供字符串链接且为视频则需要指定第二个参数
  */
  abstract override setAlbum(albumSource: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
  dispose(): void;
  override getElement(): HTMLElement;
}
//#endregion
//#region src/bg-render/mesh-renderer/index.d.ts
declare class ControlPoint {
  color: Vec3;
  location: Vec2;
  uTangent: Vec2;
  vTangent: Vec2;
  private _uRot;
  private _vRot;
  private _uScale;
  private _vScale;
  constructor();
  get uRot(): number;
  get vRot(): number;
  set uRot(value: number);
  set vRot(value: number);
  get uScale(): number;
  get vScale(): number;
  set uScale(value: number);
  set vScale(value: number);
  private updateUTangent;
  private updateVTangent;
}
declare class MeshGradientRenderer extends BaseRenderer {
  private gl;
  private lastFrameTime;
  private frameTime;
  private lastTickTime;
  private smoothedVolume;
  private volume;
  private tickHandle;
  private maxFPS;
  private paused;
  private staticMode;
  private mainProgram;
  private quadProgram;
  private quadBuffer;
  private fbo;
  private fboTexture;
  private manualControl;
  private reduceImageSizeCanvas;
  private targetSize;
  private currentSize;
  private isNoCover;
  private meshStates;
  private _disposed;
  private frameCount;
  private lastFPSUpdate;
  private currentFPS;
  private enablePerformanceMonitoring;
  setManualControl(enable: boolean): void;
  setWireFrame(enable: boolean): void;
  getControlPoint(x: number, y: number): ControlPoint | undefined;
  resizeControlPoints(width: number, height: number): void;
  resetSubdivition(subDivisions: number): void;
  private onTick;
  private checkIfResize;
  private updateFBO;
  private onRedraw;
  private onTickBinded;
  private requestTick;
  constructor(canvas: HTMLCanvasElement);
  protected override onResize(width: number, height: number): void;
  override setStaticMode(enable: boolean): void;
  override setFPS(fps: number): void;
  override pause(): void;
  override resume(): void;
  override setAlbum(albumSource?: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
  override setLowFreqVolume(volume: number): void;
  override setHasLyric(_hasLyric: boolean): void;
  override dispose(): void;
  enablePerformanceMonitor(enable: boolean): void;
  getCurrentFPS(): number;
  private updatePerformanceStats;
}
//#endregion
//#region src/bg-render/pixi-renderer.d.ts
declare class PixiRenderer extends BaseRenderer {
  protected override canvas: HTMLCanvasElement;
  private app;
  private curContainer?;
  private staticMode;
  private lastContainer;
  private onTick;
  constructor(canvas: HTMLCanvasElement);
  protected override onResize(width: number, height: number): void;
  override setRenderScale(scale: number): void;
  private rebuildFilters;
  override setStaticMode(enable?: boolean): void;
  override setFPS(fps: number): void;
  override pause(): void;
  override resume(): void;
  override setLowFreqVolume(_volume: number): void;
  override setHasLyric(_hasLyric: boolean): void;
  override setAlbum(albumSource?: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
  override dispose(): void;
  override getElement(): HTMLElement;
}
//#endregion
//#region src/bg-render/index.d.ts
declare class BackgroundRender<Renderer extends BaseRenderer> implements AbstractBaseRenderer {
  private element;
  private renderer;
  constructor(renderer: Renderer, canvas: HTMLCanvasElement);
  static new<Renderer extends BaseRenderer>(type: {
    new (canvas: HTMLCanvasElement): Renderer;
  }): BackgroundRender<Renderer>;
  setRenderScale(scale: number): void;
  setFlowSpeed(speed: number): void;
  setStaticMode(enable: boolean): void;
  setFPS(fps: number): void;
  pause(): void;
  resume(): void;
  setLowFreqVolume(volume: number): void;
  setHasLyric(hasLyric: boolean): void;
  setAlbum(albumSource: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
  getElement(): HTMLCanvasElement;
  dispose(): void;
}
declare namespace spring_d_exports {
  export { Spring, SpringParams };
}
/** MIT License github.com/pushkine/ */
interface SpringParams {
  mass: number;
  damping: number;
  stiffness: number;
  soft: boolean;
}
declare class Spring {
  private currentPosition;
  private targetPosition;
  private currentTime;
  private params;
  private currentSolver;
  private getV;
  private getV2;
  private queueParams;
  private queuePosition;
  constructor(currentPosition?: number);
  private resetSolver;
  arrived(): boolean;
  setPosition(targetPosition: number): void;
  update(delta?: number): void;
  updateParams(params: Partial<SpringParams>, delay?: number): void;
  setTargetPosition(targetPosition: number, delay?: number): void;
  getCurrentPosition(): number;
}
//#endregion
//#region src/lyric-player/dom/interlude-dots.d.ts
declare class InterludeDots implements HasElement, Disposable {
  private element;
  private dot0;
  private dot1;
  private dot2;
  private left;
  private top;
  private playing;
  private lastStyle;
  private currentInterlude?;
  private currentTime;
  private targetBreatheDuration;
  constructor();
  getElement(): HTMLElement;
  setTransform(left?: number, top?: number): void;
  setInterlude(interlude?: [number, number]): void;
  pause(): void;
  resume(): void;
  update(delta?: number): void;
  dispose(): void;
}
//#endregion
//#region src/lyric-player/base/bottom-line.d.ts
interface LineTransforms$1 {
  posX: Spring;
  posY: Spring;
}
declare class BottomLineEl implements HasElement, Disposable {
  private lyricPlayer;
  private element;
  private left;
  private top;
  private delay;
  lineSize: [number, number];
  readonly lineTransforms: LineTransforms$1;
  private isFocused;
  private blur;
  constructor(lyricPlayer: LyricPlayerBase);
  measureSize(): Promise<[number, number]>;
  private lastStyle;
  show(): void;
  hide(): void;
  setFocused(focused: boolean): void;
  private rebuildStyle;
  getElement(): HTMLElement;
  setTransform(left?: number, top?: number, blur?: number, force?: boolean, delay?: number): void;
  update(delta?: number): void;
  get isInSight(): boolean;
  dispose(): void;
}
//#endregion
//#region src/lyric-player/base/consts.d.ts
type ValueOf<T extends Record<PropertyKey, unknown>> = T[keyof T];
/** 歌词中不雅用语的掩码模式 */
declare const MaskObsceneWordsMode: {
  /** 禁用任何不雅用语掩码 */readonly Disabled: ""; /** 完全掩码所有不雅用语 */
  readonly FullMask: "full-mask"; /** 保留首尾字符，屏蔽中间字符 */
  readonly PartialMask: "partial-mask";
};
/** 歌词中不雅用语的掩码模式枚举类型，见 {@link MaskObsceneWordsMode} */
type MaskObsceneWordsMode = ValueOf<typeof MaskObsceneWordsMode>;
/**
* 歌词行的渲染模式
* @internal
*/
declare const LyricLineRenderMode: {
  readonly SOLID: 0;
  readonly GRADIENT: 1;
};
/**
* 歌词行的渲染模式枚举类型，见 {@link LyricLineRenderMode}
* @internal
*/
type LyricLineRenderMode = ValueOf<typeof LyricLineRenderMode>;
/** 布局对齐锚点 */
declare const LayoutAlignAnchor: {
  readonly Top: "top";
  readonly Center: "center";
  readonly Bottom: "bottom";
};
/** 布局对齐锚点枚举类型，见 {@link LayoutAlignAnchor} */
type LayoutAlignAnchor = ValueOf<typeof LayoutAlignAnchor>;
//#endregion
//#region src/lyric-player/base/line.d.ts
interface LineTransforms {
  scale: Spring;
}
/**
* 所有标准歌词行的基类
* @internal
*/
declare abstract class LyricLineBase extends EventTarget implements Disposable {
  protected top: number;
  protected scale: number;
  protected blur: number;
  protected opacity: number;
  protected delay: number;
  readonly lineTransforms: LineTransforms;
  /**
  * 用于 CJK 词语边界检测的分词器
  */
  static readonly wordSegmenter: Intl.Segmenter | null;
  /**
  * Unicode 标准的全局 Grapheme Cluster 分词器
  * 用于正确处理 emoji、复合字符等
  */
  static readonly graphemeSegmenter: Intl.Segmenter | null;
  abstract getLine(): LyricLine;
  abstract enable(time?: number, shouldPlay?: boolean): void;
  abstract disable(): void;
  abstract resume(): void;
  abstract pause(): void;
  abstract onLineSizeChange(size: [number, number]): void;
  setTransform(scale?: number, opacity?: number, blur?: number, _force?: boolean, delay?: number, _mode?: LyricLineRenderMode): void;
  rebuildElement(): void;
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
  static shouldEmphasize(word: LyricWord): boolean;
  abstract update(delta?: number): void;
  dispose(): void;
}
//#endregion
//#region src/lyric-player/base/group.d.ts
interface LyricPlayerFlags {
  getEnableSpring(): boolean;
  getEnableScale(): boolean;
  getIsPlaying(): boolean;
  getAlwaysPostpositionBackground(): boolean;
}
declare abstract class LyricLineGroupBase<T extends LyricLineBase = LyricLineBase> implements Disposable {
  mainLine: T;
  bgLine?: T | undefined;
  protected abstract readonly lyricPlayer: LyricPlayerFlags;
  posY: Spring;
  bgSlideY: Spring;
  top: number;
  delay: number;
  isActive: boolean;
  opacity: number;
  blur: number;
  isBgFirst: boolean;
  constructor(mainLine: T, bgLine?: T | undefined);
  get startTime(): number;
  get endTime(): number;
  onLineSizeChange(size: [number, number]): void;
  setTransform(top: number, force: boolean, delay: number, isActive: boolean, opacity: number, blur: number): void;
  private setLineTransformations;
  protected abstract renderStyles(): void;
  abstract get isInSight(): boolean;
  update(delta: number): void;
  rebuildAllLines(): void;
  enable(time?: number, shouldPlay?: boolean): void;
  disable(): void;
  dispose(): void;
}
//#endregion
//#region src/lyric-player/base/layout.d.ts
/**
* 播放器布局状态。
*
* 这部分状态保存布局计算阶段所需的配置项与缓存值，
* 例如对齐方式、间奏点尺寸、上一轮布局命中的目标行等。
* 不描述播放时间线或用户滚动交互，仅记录当前歌词排布。
*/
interface PlayerLayoutState {
  /** 间奏点元素当前测量得到的尺寸 */
  interludeDotsSize: [number, number];
  /** 上一轮布局实际对齐的目标歌词行索引 */
  targetAlignIndex: number;
  /** 上一轮布局时是否处于间奏区间 */
  lastInterludeState: boolean;
  /** 当前歌词目标行的对齐锚点 */
  alignAnchor: LayoutAlignAnchor;
  /** 当前歌词目标行在播放器高度中的相对对齐位置 */
  alignPosition: number;
  /** 视口上下额外保留的预渲染距离，单位为像素 */
  overscanPx: number;
}
//#endregion
//#region src/lyric-player/base/scroll.d.ts
/**
* 播放器滚动状态。
*
* 这部分状态描述用户手势/滚轮滚动产生的临时偏移，以及当前允许滚动的范围。
* 改状态仅记录用户如何把当前视图上下拖动，不决定应该滚动到哪一行，
* 后者由时间线状态与布局计算共同决定。
*/
interface PlayerScrollState {
  /** 允许的滚动偏移范围 */
  scrollBoundary: {
    /** 允许的最小偏移量 */minOffset: number; /** 允许的最大偏移量 */
    maxOffset: number;
  };
  /** 当前用户滚动带来的额外偏移量 */
  scrollOffset: number;
  /** 是否允许用户通过手势或滚轮滚动歌词视图 */
  allowScroll: boolean;
  /** 是否处于用户滚动过，尚未回归自动对齐的状态 */
  isScrolled: boolean;
  /** 是否正在进行滚动交互或惯性滚动 */
  isUserScrolling: boolean;
}
//#endregion
//#region src/lyric-player/base/timeline.d.ts
/**
* 播放时间线状态。
*
* 描述播放器在时间轴上的当前位置，当前处于激活状态的歌词组信息
*/
interface PlayerTimelineState {
  /** 当前播放时间，单位为毫秒 */
  currentTime: number;
  /** 上一次提交到时间线状态的播放时间，单位为毫秒 */
  lastCurrentTime: number;
  /** 热行：当前时间 {@link currentTime} 正在命中的组（含主行+可能的背景行） */
  hotGroups: Set<number>;
  /** 缓冲组：UI 上还保持激活表现的组索引，通常包含热组，和刚结束仍在过渡中的组 */
  bufferedGroups: Set<number>;
  /** 当前应滚动对齐到的歌词组索引 */
  scrollToIndex: number;
  /** 是否正在拖拽进度条。若是，更新时丢弃缓冲行，并根据当前时间直接计算热行 */
  isSeeking: boolean;
  /** 是否处于播放状态 */
  isPlaying: boolean;
  /** 是否已经完成至少一次初始布局 */
  initialLayoutFinished: boolean;
}
//#endregion
//#region src/lyric-player/base/index.d.ts
/**
* 歌词播放器的基类，已经包含了有关歌词操作和排版的功能，
* 子类需要为其实现对应的显示展示操作
*/
declare abstract class LyricPlayerBase extends EventTarget implements HasElement, Disposable {
  protected element: HTMLElement;
  abstract get baseFontSize(): number;
  /** 播放时间线状态 */
  protected timelineState: PlayerTimelineState;
  /** @internal */
  lyricGroupElementMap: WeakMap<Element, LyricLineGroupBase>;
  protected currentLyricLines: LyricLine[];
  protected processedLines: LyricLine[];
  protected lyricLinesIndexes: WeakMap<LyricLineBase, number>;
  protected isNonDynamic: boolean;
  protected hasDuetLine: boolean;
  protected disableSpring: boolean;
  protected layoutState: PlayerLayoutState;
  protected interludeDots: InterludeDots;
  protected bottomLine: BottomLineEl;
  protected enableBlur: boolean;
  protected enableScale: boolean;
  protected maskObsceneWords: MaskObsceneWordsMode;
  protected maskObsceneWordChar: string;
  protected hidePassedLines: boolean;
  protected scrollState: PlayerScrollState;
  currentLyricGroups: LyricLineGroupBase[];
  lyricGroupSize: WeakMap<LyricLineGroupBase, [number, number]>;
  readonly size: [number, number];
  protected isPageVisible: boolean;
  protected optimizeOptions: OptimizeLyricOptions;
  /** 是否强制让背景人声行始终后置（即始终在主歌词下方显示，不前置背景人声） */
  protected alwaysPostpositionBackground: boolean;
  protected posXSpringParams: Partial<SpringParams>;
  protected posYSpringParams: Partial<SpringParams>;
  protected scaleSpringParams: Partial<SpringParams>;
  protected scaleForBGSpringParams: Partial<SpringParams>;
  private onPageShow;
  private onPageHide;
  private scrolledHandler;
  /** @internal */
  resizeObserver: ResizeObserver;
  protected wordFadeWidth: number;
  constructor(element?: HTMLElement);
  private beginScrollHandler;
  private endScrollHandler;
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
  setWordFadeWidth(value?: number): void;
  /**
  * 是否启用歌词行缩放效果，默认启用
  *
  * 如果启用，非选中的歌词行会轻微缩小以凸显当前播放歌词行效果
  *
  * 此效果对性能影响微乎其微，推荐启用
  * @param enable 是否启用歌词行缩放效果
  */
  setEnableScale(enable?: boolean): void;
  /**
  * 获取当前是否启用了歌词行缩放效果
  * @returns 是否启用歌词行缩放效果
  */
  getEnableScale(): boolean;
  /**
  * 获取当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
  * @returns 当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
  */
  getWordFadeWidth(): number;
  setIsSeeking(isSeeking: boolean): void;
  /**
  * 设置是否隐藏已经播放过的歌词行，默认不隐藏
  * @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
  */
  setHidePassedLines(hide: boolean): void;
  /**
  * 设置是否启用歌词行的模糊效果
  * @param enable 是否启用
  */
  setEnableBlur(enable: boolean): void;
  /**
  * 设置歌词中不雅用语的掩码模式
  * @param mode 掩码模式
  * @see {@link MaskObsceneWordsMode}
  */
  setMaskObsceneWords(mode: MaskObsceneWordsMode): void;
  /**
  * 设置不雅用语掩码使用的字符，默认为 `*`
  * @param char 单个字符，用于替换不雅用语中的字符
  */
  setMaskObsceneWordChar(char: string): void;
  rebuildLyricLines(): void;
  /**
  * 根据当前配置处理不雅用语单词
  * @param word 单词对象
  * @internal
  */
  processObsceneWord(word: LyricWord): string;
  /**
  * 设置目标歌词行的对齐方式，默认为 `center`
  *
  * - 设置成 `top` 的话将会向目标歌词行的顶部对齐
  * - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
  * - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
  * @param alignAnchor 歌词行对齐方式，详情见函数说明
  */
  setAlignAnchor(alignAnchor: LayoutAlignAnchor): void;
  /**
  * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
  * @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
  */
  setAlignPosition(alignPosition: number): void;
  /**
  * 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
  * @param px 像素值，默认 300
  */
  setOverscanPx(px: number): void;
  /** 获取当前 overscan 像素距离 */
  getOverscanPx(): number;
  /**
  * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
  *
  * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
  *
  * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
  */
  setEnableSpring(enable?: boolean): void;
  /**
  * 获取当前是否启用了物理弹簧
  * @returns 是否启用物理弹簧
  */
  getEnableSpring(): boolean;
  /**
  * 设置歌词的优化配置项，这些配置项默认全部开启
  *
  * 注意，如果在 `setLyricLines` 之后修改此配置，需要重新调用 `setLyricLines()` 才能对当前歌词生效
  * @param options 优化配置选项
  * @see {@link OptimizeLyricOptions}
  */
  setOptimizeOptions(options: OptimizeLyricOptions): void;
  /**
  * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
  * @param lines 歌词数组
  * @param initialTime 初始时间，默认为 0
  */
  setLyricLines(lines: LyricLine[], initialTime?: number): void;
  /**
  * 获取当前是否在播放
  * @returns 当前是否在播放
  */
  getIsPlaying(): boolean;
  /**
  * 设置当前播放进度，此时将会更新内部的歌词进度信息。
  *
  * 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好。
  * 调用完成后，应每帧调用 {@link update} 方法来执行歌词动画效果。**此函数本身不会触发动画效果**。
  *
  * @param time 当前播放进度，单位为毫秒
  */
  setCurrentTime(time: number, isSeek?: boolean): void;
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
  calcLayout(sync?: boolean, force?: boolean): Promise<void>;
  /**
  * 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
  *
  * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
  * @deprecated 考虑到横向弹簧效果并不常见，所以这个函数将会在未来的版本中移除
  */
  setLinePosXSpringParams(_params?: Partial<SpringParams>): void;
  /**
  * 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
  *
  * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
  */
  setLinePosYSpringParams(params?: Partial<SpringParams>): void;
  /**
  * 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
  *
  * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
  */
  setLineScaleSpringParams(params?: Partial<SpringParams>): void;
  /**
  * 暂停部分效果演出，目前会暂停播放间奏点的动画，且将背景歌词显示出来
  */
  pause(): void;
  /**
  * 恢复部分效果演出，目前会恢复播放间奏点的动画
  */
  resume(): void;
  /**
  * 更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：
  *
  * 1. 刚刚调用完设置歌词函数的时候
  * @param delta 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数）
  */
  update(delta?: number): void;
  protected onResize(): void;
  /**
  * 获取一个特殊的底栏元素，默认是空白的，可以往内部添加任意元素
  *
  * 这个元素始终在歌词的底部，可以用于显示歌曲创作者等信息
  *
  * 但是请勿删除该元素，只能在内部存放元素
  *
  * @returns 一个元素，可以往内部添加任意元素
  */
  getBottomLineElement(): HTMLElement;
  /**
  * 重置用户滚动状态
  *
  * 请在用户完成滚动点击跳转歌词时调用本事件再调用 `calcLayout` 以正确滚动到目标位置
  */
  resetScroll(): void;
  /**
  * 获取当前歌词数组
  *
  * 一般和最后调用 `setLyricLines` 给予的参数一样
  * @returns 当前歌词数组
  */
  getLyricLines(): LyricLine[];
  /**
  * 获取当前歌词的播放位置
  *
  * 一般和最后调用 `setCurrentTime` 给予的参数一样
  * @returns 当前播放位置
  */
  getCurrentTime(): number;
  /**
  * 设置是否让背景人声行始终后置显示
  *
  * 默认情况下，如果背景歌词开始时间早于主歌词，会在主歌词上方展示；
  * 如果设置为 `true`，则无论时间顺序如何，背景歌词都会始终在主歌词下方展示
  * @param enable 是否启用始终后置
  */
  setAlwaysPostpositionBackground(enable: boolean): void;
  /** 获取当前是否设置了让背景人声行始终后置显示 */
  getAlwaysPostpositionBackground(): boolean;
  getElement(): HTMLElement;
  dispose(): void;
}
//#endregion
//#region src/lyric-player/dom/lyric-line.d.ts
interface RealWord extends LyricWord {
  mainElement: HTMLSpanElement;
  subElements: HTMLSpanElement[];
  elementAnimations: Animation[];
  maskAnimations: Animation[];
  width: number;
  height: number;
  padding: number;
  shouldEmphasize: boolean;
}
declare class RawLyricLineMouseEvent extends MouseEvent {
  readonly line: LyricLineBase;
  constructor(line: LyricLineBase, event: MouseEvent);
}
type MouseEventMap = { [evt in keyof HTMLElementEventMap]: HTMLElementEventMap[evt] extends MouseEvent ? evt : never };
type MouseEventTypes = MouseEventMap[keyof MouseEventMap];
type MouseEventListener = (this: LyricLineEl, ev: RawLyricLineMouseEvent) => void;
declare class LyricLineEl extends LyricLineBase {
  private lyricPlayer;
  private lyricLine;
  private element;
  private splittedWords;
  private built;
  lineSize: number[];
  private renderMode;
  private currentBrightAlpha;
  private currentDarkAlpha;
  private targetBrightAlpha;
  private targetDarkAlpha;
  /**
  * 用于平衡换行、尽量减少各行长度差异的类
  */
  private balancer?;
  constructor(lyricPlayer: DomLyricPlayer, lyricLine?: LyricLine);
  private listenersMap;
  private readonly onMouseEvent;
  addMouseEventListener(type: MouseEventTypes, callback: MouseEventListener | null, options?: boolean | AddEventListenerOptions | undefined): void;
  removeMouseEventListener(type: MouseEventTypes, callback: MouseEventListener | null, options?: boolean | EventListenerOptions | undefined): void;
  areWordsOnSameLine(word1: RealWord, word2: RealWord): boolean;
  private isEnabled;
  enable(maskAnimationTime?: number, shouldPlay?: boolean): Promise<void>;
  disable(): void;
  private lastWord?;
  resume(): Promise<void>;
  pause(): Promise<void>;
  setMaskAnimationState(maskAnimationTime?: number): void;
  getLine(): LyricLine;
  private lastStyle;
  show(): void;
  private rebuildStyle;
  override rebuildElement(): void;
  /** 设置翻译与音译行文本 */
  private setSubLinesText;
  private getRubyCharCount;
  private getRubySegments;
  private createWord;
  private buildWord;
  private initFloatAnimation;
  private initEmphasizeAnimation;
  private get totalDuration();
  override onLineSizeChange(_size: [number, number]): void;
  updateMaskImageSync(): void;
  private generateCalcBasedMaskImage;
  private generateWebAnimationBasedMaskImage;
  getElement(): HTMLElement;
  private updateMaskAlphaTargets;
  private applyAlphaToDom;
  override setTransform(scale?: number, opacity?: number, blur?: number, force?: boolean, delay?: number, mode?: LyricLineRenderMode): void;
  update(delta?: number): void;
  _getDebugTargetPos(): string;
  teardownContent(): void;
  private disposeElements;
  override dispose(): void;
}
//#endregion
//#region src/lyric-player/dom/lyric-group.d.ts
declare class LyricLineGroup extends LyricLineGroupBase<LyricLineEl> {
  lyricPlayer: DomLyricPlayer;
  element: HTMLElement;
  bgWrapper?: HTMLElement;
  private lastIsActive?;
  constructor(lyricPlayer: DomLyricPlayer, mainLine: LyricLineEl);
  get isInSight(): boolean;
  show(): void;
  hide(): void;
  override update(delta: number): void;
  addBgLine(bgLine: LyricLineEl): void;
  protected renderStyles(): void;
  override dispose(): void;
}
//#endregion
//#region src/lyric-player/dom/index.d.ts
/**
* 歌词行鼠标相关事件，可以获取到歌词行的索引和歌词行元素
*/
declare class LyricLineMouseEvent extends MouseEvent {
  /**
  * 歌词行索引
  */
  readonly lineIndex: number;
  /**
  * 歌词行元素
  */
  readonly line: LyricLineBase;
  constructor(lineIndex: number, line: LyricLineBase, event: MouseEvent);
}
type LyricLineMouseEventListener = (evt: LyricLineMouseEvent) => void;
/**
* 歌词播放组件，本框架的核心组件
*
* 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
*/
declare class DomLyricPlayer extends LyricPlayerBase {
  override currentLyricGroups: LyricLineGroup[];
  override onResize(): void;
  readonly supportPlusLighter: boolean;
  readonly supportMaskImage: boolean;
  readonly innerSize: [number, number];
  private readonly onLineClickedHandler;
  /**
  * 是否为非逐词歌词
  * @internal
  */
  _getIsNonDynamic(): boolean;
  private _baseFontSize;
  get baseFontSize(): number;
  constructor();
  private rebuildStyle;
  override setWordFadeWidth(value?: number): void;
  /**
  * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
  * @param lines 歌词数组
  * @param initialTime 初始时间，默认为 0
  */
  override setLyricLines(lines: LyricLine[], initialTime?: number): void;
  override pause(): void;
  override resume(): void;
  override update(delta?: number): void;
  override dispose(): void;
}
//#endregion
export { AbstractBaseRenderer, BackgroundRender, BaseRenderer, Disposable, DomLyricPlayer, DomLyricPlayer as LyricPlayer, HasElement, LayoutAlignAnchor, LyricLine, type LyricLineBase, LyricLineMouseEvent, LyricLineMouseEventListener, LyricLineRenderMode, LyricPlayerBase, LyricWord, LyricWordBase, MaskObsceneWordsMode, MeshGradientRenderer, OptimizeLyricOptions, PixiRenderer, type PlayerLayoutState, type PlayerScrollState, type PlayerTimelineState, type spring_d_exports as spring };
//# sourceMappingURL=amll-core.d.cts.map