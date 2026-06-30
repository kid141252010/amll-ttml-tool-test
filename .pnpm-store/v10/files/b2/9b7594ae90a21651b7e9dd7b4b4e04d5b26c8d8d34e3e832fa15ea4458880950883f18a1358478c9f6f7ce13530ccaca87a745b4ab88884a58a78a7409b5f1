//#region src/types.d.ts
/**
* 一个歌词单词
*/
interface LyricWord {
  /** 单词的起始时间 */
  startTime: number;
  /** 单词的结束时间 */
  endTime: number;
  /** 单词 */
  word: string;
  /** 单词的音译 */
  romanWord?: string;
}
/**
* 一行歌词，存储多个单词
* 如果是 LyRiC 等只能表达一行歌词的格式，则会将整行当做一个单词存储起来
*/
interface LyricLine {
  /**
  * 该行的所有单词
  * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词
  */
  words: LyricWord[];
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
  * 此选项只有作为 Lyricify Syllable 文件格式导入导出时才有意义
  */
  isBG: boolean;
  /**
  * 该行是否为对唱歌词行（即歌词行靠右对齐）
  * 此选项只有作为 Lyricify Syllable 文件格式导入导出时才有意义
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
* 一个 TTML 歌词行对象，存储了歌词行信息和 AMLL 元数据信息
*/
interface TTMLLyric {
  /**
  * TTML 中存储的歌词行信息
  */
  lines: LyricLine[];
  /**
  * 一个元数据表，以 `[键, 值数组]` 的形式存储
  */
  metadata: [string, string[]][];
}
//#endregion
//#region src/formats/ass.d.ts
/**
* 将歌词数组转换为 ASS 字幕格式字符串
* @param lines 歌词数组
* @returns ASS 字幕格式字符串
*/
declare function stringifyAss(lines: LyricLine[]): string;
//#endregion
//#region src/formats/eqrc/index.d.ts
/**
* 解密十六进制字符串格式的 Qrc 歌词数据
* 解密后可去头尾 XML 数据后通过调用 `parseQrc` 解析歌词行
* @param encryptedHexString 十六进制格式的字符串，代表被加密的歌词数据
* @returns 被解密出来的歌词字符串，是前后有 XML 混合的 QRC 歌词
*/
declare function decryptQrcHex(encryptedHexString: string): string;
/**
* 对明文执行加密操作。
* @param plaintext 明文字符串
* @returns 十六进制格式的字符串，代表被加密的歌词数据
*/
declare function encryptQrcHex(plaintext: string): string;
//#endregion
//#region src/formats/eslrc.d.ts
/**
* 解析 ESLyric 逐词歌词格式字符串
* @param eslrc 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseEslrc(eslrc: string): LyricLine[];
/**
* 将歌词数组转换为 ESLyric 逐词歌词格式字符串
* @param lines 歌词数组
* @returns ESLyric 逐词歌词格式字符串
*/
declare function stringifyEslrc(lines: LyricLine[]): string;
//#endregion
//#region src/formats/lqe.d.ts
/**
* 解析 LQE 格式的歌词字符串
* @param lqe 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseLqe(lqe: string): LyricLine[];
/**
* 将歌词数组转换为 LQE 格式的字符串
* @param lines 歌词数组
* @returns LQE 格式的字符串
*/
declare function stringifyLqe(lines: LyricLine[]): string;
//#endregion
//#region src/formats/lrc.d.ts
/**
* 解析 LyRiC 格式的歌词字符串
* @param lrc 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseLrc(lrc: string): LyricLine[];
/**
* 将歌词数组转换为 LyRiC 格式的字符串
* @param lines 歌词数组
* @returns LyRiC 格式的字符串
*/
declare function stringifyLrc(lines: LyricLine[]): string;
//#endregion
//#region src/formats/lrca2.d.ts
/**
* 解析 LRC A2 格式的歌词字符串
* @param lrc 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseLrcA2(lrc: string): LyricLine[];
/**
* 将歌词数组转换为 LRC A2 格式的字符串
* @param lines 歌词数组
* @returns LRC A2 格式的字符串
*/
declare function stringifyLrcA2(lines: LyricLine[]): string;
//#endregion
//#region src/formats/lyl.d.ts
/**
* 解析 LYL 格式的歌词字符串
* @param lyl 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseLyl(lyl: string): LyricLine[];
/**
* 将歌词数组转换为 LYL 格式的字符串
* @param lines 歌词数组
* @returns LYL 格式的字符串
*/
declare function stringifyLyl(lines: LyricLine[]): string;
//#endregion
//#region src/formats/lys.d.ts
/**
* 解析 LYS 格式的歌词字符串
* @param lys 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseLys(lys: string): LyricLine[];
/**
* 将歌词数组转换为 LYS 格式的字符串
* @param lines 歌词数组
* @returns LYS 格式的字符串
*/
declare function stringifyLys(lines: LyricLine[]): string;
//#endregion
//#region src/formats/qrc.d.ts
/**
* 解析 QRC 格式的歌词字符串
* @param qrc 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseQrc(qrc: string): LyricLine[];
/**
* 将歌词数组转换为 QRC 格式的字符串
* @param lines 歌词数组
* @returns QRC 格式的字符串
*/
declare function stringifyQrc(lines: LyricLine[]): string;
//#endregion
//#region src/formats/ttml.d.ts
/**
* 解析 TTML 格式（包含 AMLL 特有属性信息）的歌词字符串
* @param ttmlText 歌词字符串
* @returns 成功解析出来的 TTML 歌词对象
*/
declare function parseTTML(ttmlText: string): TTMLLyric;
/**
* 将歌词数组转换为 TTML 格式（包含 AMLL 特有属性信息）的歌词字符串
* @param ttmlLyric TTML 歌词对象
*/
declare function stringifyTTML(ttmlLyric: TTMLLyric): string;
//#endregion
//#region src/formats/yrc.d.ts
/**
* 解析 YRC 格式的歌词字符串
* @param yrc 歌词字符串
* @returns 成功解析出来的歌词
*/
declare function parseYrc(yrc: string): LyricLine[];
/**
* 将歌词数组转换为 YRC 格式的字符串
* @param lines 歌词数组
* @returns YRC 格式的字符串
*/
declare function stringifyYrc(lines: LyricLine[]): string;
//#endregion
//#region src/index.d.ts
/**
* {@link stringifyLrcA2} 的别名。
*
* @deprecated 此为兼容旧版本拼写错误的接口，请改用 `stringifyLrcA2`。此接口将在未来版本中移除。
*/
declare function stringifylrcA2(...args: Parameters<typeof stringifyLrcA2>): ReturnType<typeof stringifyLrcA2>;
//#endregion
export { type LyricLine, type LyricWord, type TTMLLyric, decryptQrcHex, encryptQrcHex, parseEslrc, parseLqe, parseLrc, parseLrcA2, parseLyl, parseLys, parseQrc, parseTTML, parseYrc, stringifyAss, stringifyEslrc, stringifyLqe, stringifyLrc, stringifyLrcA2, stringifyLyl, stringifyLys, stringifyQrc, stringifyTTML, stringifyYrc, stringifylrcA2 };
//# sourceMappingURL=amll-lyric.d.mts.map