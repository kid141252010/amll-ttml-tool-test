//#region src/types/dom.d.ts
/**
* 为了兼容 xmldom 和原生 dom 而定义的最小化类型
* @module dom-types
* @internal
*/
interface MinimalNode {
  readonly nodeType: number;
  textContent: string | null;
  readonly childNodes: ArrayLike<MinimalNode> | Iterable<MinimalNode>;
  readonly localName?: string | null;
  readonly tagName?: string;
  readonly nodeName?: string;
}
interface MinimalAttribute {
  localName?: string | null;
  nodeName: string;
  value: string;
}
interface MinimalElement extends MinimalNode {
  readonly localName: string | null;
  readonly tagName: string;
  readonly attributes: ArrayLike<MinimalAttribute> | Iterable<MinimalAttribute>;
  getAttribute(name: string): string | null;
  getAttributeNS(namespace: string | null, localName: string): string | null;
  hasAttributes(): boolean;
  setAttribute(name: string, value: string): void;
  setAttributeNS(namespace: string | null, qualifiedName: string, value: string): void;
  getElementsByTagName(name: string): ArrayLike<MinimalElement> | Iterable<MinimalElement>;
  getElementsByTagNameNS(namespaceURI: string, localName: string): ArrayLike<MinimalElement> | Iterable<MinimalElement>;
  appendChild(node: MinimalNode): MinimalNode;
}
interface MinimalDocument extends MinimalNode {
  readonly documentElement: MinimalElement | null;
  getElementsByTagName(name: string): ArrayLike<MinimalElement> | Iterable<MinimalElement>;
  createElement(tagName: string): MinimalElement;
  createElementNS(namespaceURI: string | null, qualifiedName: string): MinimalElement;
  createTextNode(data: string): MinimalNode;
}
interface MinimalDOMParser {
  parseFromString(string: string, type: DOMParserSupportedType | string): MinimalDocument;
}
interface MinimalDOMImplementation {
  createDocument(namespaceURI: string | null, qualifiedName: string | null, doctype?: MinimalNode | null): MinimalDocument;
}
interface MinimalXMLSerializer {
  serializeToString(root: MinimalNode): string;
}
//#endregion
//#region src/types/amll.d.ts
/**
* AMLL 所使用的较简单的数据结构
* @module amll-types
*/
/**
* 一个歌词单词
*/
interface AmllLyricWord extends LyricWordBase {
  /** 单词的音译内容 */
  romanWord?: string;
  /** 单词内容是否包含冒犯性的不雅用语 */
  obscene?: boolean;
  /** 单词的空拍数量，一般只用于方便歌词打轴 */
  emptyBeat?: number;
  /** 单词的注音内容 */
  ruby?: LyricWordBase[];
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
/**
* 一行歌词，存储多个单词
*/
interface AmllLyricLine {
  /**
  * 该行的所有单词
  */
  words: AmllLyricWord[];
  /**
  * 该行的翻译
  */
  translatedLyric: string;
  /**
  * 该行的音译
  */
  romanLyric: string;
  /**
  * 该行是否为背景歌词行
  */
  isBG: boolean;
  /**
  * 该行是否为对唱歌词行（即歌词行靠右对齐）
  */
  isDuet: boolean;
  /**
  * 该行的开始时间
  *
  * **并不总是等于第一个单词的开始时间**
  */
  startTime: number;
  /**
  * 该行的结束时间
  *
  * **并不总是等于最后一个单词的开始时间**
  */
  endTime: number;
}
/**
* 一个元数据，以 `[键, 值数组]` 的形式存储
*/
type AmllMetadata = [string, string[]];
/**
* 一个 TTML 歌词对象，存储了歌词行信息和 AMLL 元数据信息
*/
interface AmllLyricResult {
  /**
  * TTML 中存储的歌词行信息
  */
  lines: AmllLyricLine[];
  /**
  * 一个元数据表，以 `[键, 值数组]` 的形式存储
  */
  metadata: AmllMetadata[];
}
/**
* 解析器生成的原始 TTML 数据结构转换为 AMLL 的数据结构时的配置选项
*/
interface TTMLToAmllOptions {
  /**
  * 提取翻译时的首选目标语言 (如 `"zh-Hans"`)
  *
  * 未提供或找不到指定的目标语言代码时提取第一个翻译
  */
  translationLanguage?: string;
  /**
  * 提取音译时的首选目标语言 (如 `"ja-Latn"`)
  *
  * 未提供或找不到指定的目标语言代码时提取第一个音译
  */
  romanizationLanguage?: string;
}
/**
* AMLL 简单的数据结构转换为解析器内部复杂的 TTML 数据结构时的配置选项
*/
interface AmllToTTMLOptions {
  /**
  * 翻译的目标语言代码
  * @default "zh-Hans"
  */
  translationLanguage?: string;
  /**
  * 音译的目标语言代码
  * @default undefined
  */
  romanizationLanguage?: string;
}
//#endregion
//#region src/types/index.d.ts
/**
* 解析器配置选项
*/
interface TTMLParserOptions {
  /**
  * 注入的 DOMParser 实例
  * - 浏览器环境: 可忽略，默认使用 window.DOMParser
  * - Node.js 环境: 必须传入 (例如: `new (require('@xmldom/xmldom').DOMParser)()`)
  */
  domParser?: MinimalDOMParser;
}
/**
* 生成器配置选项
*/
interface GeneratorOptions {
  /**
  * 注入的 DOMImplementation 实例
  * - 浏览器: 可忽略，默认使用 document.implementation
  * - Node.js 环境: 必须传入 (例如: `new (require('@xmldom/xmldom').DOMImplementation)()`)
  */
  domImplementation?: MinimalDOMImplementation;
  /**
  * 注入的 XMLSerializer 实例
  * - 浏览器: 可忽略，默认使用 new XMLSerializer()
  * - Node.js 环境: 必须传入 (例如: `new (require('@xmldom/xmldom').XMLSerializer)()`)
  */
  xmlSerializer?: MinimalXMLSerializer;
  /**
  * 对于逐行翻译/音译，是否将其放入 Head (Apple Music 风格)
  *
  * 注意逐字翻译/音译将始终强制放入 Head，无论此值如何
  * @default false
  */
  useSidecar?: boolean;
}
/**
* 翻译/音译的内容
*/
interface SubLyricContent {
  /**
  * 该内容的 BCP-47 语言代码
  */
  language?: string;
  /**
  * 完整文本
  */
  text: string;
  /**
  * 逐字音节信息
  */
  words?: Syllable[];
}
/**
* 背景人声内容
*/
type BackgroundVocal = Omit<LyricBase, "backgroundVocal">;
/**
* 基础歌词内容
*/
interface LyricBase {
  /**
  * 完整的文本内容
  * - 如果是逐字歌词，这里是所有字拼接后的结果
  */
  text: string;
  /**
  * 开始时间，单位毫秒
  */
  startTime: number;
  /**
  * 结束时间，单位毫秒
  */
  endTime: number;
  /**
  * 逐字音节信息
  *
  * 如果数组为空或未定义，一般就是逐行歌词
  */
  words?: Syllable[];
  /**
  * 翻译内容
  */
  translations?: SubLyricContent[];
  /**
  * 音译内容
  */
  romanizations?: SubLyricContent[];
  /**
  * 背景人声内容
  */
  backgroundVocal?: BackgroundVocal;
}
/**
* 一个主歌词行
*/
interface LyricLine extends LyricBase {
  /**
  * 行 ID
  *
  * 例如 "L1", "L2"...
  */
  id?: string;
  /**
  * 演唱者 ID
  *
  * 可用于在 metadata.agents 中查找具体名字
  */
  agentId?: string;
  /**
  * 歌曲结构组成
  *
  * 例如: "Verse", "Chorus", "Intro", "Outro"
  */
  songPart?: string;
  /**
  * 所属的递增区块索引
  *
  * 用于区分连续出现但属于不同 div 的同名 songPart
  */
  blockIndex?: number;
}
/**
* Ruby 标注的单个注音音节
*/
interface RubyTag {
  /**
  * 注音文本内容
  */
  text: string;
  /**
  * 该注音的开始时间，单位毫秒
  */
  startTime: number;
  /**
  * 该注音的结束时间，单位毫秒
  */
  endTime: number;
}
/**
* 一个歌词音节
*/
interface Syllable {
  /**
  * 该音节的内容
  * - 如果是普通音节，为常规歌词文本
  * - 如果是 Ruby 标注，这里对应 ruby 的基文本，通常为汉字
  */
  text: string;
  /**
  * 该音节的开始时间，单位毫秒
  * - 如果是 Ruby 标注，此值为第一个 RubyTag 的 startTime
  */
  startTime: number;
  /**
  * 该音节的结束时间，单位毫秒
  * - 如果是 Ruby 标注，此值为最后一个 RubyTag 的 endTime
  */
  endTime: number;
  /**
  * 该音节后面是否应该跟着一个空格
  *
  * 注意必须根据此标志在歌词后面添加空格，text 中不应包含空格
  */
  endsWithSpace?: boolean;
  /**
  * Ruby 标注信息
  *
  * 如果存在此属性，说明该音节是一个 Ruby 容器
  */
  ruby?: RubyTag[];
  /**
  * 单词内容是否包含冒犯性的不雅用语
  */
  obscene?: boolean;
  /**
  * 单词的空拍数量，一般只用于方便歌词打轴
  */
  emptyBeat?: number;
}
/**
* 演唱者信息结构
*/
interface Agent {
  /**
  * 演唱者的 ID
  *
  * 如果是 AMLL 的 TTML，只有 v1 和 v2 分别指代非对唱和对唱。
  * 如果是 Apple Music 的 TTML，还会出现 v3，v4 等指代每个演唱者，以及 v1000 用于指代合唱。
  */
  id: string;
  /**
  * 演唱者名称
  */
  name?: string;
  /**
  * 演唱者类型
  *
  * 通常为 "person", "group", "other"，也有可能是其他字符串
  */
  type?: string;
}
/**
* 元数据中的各个平台 ID
*/
type PlatformId = "ncmMusicId" | "qqMusicId" | "spotifyId" | "appleMusicId";
/**
* TTML 歌词的元数据内容
*/
interface TTMLMetadata {
  /**
  * 歌词主语言代码 (BCP-47)
  */
  language?: string;
  /**
  * 计时模式
  */
  timingMode?: "Word" | "Line";
  /**
  * 歌曲创作者列表
  */
  songwriters?: string[];
  /**
  * 歌曲标题列表
  */
  title?: string[];
  /**
  * 艺术家名称列表
  */
  artist?: string[];
  /**
  * 专辑名称列表
  */
  album?: string[];
  /**
  * ISRC 号码列表
  */
  isrc?: string[];
  /**
  * 歌词作者 GitHub 数字 ID 列表
  */
  authorIds?: string[];
  /**
  * 歌词作者 GitHub 用户名列表
  */
  authorNames?: string[];
  /**
  * 演唱者映射表
  */
  agents?: Record<string, Agent>;
  /**
  * 平台关联 ID
  */
  platformIds?: Partial<Record<PlatformId, string[]>>;
  /**
  * 其他原始的自定义属性
  */
  rawProperties?: Record<string, string[]>;
}
/**
* 解析器返回的结果对象
*/
interface TTMLResult {
  /**
  * TTML 歌词的元数据内容
  */
  metadata: TTMLMetadata;
  /**
  * 所有的歌词行
  */
  lines: LyricLine[];
}
//#endregion
//#region src/generator.d.ts
/**
* TTML 歌词生成器类
*
* 用于将内部的 {@link TTMLResult} 数据结构序列化为 AMLL 项目使用的 TTML 字符串
* @see https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83
*/
declare class TTMLGenerator {
  private domImpl;
  private options;
  private xmlSerializer;
  private doc!;
  private timingMode;
  /**
  * 构造一个 TTML 生成器实例
  *
  * @param options 生成器配置选项
  *
  * 在 Node.js 环境下必须注入 `domImplementation` 和 `xmlSerializer` 实例（例如用 `@xmldom/xmldom` 等）
  */
  constructor(options?: GeneratorOptions);
  /**
  * 生成 TTML 字符串的静态便捷方法
  * @param result 包含元数据和歌词行的 TTML 数据结构
  * @param options 生成器配置选项，用于注入 DOM 依赖及自定义部分生成行为
  * @returns 序列化后的 TTML 字符串
  */
  static generate(result: TTMLResult, options?: GeneratorOptions): string;
  /**
  * 生成 TTML 字符串
  * @param result 包含元数据和歌词行的 TTML 数据结构
  * @returns 序列化后的 TTML 字符串
  */
  generate(result: TTMLResult): string;
  private setupRootAttributes;
  private isLyricBase;
  private isWordByWord;
  private shouldMoveToSidecar;
  private buildHead;
  private buildITunesMetadata;
  private buildBody;
  private pairSubContents;
  private appendContentToElement;
  private appendWords;
  private appendRubySyllable;
  private appendNormalSyllable;
  private appendSubLyrics;
  private appendBackgroundVocal;
  private formatTime;
}
//#endregion
//#region src/parser.d.ts
/**
* TTML 歌词生成器类
*
* 用于将 AMLL 项目使用的 TTML 字符串解析为结构化的 {@link TTMLResult} 数据结构
* @see https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83
*/
declare class TTMLParser {
  private domParser;
  private static readonly TIME_REGEX;
  private static readonly LEADING_SPACE_REGEX;
  private static readonly TRAILING_SPACE_REGEX;
  private static readonly MULTI_SPACE_REGEX;
  private normalizeText;
  /**
  * 构造一个 TTML 解析器实例
  *
  * @param options 生成器配置选项
  *
  * 在 Node.js 环境下必须注入 `domParser` 实例（例如用 `@xmldom/xmldom` 等）
  */
  constructor(options?: TTMLParserOptions);
  /**
  * 解析 TTML 字符串的静态便捷方法
  * @param xmlStr 需要解析的 TTML XML 字符串
  * @param options 解析器配置选项，用于注入 DOM 依赖
  * @returns 解析后的结构化 TTML 数据结构
  * @throws 当输入的 XML 字符串格式无效时抛出异常
  */
  static parse(xmlStr: string, options?: TTMLParserOptions): TTMLResult;
  /**
  * 解析 TTML 字符串
  * @param xmlStr 需要解析的 TTML XML 字符串
  * @returns 解析后的结构化 TTML 数据结构
  * @throws 当输入的 XML 字符串格式无效时抛出异常
  */
  parse(xmlStr: string): TTMLResult;
  private inferTimingMode;
  private sortPlatformIds;
  private parseHead;
  private deduplicateMetadata;
  private parseTTMElements;
  private parseAMLLMeta;
  private extractSubContent;
  private parseiTunesExtensions;
  private parseTime;
  private parseBody;
  private processLineElement;
  private parseCommonContent;
  private extractNodeState;
  private calculateTimeRange;
  private applyFallbackWord;
  private buildLyricBase;
  private processTextNode;
  private processElementNode;
  private processRubyElement;
  private processWordElement;
  private parseBackgroundVocal;
  private parseInlineSubContent;
  private finalizeWords;
  private getAttr;
}
//#endregion
//#region src/utils/amll-converter.d.ts
/**
* 将本解析器复杂的数据结构降级为 AMLL 所使用的较简单的数据结构
*/
declare function toAmllLyrics(result: TTMLResult, options?: TTMLToAmllOptions): AmllLyricResult;
/**
* 将 AMLL 格式的歌词和元数据转换为 TTMLResult 结构
*/
declare function toTTMLResult(amllLines: AmllLyricLine[], amllMetadata: AmllMetadata[], options?: AmllToTTMLOptions): TTMLResult;
//#endregion
//#region src/index.d.ts
/**
* 将 TTML 格式的 XML 字符串解析为 {@link AmllLyricResult} 对象的便捷方法
*
* 若需要原始的、内容更丰富的 {@link TTMLResult} 结构，建议直接使用 {@link TTMLParser} 类
*
* @remarks 默认使用全局的 `DOMParser`，若为 Nodejs 环境，必须使用
* {@link TTMLParser} 类注入 `DOMParser` 实现，例如 `@xmldom/xmldom`
* @param ttmlText 符合 TTML 规范的 XML 字符串
* @returns 解析后的 {@link AmllLyricResult} 对象，包含歌词行列表和元数据
* @throws 如果没有全局的 `DOMParser`，抛出错误
*/
declare function parseTTML(ttmlText: string): AmllLyricResult;
/**
* 将 {@link AmllLyricResult} 对象序列化为 TTML 格式的 XML 字符串的便捷方法
*
* 若需要自定义生成选项，建议直接使用 {@link TTMLParser} 类
* @remarks 默认使用全局的 `document.implementation` 和 `XMLSerializer`，若为 Nodejs 环境，
* 必须使用 {@link TTMLGenerator} 类注入 `domImplementation` 和 `xmlSerializer`，例如 `@xmldom/xmldom`
* @param ttmlLyric 包含歌词行列表和元数据的 {@link AmllLyricResult} 对象
* @returns 序列化后的 TTML XML 字符串
* @throws 如果没有全局的 `DOMImplementation` 和 `XMLSerializer`，抛出错误
*/
declare function exportTTML(ttmlLyric: AmllLyricResult): string;
//#endregion
export { Agent, AmllLyricLine, AmllLyricResult, AmllLyricWord, AmllMetadata, AmllToTTMLOptions, BackgroundVocal, GeneratorOptions, LyricBase, LyricLine, LyricWordBase, PlatformId, RubyTag, SubLyricContent, Syllable, TTMLGenerator, TTMLMetadata, TTMLParser, TTMLParserOptions, TTMLResult, TTMLToAmllOptions, exportTTML, parseTTML, toAmllLyrics, toTTMLResult };
//# sourceMappingURL=amll-ttml.d.cts.map