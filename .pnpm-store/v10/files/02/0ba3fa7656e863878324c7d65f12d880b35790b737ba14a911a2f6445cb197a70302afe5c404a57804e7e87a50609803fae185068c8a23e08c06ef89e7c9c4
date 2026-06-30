//#region src/constants.ts
/**
* 一些常量定义
* @module constants
* @internal
*/
const NS = {
	TT: "http://www.w3.org/ns/ttml",
	TTM: "http://www.w3.org/ns/ttml#metadata",
	ITUNES: "http://music.apple.com/lyric-ttml-internal",
	AMLL: "http://www.example.com/ns/amll",
	XML: "http://www.w3.org/XML/1998/namespace",
	XMLNS: "http://www.w3.org/2000/xmlns/",
	ITUNES_INTERNAL: "http://music.apple.com/lyric-ttml-internal",
	TTS: "http://www.w3.org/ns/ttml#styling"
};
const Elements = {
	TT: "tt",
	Head: "head",
	Body: "body",
	Div: "div",
	P: "p",
	Span: "span",
	Title: "title",
	Name: "name",
	Meta: "meta",
	ITunesMetadata: "iTunesMetadata",
	TTMLMetadata: "metadata",
	Songwriters: "songwriters",
	Songwriter: "songwriter",
	Translation: "translation",
	Translations: "translations",
	Transliteration: "transliteration",
	Transliterations: "transliterations",
	Text: "text",
	ParserError: "parsererror",
	Agent: "agent"
};
const Attributes = {
	Timing: "timing",
	Id: "id",
	Key: "key",
	Value: "value",
	Lang: "lang",
	For: "for",
	SongPart: "songPart",
	SongPartKebab: "song-part",
	Begin: "begin",
	End: "end",
	Role: "role",
	Type: "type",
	Dur: "dur",
	Xmlns: "xmlns",
	Ruby: "ruby",
	Obscene: "obscene",
	EmptyBeat: "empty-beat"
};
const QualifiedAttributes = {
	ITunesTiming: "itunes:timing",
	ITunesPart: "itunes:songPart",
	ITunesKey: "itunes:key",
	TTMAgent: "ttm:agent",
	TTMRole: "ttm:role",
	TTMName: "ttm:name",
	AmllMeta: "amll:meta",
	AmllObscene: "amll:obscene",
	AmllEmptyBeat: "amll:empty-beat",
	XmlLang: "xml:lang",
	XmlId: "xml:id",
	XmlnsTtm: "xmlns:ttm",
	XmlnsTts: "xmlns:tts",
	XmlnsItunes: "xmlns:itunes",
	XmlnsAmll: "xmlns:amll",
	TtsRuby: "tts:ruby"
};
const Values = {
	Word: "Word",
	Line: "Line",
	MimeXML: "application/xml",
	MusicName: "musicName",
	Artists: "artists",
	Album: "album",
	ISRC: "isrc",
	TTMLAuthorGithub: "ttmlAuthorGithub",
	TTMLAuthorGithubLogin: "ttmlAuthorGithubLogin",
	NCMMusicId: "ncmMusicId",
	QQMusicId: "qqMusicId",
	SpotifyId: "spotifyId",
	AppleMusicId: "appleMusicId",
	RoleBg: "x-bg",
	RoleTranslation: "x-translation",
	RoleRoman: "x-roman",
	Group: "group",
	Person: "person",
	Other: "other",
	Full: "full",
	AgentGroup: "v1000",
	AgentDefault: "v1",
	AgentDefaultDuet: "v2",
	RubyContainer: "container",
	RubyBase: "base",
	RubyTextContainer: "textContainer",
	RubyText: "text",
	True: "true",
	TimingMode: "timingMode",
	Language: "language"
};
//#endregion
//#region src/generator.ts
/**
* 核心的 TTML 生成器实现
* @module generator
*/
/**
* TTML 歌词生成器类
*
* 用于将内部的 {@link TTMLResult} 数据结构序列化为 AMLL 项目使用的 TTML 字符串
* @see https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83
*/
var TTMLGenerator = class TTMLGenerator {
	domImpl;
	options;
	xmlSerializer;
	doc;
	timingMode = "Line";
	/**
	* 构造一个 TTML 生成器实例
	*
	* @param options 生成器配置选项
	*
	* 在 Node.js 环境下必须注入 `domImplementation` 和 `xmlSerializer` 实例（例如用 `@xmldom/xmldom` 等）
	*/
	constructor(options = {}) {
		this.options = options;
		if (this.options.domImplementation) this.domImpl = this.options.domImplementation;
		else if (typeof document !== "undefined" && document.implementation) this.domImpl = document.implementation;
		else throw new Error("No DOMImplementation found. If you are running in Node.js, please inject via options (e.g., using @xmldom/xmldom in Node.js).");
		if (this.options.xmlSerializer) this.xmlSerializer = this.options.xmlSerializer;
		else if (typeof XMLSerializer !== "undefined") this.xmlSerializer = new XMLSerializer();
		else throw new Error("No XMLSerializer found. If you are running in Node.js, please inject via options (e.g., using @xmldom/xmldom in Node.js).");
	}
	/**
	* 生成 TTML 字符串的静态便捷方法
	* @param result 包含元数据和歌词行的 TTML 数据结构
	* @param options 生成器配置选项，用于注入 DOM 依赖及自定义部分生成行为
	* @returns 序列化后的 TTML 字符串
	*/
	static generate(result, options) {
		return new TTMLGenerator(options).generate(result);
	}
	/**
	* 生成 TTML 字符串
	* @param result 包含元数据和歌词行的 TTML 数据结构
	* @returns 序列化后的 TTML 字符串
	*/
	generate(result) {
		this.doc = this.domImpl.createDocument(NS.TT, Elements.TT, null);
		this.timingMode = result.metadata.timingMode || "Line";
		const allLinesHaveId = result.lines.every((line) => typeof line.id === "string" && line.id.trim() !== "");
		result.lines.forEach((line, index) => {
			if (!allLinesHaveId) line.id = `L${index + 1}`;
			if (!line.agentId) line.agentId = Values.AgentDefault;
		});
		const root = this.doc.documentElement;
		this.setupRootAttributes(root, result);
		const head = this.buildHead(result);
		root.appendChild(head);
		const body = this.buildBody(result);
		root.appendChild(body);
		return this.xmlSerializer.serializeToString(this.doc);
	}
	setupRootAttributes(root, result) {
		root.setAttributeNS(NS.XMLNS, QualifiedAttributes.XmlnsAmll, NS.AMLL);
		root.setAttributeNS(NS.XMLNS, QualifiedAttributes.XmlnsItunes, NS.ITUNES);
		root.setAttributeNS(NS.XMLNS, QualifiedAttributes.XmlnsTtm, NS.TTM);
		root.setAttributeNS(NS.XMLNS, QualifiedAttributes.XmlnsTts, NS.TTS);
		if (result.metadata.language) root.setAttributeNS(NS.XML, QualifiedAttributes.XmlLang, result.metadata.language);
		if (result.metadata.timingMode) root.setAttributeNS(NS.ITUNES, QualifiedAttributes.ITunesTiming, result.metadata.timingMode);
		else root.setAttributeNS(NS.ITUNES, QualifiedAttributes.ITunesTiming, "Word");
	}
	isLyricBase(content) {
		return "startTime" in content;
	}
	isWordByWord(words) {
		if (!words || words.length === 0) return false;
		if (this.timingMode === "Word") return true;
		return true;
	}
	shouldMoveToSidecar(content) {
		if (content.words && content.words.length > 0) return true;
		return !!this.options.useSidecar;
	}
	buildHead(result) {
		const head = this.doc.createElement(Elements.Head);
		const metadata = this.doc.createElement(Elements.TTMLMetadata);
		const meta = result.metadata;
		let agentsToGenerate = [];
		if (meta.agents && Object.keys(meta.agents).length > 0) agentsToGenerate = Object.values(meta.agents);
		else {
			const uniqueAgentIds = /* @__PURE__ */ new Set();
			result.lines.forEach((line) => {
				if (line.agentId) uniqueAgentIds.add(line.agentId);
			});
			uniqueAgentIds.forEach((id) => {
				agentsToGenerate.push({
					id,
					type: id === Values.AgentGroup ? Values.Group : Values.Person
				});
			});
		}
		agentsToGenerate.forEach((agent) => {
			const { id, name, type: agentType } = agent;
			const agentEl = this.doc.createElementNS(NS.TTM, QualifiedAttributes.TTMAgent);
			const type = agentType || (id === Values.AgentGroup ? Values.Group : Values.Person);
			agentEl.setAttribute(Attributes.Type, type);
			agentEl.setAttribute(QualifiedAttributes.XmlId, id);
			if (name) {
				const nameEl = this.doc.createElementNS(NS.TTM, QualifiedAttributes.TTMName);
				nameEl.setAttribute(Attributes.Type, Values.Full);
				nameEl.textContent = name;
				agentEl.appendChild(nameEl);
			}
			metadata.appendChild(agentEl);
		});
		this.buildITunesMetadata(metadata, result);
		const addAmllMeta = (key, value) => {
			const el = this.doc.createElementNS(NS.AMLL, QualifiedAttributes.AmllMeta);
			el.setAttribute(Attributes.Key, key);
			el.setAttribute(Attributes.Value, value);
			metadata.appendChild(el);
		};
		meta.title?.forEach((v) => {
			addAmllMeta(Values.MusicName, v);
		});
		meta.artist?.forEach((v) => {
			addAmllMeta(Values.Artists, v);
		});
		meta.album?.forEach((v) => {
			addAmllMeta(Values.Album, v);
		});
		if (result.metadata.platformIds) Object.entries(result.metadata.platformIds).forEach(([key, values]) => {
			values?.forEach((v) => {
				addAmllMeta(key, v);
			});
		});
		meta.isrc?.forEach((v) => {
			addAmllMeta(Values.ISRC, v);
		});
		meta.authorIds?.forEach((v) => {
			addAmllMeta(Values.TTMLAuthorGithub, v);
		});
		meta.authorNames?.forEach((v) => {
			addAmllMeta(Values.TTMLAuthorGithubLogin, v);
		});
		if (meta.rawProperties) Object.entries(meta.rawProperties).forEach(([key, values]) => {
			values?.forEach((v) => {
				addAmllMeta(key, v);
			});
		});
		head.appendChild(metadata);
		return head;
	}
	buildITunesMetadata(metadataEl, result) {
		const iTunesMeta = this.doc.createElement(Elements.ITunesMetadata);
		iTunesMeta.setAttribute(Attributes.Xmlns, NS.ITUNES_INTERNAL);
		let hasContent = false;
		const translationsMap = /* @__PURE__ */ new Map();
		const romansMap = /* @__PURE__ */ new Map();
		for (const line of result.lines) {
			const pairedTrans = this.pairSubContents(line.translations, line.backgroundVocal?.translations);
			for (const pair of pairedTrans) if (pair.main && this.shouldMoveToSidecar(pair.main) || pair.bg && this.shouldMoveToSidecar(pair.bg)) {
				if (!translationsMap.has(pair.lang)) translationsMap.set(pair.lang, []);
				translationsMap.get(pair.lang)?.push({
					id: line.id,
					main: pair.main,
					bg: pair.bg
				});
			}
			const pairedRomans = this.pairSubContents(line.romanizations, line.backgroundVocal?.romanizations);
			for (const pair of pairedRomans) if (pair.main && this.shouldMoveToSidecar(pair.main) || pair.bg && this.shouldMoveToSidecar(pair.bg)) {
				if (!romansMap.has(pair.lang)) romansMap.set(pair.lang, []);
				romansMap.get(pair.lang)?.push({
					id: line.id,
					main: pair.main,
					bg: pair.bg
				});
			}
		}
		if (translationsMap.size > 0) {
			const container = this.doc.createElement(Elements.Translations);
			for (const [lang, items] of translationsMap) {
				const transEl = this.doc.createElement(Elements.Translation);
				if (lang) transEl.setAttribute(QualifiedAttributes.XmlLang, lang);
				items.forEach((item) => {
					const textEl = this.doc.createElement(Elements.Text);
					textEl.setAttribute(Attributes.For, item.id);
					if (item.main) this.appendContentToElement(textEl, item.main);
					if (item.bg) this.appendBackgroundVocal(textEl, item.bg);
					transEl.appendChild(textEl);
				});
				container.appendChild(transEl);
			}
			iTunesMeta.appendChild(container);
			hasContent = true;
		}
		if (romansMap.size > 0) {
			const container = this.doc.createElement(Elements.Transliterations);
			for (const [lang, items] of romansMap) {
				const transEl = this.doc.createElement(Elements.Transliteration);
				if (lang) transEl.setAttribute(QualifiedAttributes.XmlLang, lang);
				items.forEach((item) => {
					const textEl = this.doc.createElement(Elements.Text);
					textEl.setAttribute(Attributes.For, item.id);
					if (item.main) this.appendContentToElement(textEl, item.main);
					if (item.bg) this.appendBackgroundVocal(textEl, item.bg);
					transEl.appendChild(textEl);
				});
				container.appendChild(transEl);
			}
			iTunesMeta.appendChild(container);
			hasContent = true;
		}
		if (result.metadata.songwriters && result.metadata.songwriters.length > 0) {
			const container = this.doc.createElement(Elements.Songwriters);
			result.metadata.songwriters.forEach((name) => {
				const sw = this.doc.createElement(Elements.Songwriter);
				sw.textContent = name;
				container.appendChild(sw);
			});
			iTunesMeta.appendChild(container);
			hasContent = true;
		}
		if (hasContent) metadataEl.appendChild(iTunesMeta);
	}
	buildBody(result) {
		const body = this.doc.createElement(Elements.Body);
		const lines = result.lines;
		const lastTime = lines.length > 0 ? Math.max(...lines.map((l) => l.endTime)) : 0;
		body.setAttribute(Attributes.Dur, this.formatTime(lastTime));
		let currentDiv = null;
		let currentSongPart;
		let currentBlockIndex;
		let currentSectionEndTime = 0;
		const finalizeCurrentDiv = () => {
			if (currentDiv && currentSectionEndTime > 0) {
				currentDiv.setAttribute(Attributes.End, this.formatTime(currentSectionEndTime));
				if (currentSongPart) currentDiv.setAttributeNS(NS.ITUNES, QualifiedAttributes.ITunesPart, currentSongPart);
			}
		};
		for (const line of lines) {
			if (line.songPart !== currentSongPart || line.blockIndex !== currentBlockIndex || !currentDiv) {
				finalizeCurrentDiv();
				currentSongPart = line.songPart;
				currentBlockIndex = line.blockIndex;
				currentSectionEndTime = 0;
				currentDiv = this.doc.createElement(Elements.Div);
				currentDiv.setAttribute(Attributes.Begin, this.formatTime(line.startTime));
				body.appendChild(currentDiv);
			}
			if (line.endTime > currentSectionEndTime) currentSectionEndTime = line.endTime;
			const p = this.doc.createElement(Elements.P);
			p.setAttribute(Attributes.Begin, this.formatTime(line.startTime));
			p.setAttribute(Attributes.End, this.formatTime(line.endTime));
			p.setAttributeNS(NS.ITUNES, QualifiedAttributes.ITunesKey, line.id);
			if (line.agentId) p.setAttributeNS(NS.TTM, QualifiedAttributes.TTMAgent, line.agentId);
			this.appendContentToElement(p, line);
			currentDiv.appendChild(p);
		}
		finalizeCurrentDiv();
		return body;
	}
	pairSubContents(mainList, bgList) {
		const map = /* @__PURE__ */ new Map();
		const getEntry = (lang) => {
			let entry = map.get(lang);
			if (!entry) {
				entry = { lang };
				map.set(lang, entry);
			}
			return entry;
		};
		mainList?.forEach((item) => {
			getEntry(item.language).main = item;
		});
		bgList?.forEach((item) => {
			getEntry(item.language).bg = item;
		});
		return Array.from(map.values());
	}
	appendContentToElement(element, content, isBackground = false) {
		if (this.isWordByWord(content.words) && content.words) this.appendWords(element, content.words, isBackground);
		else {
			let text = content.text || "";
			if (isBackground) text = `(${text})`;
			element.textContent = text;
		}
		if (this.isLyricBase(content)) this.appendSubLyrics(element, content);
		if ("backgroundVocal" in content && content.backgroundVocal) this.appendBackgroundVocal(element, content.backgroundVocal);
	}
	appendWords(element, words, isBackground) {
		words.forEach((syllable, index) => {
			let text = syllable.text;
			if (isBackground) {
				if (index === 0) text = `(${text}`;
				if (index === words.length - 1) text = `${text})`;
			}
			if (syllable.ruby && syllable.ruby.length > 0) this.appendRubySyllable(element, syllable, text);
			else this.appendNormalSyllable(element, syllable, text);
			if (syllable.endsWithSpace) {
				const spaceNode = this.doc.createTextNode(" ");
				element.appendChild(spaceNode);
			}
		});
	}
	appendRubySyllable(element, syllable, text) {
		const containerSpan = this.doc.createElement(Elements.Span);
		containerSpan.setAttributeNS(NS.TTS, QualifiedAttributes.TtsRuby, Values.RubyContainer);
		if (syllable.obscene) containerSpan.setAttributeNS(NS.AMLL, QualifiedAttributes.AmllObscene, Values.True);
		if (syllable.emptyBeat !== void 0) containerSpan.setAttributeNS(NS.AMLL, QualifiedAttributes.AmllEmptyBeat, syllable.emptyBeat.toString());
		const baseSpan = this.doc.createElement(Elements.Span);
		baseSpan.setAttributeNS(NS.TTS, QualifiedAttributes.TtsRuby, Values.RubyBase);
		baseSpan.textContent = text;
		containerSpan.appendChild(baseSpan);
		const textContainerSpan = this.doc.createElement(Elements.Span);
		textContainerSpan.setAttributeNS(NS.TTS, QualifiedAttributes.TtsRuby, Values.RubyTextContainer);
		syllable.ruby?.forEach((rt) => {
			const rtSpan = this.doc.createElement(Elements.Span);
			rtSpan.setAttributeNS(NS.TTS, QualifiedAttributes.TtsRuby, Values.RubyText);
			rtSpan.setAttribute(Attributes.Begin, this.formatTime(rt.startTime));
			rtSpan.setAttribute(Attributes.End, this.formatTime(rt.endTime));
			rtSpan.textContent = rt.text;
			textContainerSpan.appendChild(rtSpan);
		});
		containerSpan.appendChild(textContainerSpan);
		element.appendChild(containerSpan);
	}
	appendNormalSyllable(element, syllable, text) {
		const span = this.doc.createElement(Elements.Span);
		span.setAttribute(Attributes.Begin, this.formatTime(syllable.startTime));
		span.setAttribute(Attributes.End, this.formatTime(syllable.endTime));
		if (syllable.obscene) span.setAttributeNS(NS.AMLL, QualifiedAttributes.AmllObscene, Values.True);
		if (syllable.emptyBeat !== void 0) span.setAttributeNS(NS.AMLL, QualifiedAttributes.AmllEmptyBeat, syllable.emptyBeat.toString());
		span.textContent = text;
		element.appendChild(span);
	}
	appendSubLyrics(element, content) {
		if (content.translations) content.translations.forEach((trans) => {
			if (!this.shouldMoveToSidecar(trans)) {
				const span = this.doc.createElement(Elements.Span);
				span.setAttributeNS(NS.TTM, QualifiedAttributes.TTMRole, Values.RoleTranslation);
				if (trans.language) span.setAttributeNS(NS.XML, QualifiedAttributes.XmlLang, trans.language);
				this.appendContentToElement(span, trans);
				element.appendChild(span);
			}
		});
		if (content.romanizations) content.romanizations.forEach((roman) => {
			if (!this.shouldMoveToSidecar(roman)) {
				const span = this.doc.createElement(Elements.Span);
				span.setAttributeNS(NS.TTM, QualifiedAttributes.TTMRole, Values.RoleRoman);
				if (roman.language) span.setAttributeNS(NS.XML, QualifiedAttributes.XmlLang, roman.language);
				this.appendContentToElement(span, roman);
				element.appendChild(span);
			}
		});
	}
	appendBackgroundVocal(element, bg) {
		const bgSpan = this.doc.createElement(Elements.Span);
		bgSpan.setAttributeNS(NS.TTM, QualifiedAttributes.TTMRole, Values.RoleBg);
		if (this.isLyricBase(bg)) {
			if (bg.startTime > 0 && bg.endTime > 0) {
				bgSpan.setAttribute(Attributes.Begin, this.formatTime(bg.startTime));
				bgSpan.setAttribute(Attributes.End, this.formatTime(bg.endTime));
			}
		}
		this.appendContentToElement(bgSpan, bg, true);
		element.appendChild(bgSpan);
	}
	formatTime(ms) {
		if (ms < 0) ms = 0;
		const totalSeconds = Math.floor(ms / 1e3);
		const milliseconds = ms % 1e3;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const fff = milliseconds.toString().padStart(3, "0");
		if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}.${fff}`;
		else return `${seconds}.${fff}`;
	}
};
//#endregion
//#region src/parser.ts
/** biome-ignore-all lint/suspicious/noAssignInExpressions: intentional */
/**
* 核心的 TTML 生成器实现
* @module generator
*/
/**
* TTML 歌词生成器类
*
* 用于将 AMLL 项目使用的 TTML 字符串解析为结构化的 {@link TTMLResult} 数据结构
* @see https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83
*/
var TTMLParser = class TTMLParser {
	domParser;
	static TIME_REGEX = /^(?:(?:(?<hours>\d+):)?(?<minutes>\d+):)?(?<seconds>\d+(?:\.\d+)?)$/;
	static LEADING_SPACE_REGEX = /^\s/;
	static TRAILING_SPACE_REGEX = /\s$/;
	static MULTI_SPACE_REGEX = /\s+/g;
	normalizeText(text, trim = true) {
		if (!text) return "";
		const normalized = text.replace(TTMLParser.MULTI_SPACE_REGEX, " ");
		return trim ? normalized.trim() : normalized;
	}
	/**
	* 构造一个 TTML 解析器实例
	*
	* @param options 生成器配置选项
	*
	* 在 Node.js 环境下必须注入 `domParser` 实例（例如用 `@xmldom/xmldom` 等）
	*/
	constructor(options) {
		if (options?.domParser) this.domParser = options.domParser;
		else if (typeof DOMParser !== "undefined") this.domParser = new DOMParser();
		else throw new Error("No DOMParser found. If you are running in Node.js, please inject a DOMParser (e.g., @xmldom/xmldom).");
	}
	/**
	* 解析 TTML 字符串的静态便捷方法
	* @param xmlStr 需要解析的 TTML XML 字符串
	* @param options 解析器配置选项，用于注入 DOM 依赖
	* @returns 解析后的结构化 TTML 数据结构
	* @throws 当输入的 XML 字符串格式无效时抛出异常
	*/
	static parse(xmlStr, options) {
		return new TTMLParser(options).parse(xmlStr);
	}
	/**
	* 解析 TTML 字符串
	* @param xmlStr 需要解析的 TTML XML 字符串
	* @returns 解析后的结构化 TTML 数据结构
	* @throws 当输入的 XML 字符串格式无效时抛出异常
	*/
	parse(xmlStr) {
		if (!xmlStr || typeof xmlStr !== "string") throw new Error("TTMLParser: Input must be a valid XML string.");
		const doc = this.domParser.parseFromString(xmlStr, Values.MimeXML);
		const { metadata, sidecar } = this.parseHead(doc);
		const parserError = doc.getElementsByTagName(Elements.ParserError)[0];
		if (parserError) throw new Error(`TTMLParser: XML parsing error: ${parserError.textContent}`);
		const result = {
			metadata,
			lines: []
		};
		const root = doc.documentElement;
		if (root) {
			const lang = this.getAttr(root, NS.XML, Attributes.Lang);
			if (lang) result.metadata.language = lang;
			const timing = this.getAttr(root, NS.ITUNES, Attributes.Timing);
			if (timing && timing === Values.Word || timing === Values.Line) result.metadata.timingMode = timing;
		}
		this.parseBody(doc, result, sidecar);
		result.metadata.timingMode ??= this.inferTimingMode(result.lines);
		if (result.metadata.platformIds) result.metadata.platformIds = this.sortPlatformIds(result.metadata.platformIds);
		return result;
	}
	inferTimingMode(lines) {
		return lines.some((line) => (line.words?.length ?? 0) > 1 || (line.backgroundVocal?.words?.length ?? 0) > 1) ? "Word" : "Line";
	}
	sortPlatformIds(platformIds) {
		const preferredOrder = [
			"ncmMusicId",
			"qqMusicId",
			"spotifyId",
			"appleMusicId"
		];
		const orderedPlatformIds = {};
		for (const key of preferredOrder) if (platformIds[key]) orderedPlatformIds[key] = platformIds[key];
		for (const key of Object.keys(platformIds)) if (!orderedPlatformIds[key]) orderedPlatformIds[key] = platformIds[key];
		return orderedPlatformIds;
	}
	parseHead(doc) {
		const head = doc.getElementsByTagName(Elements.Head)[0];
		const resultMeta = {
			title: [],
			artist: [],
			album: [],
			isrc: [],
			authorIds: [],
			authorNames: [],
			songwriters: [],
			agents: {},
			rawProperties: {}
		};
		const sidecar = {};
		if (!head) return {
			metadata: resultMeta,
			sidecar
		};
		this.parseTTMElements(head, resultMeta);
		this.parseAMLLMeta(head, resultMeta);
		this.parseiTunesExtensions(head, resultMeta, sidecar);
		this.deduplicateMetadata(resultMeta);
		return {
			metadata: resultMeta,
			sidecar
		};
	}
	deduplicateMetadata(meta) {
		const dedupe = (arr) => arr ? Array.from(new Set(arr)) : [];
		meta.title = dedupe(meta.title);
		meta.artist = dedupe(meta.artist);
		meta.album = dedupe(meta.album);
		meta.isrc = dedupe(meta.isrc);
		meta.authorIds = dedupe(meta.authorIds);
		meta.authorNames = dedupe(meta.authorNames);
		meta.songwriters = dedupe(meta.songwriters);
		if (meta.platformIds) {
			for (const key of Object.keys(meta.platformIds)) if (meta.platformIds[key]) meta.platformIds[key] = dedupe(meta.platformIds[key]);
		}
		if (meta.rawProperties) {
			for (const key of Object.keys(meta.rawProperties)) if (meta.rawProperties[key]) meta.rawProperties[key] = dedupe(meta.rawProperties[key]);
		}
	}
	parseTTMElements(head, meta) {
		const titles = head.getElementsByTagNameNS(NS.TTM, Elements.Title);
		if (titles.length > 0 && titles[0].textContent) meta.title?.push(titles[0].textContent.trim());
		const agents = Array.from(head.getElementsByTagNameNS(NS.TTM, Elements.Agent));
		for (const agent of agents) {
			const id = this.getAttr(agent, NS.XML, Attributes.Id);
			if (!id) continue;
			const type = this.getAttr(agent, NS.TTM, Attributes.Type, Attributes.Type);
			const names = agent.getElementsByTagNameNS(NS.TTM, Elements.Name);
			const agentObj = { id };
			if (type) agentObj.type = type;
			if (names.length > 0 && names[0].textContent) {
				const rawName = names[0].textContent.trim();
				if (rawName.length > 0) agentObj.name = rawName;
			}
			meta.agents ??= {};
			meta.agents[id] = agentObj;
		}
	}
	parseAMLLMeta(head, meta) {
		const validMetas = Array.from(head.getElementsByTagNameNS(NS.AMLL, Elements.Meta)).filter((el) => {
			return this.getAttr(el, NS.AMLL, Attributes.Key) && this.getAttr(el, NS.AMLL, Attributes.Value);
		});
		for (const el of validMetas) {
			const key = this.getAttr(el, NS.AMLL, Attributes.Key);
			const value = this.getAttr(el, NS.AMLL, Attributes.Value)?.trim();
			if (!key || !value) continue;
			switch (key) {
				case Values.MusicName:
					meta.title?.push(value);
					break;
				case Values.Artists:
					meta.artist?.push(value);
					break;
				case Values.Album:
					meta.album?.push(value);
					break;
				case Values.ISRC:
					meta.isrc?.push(value);
					break;
				case Values.TTMLAuthorGithub:
					meta.authorIds?.push(value);
					break;
				case Values.TTMLAuthorGithubLogin:
					meta.authorNames?.push(value);
					break;
				case Values.NCMMusicId:
				case Values.QQMusicId:
				case Values.SpotifyId:
				case Values.AppleMusicId:
					meta.platformIds ??= {};
					(meta.platformIds[key] ??= []).push(value);
					break;
				default:
					meta.rawProperties ??= {};
					(meta.rawProperties[key] ??= []).push(value);
					break;
			}
		}
	}
	extractSubContent(base, lang, ignoreWords = false) {
		const result = {};
		const mainText = this.normalizeText(base.text);
		const hasMainWords = !ignoreWords && base.words && base.words.length > 0;
		if (mainText || hasMainWords) {
			const main = { text: mainText };
			if (lang) main.language = lang;
			if (hasMainWords) {
				if (!(base.words?.length === 1 && base.words?.[0].startTime === 0 && base.words?.[0].endTime === 0)) main.words = base.words;
			}
			result.main = main;
		}
		if ("backgroundVocal" in base && base.backgroundVocal) {
			const bgVocal = base.backgroundVocal;
			const bgText = this.normalizeText(bgVocal.text);
			const hasBgWords = !ignoreWords && bgVocal.words && bgVocal.words.length > 0;
			if (bgText || hasBgWords) {
				const bg = { text: bgText };
				if (lang) bg.language = lang;
				if (hasBgWords) {
					if (!(bgVocal.words?.length === 1 && bgVocal.words?.[0].startTime === 0 && bgVocal.words?.[0].endTime === 0)) bg.words = bgVocal.words;
				}
				result.bg = bg;
			}
		}
		return result;
	}
	parseiTunesExtensions(head, meta, sidecar) {
		const iTunesMetas = Array.from(head.getElementsByTagName(Elements.ITunesMetadata));
		if (iTunesMetas.length === 0) return;
		for (const iTunesMeta of iTunesMetas) {
			const songwritersContainer = iTunesMeta.getElementsByTagName(Elements.Songwriters)[0];
			if (songwritersContainer) {
				const writers = Array.from(songwritersContainer.getElementsByTagName(Elements.Songwriter));
				for (const writer of writers) {
					const name = writer.textContent?.trim();
					if (name) meta.songwriters?.push(name);
				}
			}
			const processEntries = (containerTagName, itemTagName, type) => {
				const container = iTunesMeta.getElementsByTagName(containerTagName)[0];
				if (!container) return;
				const items = Array.from(container.getElementsByTagName(itemTagName));
				for (const item of items) {
					const lang = this.getAttr(item, NS.XML, Attributes.Lang);
					const textNodes = Array.from(item.getElementsByTagName(Elements.Text));
					for (const textNode of textNodes) {
						const forId = textNode.getAttribute(Attributes.For);
						const parsedContent = this.parseCommonContent(textNode);
						if (forId) {
							const subContents = this.extractSubContent(parsedContent, lang, false);
							sidecar[forId] ??= {};
							if (subContents.main) (sidecar[forId][type] ??= []).push(subContents.main);
							if (subContents.bg) {
								const bgType = type === "translations" ? "bgTranslations" : "bgRomanizations";
								(sidecar[forId][bgType] ??= []).push(subContents.bg);
							}
						}
					}
				}
			};
			processEntries(Elements.Translations, Elements.Translation, "translations");
			processEntries(Elements.Transliterations, Elements.Transliteration, "romanizations");
		}
	}
	parseTime(timeStr) {
		if (!timeStr) return 0;
		const cleanStr = timeStr.trim();
		if (cleanStr.length === 0) return 0;
		if (cleanStr.endsWith("s")) {
			const seconds = Number(cleanStr.slice(0, -1));
			if (Number.isNaN(seconds)) return 0;
			return Math.round(seconds * 1e3);
		}
		const match = cleanStr.match(TTMLParser.TIME_REGEX);
		if (match?.groups) {
			const { seconds, minutes, hours } = match.groups;
			const secNum = Number(seconds);
			const minNum = minutes ? parseInt(minutes, 10) : 0;
			const hrNum = hours ? parseInt(hours, 10) : 0;
			if (!Number.isNaN(secNum) && !Number.isNaN(minNum) && !Number.isNaN(hrNum)) {
				const totalSeconds = hrNum * 3600 + minNum * 60 + secNum;
				return Math.round(totalSeconds * 1e3);
			}
		}
		return 0;
	}
	parseBody(doc, result, sidecar) {
		const body = doc.getElementsByTagName(Elements.Body)[0];
		if (!body) return;
		const childNodes = Array.from(body.childNodes);
		let currentBlockIndex = 0;
		for (const node of childNodes) {
			if (node.nodeType !== 1) continue;
			const el = node;
			const tagName = el.localName || el.tagName.toLowerCase().split(":").pop();
			if (tagName === Elements.Div) {
				currentBlockIndex++;
				const songPart = this.getAttr(el, NS.ITUNES, Attributes.SongPartKebab) || this.getAttr(el, NS.ITUNES, Attributes.SongPart);
				const pNodes = el.getElementsByTagNameNS(NS.TT, Elements.P);
				const pList = pNodes.length > 0 ? Array.from(pNodes) : Array.from(el.getElementsByTagName(Elements.P));
				for (const p of pList) this.processLineElement(p, result.lines, sidecar, songPart, currentBlockIndex);
			} else if (tagName === Elements.P) {
				currentBlockIndex++;
				this.processLineElement(el, result.lines, sidecar, void 0, currentBlockIndex);
			}
		}
	}
	processLineElement(p, lines, sidecar, songPart, blockIndex) {
		const id = this.getAttr(p, NS.ITUNES, Attributes.Key);
		if (!id) return;
		const line = {
			id,
			...this.parseCommonContent(p)
		};
		if (songPart) line.songPart = songPart;
		if (blockIndex !== void 0) line.blockIndex = blockIndex;
		const agentId = this.getAttr(p, NS.TTM, Elements.Agent);
		if (agentId) line.agentId = agentId;
		const externalData = sidecar[id];
		if (externalData) {
			if (externalData.translations) (line.translations ??= []).push(...externalData.translations);
			if (externalData.romanizations) (line.romanizations ??= []).push(...externalData.romanizations);
			if (externalData.bgTranslations && line.backgroundVocal) (line.backgroundVocal.translations ??= []).push(...externalData.bgTranslations);
			if (externalData.bgRomanizations && line.backgroundVocal) (line.backgroundVocal.romanizations ??= []).push(...externalData.bgRomanizations);
		}
		lines.push(line);
	}
	parseCommonContent(element) {
		const beginAttr = this.getAttr(element, NS.XML, Attributes.Begin, Attributes.Begin);
		const endAttr = this.getAttr(element, NS.XML, Attributes.End, Attributes.End);
		const originalStartTime = this.parseTime(beginAttr);
		const originalEndTime = this.parseTime(endAttr);
		const state = this.extractNodeState(element);
		if (state.backgroundVocal) {
			if (state.bgTranslations.length > 0) (state.backgroundVocal.translations ??= []).push(...state.bgTranslations);
			if (state.bgRomanizations.length > 0) (state.backgroundVocal.romanizations ??= []).push(...state.bgRomanizations);
		}
		this.finalizeWords(state.words);
		const { startTime, endTime } = this.calculateTimeRange(originalStartTime, originalEndTime, state.words, state.backgroundVocal);
		const cleanFullText = this.normalizeText(state.fullText);
		const hasTimeAttrs = beginAttr !== null || endAttr !== null;
		this.applyFallbackWord(state.words, cleanFullText, hasTimeAttrs, originalStartTime, originalEndTime, startTime, endTime);
		return this.buildLyricBase(state, cleanFullText, startTime, endTime);
	}
	extractNodeState(element) {
		const state = {
			fullText: "",
			words: [],
			translations: [],
			romanizations: [],
			bgTranslations: [],
			bgRomanizations: [],
			backgroundVocal: void 0
		};
		const childNodes = Array.from(element.childNodes);
		for (const node of childNodes) if (node.nodeType === 3) this.processTextNode(state, node);
		else if (node.nodeType === 1) this.processElementNode(state, node);
		return state;
	}
	calculateTimeRange(originalStart, originalEnd, words, bgVocal) {
		let startTime = originalStart;
		let endTime = originalEnd;
		const timedElements = [...words];
		if (bgVocal) timedElements.push(bgVocal);
		if (timedElements.length > 0) {
			let minChildStart = Infinity;
			let maxChildEnd = 0;
			for (const el of timedElements) {
				if (el.startTime < minChildStart) minChildStart = el.startTime;
				if (el.endTime > maxChildEnd) maxChildEnd = el.endTime;
			}
			if (startTime === 0 || minChildStart > 0 && minChildStart < startTime) startTime = minChildStart === Infinity ? 0 : minChildStart;
			if (endTime === 0 || maxChildEnd > endTime) endTime = maxChildEnd;
		}
		return {
			startTime,
			endTime
		};
	}
	applyFallbackWord(words, cleanText, hasTimeAttrs, origStart, origEnd, calcStart, calcEnd) {
		if (words.length === 0 && cleanText.length > 0 && hasTimeAttrs) words.push({
			text: cleanText,
			startTime: origStart > 0 ? origStart : calcStart,
			endTime: origEnd > 0 ? origEnd : calcEnd,
			endsWithSpace: false
		});
	}
	buildLyricBase(state, cleanText, startTime, endTime) {
		return {
			text: cleanText,
			startTime,
			endTime,
			words: state.words.length > 0 ? state.words : void 0,
			translations: state.translations.length > 0 ? state.translations : void 0,
			romanizations: state.romanizations.length > 0 ? state.romanizations : void 0,
			backgroundVocal: state.backgroundVocal
		};
	}
	processTextNode(state, node) {
		const rawText = node.textContent || "";
		const isFormatting = rawText.includes("\n");
		if (isFormatting && rawText.trim().length === 0) return;
		const normalizedText = this.normalizeText(rawText, false);
		state.fullText += normalizedText;
		if (!isFormatting && normalizedText.length > 0 && normalizedText.trim().length === 0) {
			if (state.words.length > 0) state.words[state.words.length - 1].endsWithSpace = true;
		}
	}
	processElementNode(state, el) {
		const role = this.getAttr(el, NS.TTM, Attributes.Role);
		if (this.getAttr(el, NS.TTS, Attributes.Ruby, QualifiedAttributes.TtsRuby) === Values.RubyContainer) {
			this.processRubyElement(state, el);
			return;
		}
		switch (role) {
			case Values.RoleBg:
				state.backgroundVocal = this.parseBackgroundVocal(el);
				break;
			case Values.RoleTranslation: {
				const translation = this.parseInlineSubContent(el);
				if (translation) {
					if (translation.main) state.translations.push(translation.main);
					if (translation.bg) state.bgTranslations.push(translation.bg);
				}
				break;
			}
			case Values.RoleRoman: {
				const romanization = this.parseInlineSubContent(el);
				if (romanization) {
					if (romanization.main) state.romanizations.push(romanization.main);
					if (romanization.bg) state.bgRomanizations.push(romanization.bg);
				}
				break;
			}
			default:
				this.processWordElement(state, el);
				break;
		}
	}
	processRubyElement(state, containerEl) {
		const isObscene = this.getAttr(containerEl, NS.AMLL, Attributes.Obscene, QualifiedAttributes.AmllObscene) === "true";
		const emptyBeatAttr = this.getAttr(containerEl, NS.AMLL, Attributes.EmptyBeat, QualifiedAttributes.AmllEmptyBeat);
		let emptyBeat;
		if (emptyBeatAttr) {
			const parsedBeat = parseInt(emptyBeatAttr, 10);
			if (!Number.isNaN(parsedBeat)) emptyBeat = parsedBeat;
		}
		let baseText = "";
		const rubyTags = [];
		const childNodes = Array.from(containerEl.childNodes);
		for (const node of childNodes) {
			if (node.nodeType !== 1) continue;
			const childEl = node;
			const childRubyAttr = this.getAttr(childEl, NS.TTS, Attributes.Ruby, QualifiedAttributes.TtsRuby);
			if (childRubyAttr === Values.RubyBase) baseText = this.normalizeText(childEl.textContent, false);
			else if (childRubyAttr === Values.RubyTextContainer) {
				const textNodes = Array.from(childEl.childNodes);
				for (const textNode of textNodes) {
					if (textNode.nodeType !== 1) continue;
					const tNode = textNode;
					if (this.getAttr(tNode, NS.TTS, Attributes.Ruby, QualifiedAttributes.TtsRuby) === Values.RubyText) {
						const begin = this.getAttr(tNode, NS.XML, Attributes.Begin, Attributes.Begin);
						const end = this.getAttr(tNode, NS.XML, Attributes.End, Attributes.End);
						const text = this.normalizeText(tNode.textContent, false).trim();
						if (text && begin && end) rubyTags.push({
							text,
							startTime: this.parseTime(begin),
							endTime: this.parseTime(end)
						});
					}
				}
			}
		}
		if (!baseText) return;
		state.fullText += baseText;
		let startTime = 0;
		let endTime = 0;
		if (rubyTags.length > 0) {
			startTime = Math.min(...rubyTags.map((t) => t.startTime));
			endTime = Math.max(...rubyTags.map((t) => t.endTime));
		}
		const cleanBaseText = baseText.trim();
		if (cleanBaseText.length > 0) {
			const endsWithSpace = TTMLParser.TRAILING_SPACE_REGEX.test(baseText);
			if (TTMLParser.LEADING_SPACE_REGEX.test(baseText) && state.words.length > 0) state.words[state.words.length - 1].endsWithSpace = true;
			state.words.push({
				text: cleanBaseText,
				startTime,
				endTime,
				ruby: rubyTags.length > 0 ? rubyTags : void 0,
				endsWithSpace,
				obscene: isObscene ? true : void 0,
				emptyBeat
			});
		}
	}
	processWordElement(state, el) {
		const wBegin = this.getAttr(el, NS.XML, Attributes.Begin, Attributes.Begin);
		const wEnd = this.getAttr(el, NS.XML, Attributes.End, Attributes.End);
		const isObscene = this.getAttr(el, NS.AMLL, Attributes.Obscene, QualifiedAttributes.AmllObscene) === "true";
		const emptyBeatAttr = this.getAttr(el, NS.AMLL, Attributes.EmptyBeat, QualifiedAttributes.AmllEmptyBeat);
		let emptyBeat;
		if (emptyBeatAttr) {
			const parsedBeat = parseInt(emptyBeatAttr, 10);
			if (!Number.isNaN(parsedBeat)) emptyBeat = parsedBeat;
		}
		const rawWText = el.textContent || "";
		const normalizedWText = this.normalizeText(rawWText, false);
		state.fullText += normalizedWText;
		if (wBegin && wEnd) {
			const isFormatting = rawWText.includes("\n");
			let startsWithSpace = false;
			let endsWithSpace = false;
			if (!isFormatting) {
				startsWithSpace = TTMLParser.LEADING_SPACE_REGEX.test(normalizedWText);
				endsWithSpace = TTMLParser.TRAILING_SPACE_REGEX.test(normalizedWText);
			}
			const cleanText = normalizedWText.trim();
			if (startsWithSpace && state.words.length > 0) state.words[state.words.length - 1].endsWithSpace = true;
			if (cleanText.length > 0) state.words.push({
				text: cleanText,
				startTime: this.parseTime(wBegin),
				endTime: this.parseTime(wEnd),
				endsWithSpace,
				obscene: isObscene ? true : void 0,
				emptyBeat
			});
		}
	}
	parseBackgroundVocal(el) {
		const { backgroundVocal, ...bgVocal } = this.parseCommonContent(el);
		bgVocal.text = bgVocal.text.replace(/^[(（]+/, "").replace(/[)）]+$/, "");
		if (bgVocal.words && bgVocal.words.length > 0) {
			bgVocal.words[0].text = bgVocal.words[0].text.replace(/^[(（]+/, "").trimStart();
			const lastIdx = bgVocal.words.length - 1;
			bgVocal.words[lastIdx].text = bgVocal.words[lastIdx].text.replace(/[)）]+$/, "").trimEnd();
		}
		return bgVocal;
	}
	parseInlineSubContent(el) {
		const lang = this.getAttr(el, NS.XML, Attributes.Lang);
		const parsed = this.parseCommonContent(el);
		const content = this.extractSubContent(parsed, lang, true);
		if (content.main || content.bg) return content;
		return null;
	}
	finalizeWords(words) {
		if (words.length === 0) return [];
		words[0].text = words[0].text.trimStart();
		const lastIdx = words.length - 1;
		words[lastIdx].text = words[lastIdx].text.trimEnd();
		words[lastIdx].endsWithSpace = false;
		return words;
	}
	getAttr(element, ns, localName, fallbackAttrName) {
		const val = element.getAttributeNS(ns, localName);
		if (val) return val;
		if (fallbackAttrName) {
			const fallbackVal = element.getAttribute(fallbackAttrName);
			if (fallbackVal) return fallbackVal;
		}
		if (element.hasAttributes()) {
			const attributes = Array.from(element.attributes);
			for (const attr of attributes) if ((attr.localName || attr.nodeName.split(":").pop()) === localName) return attr.value;
		}
		return null;
	}
};
//#endregion
//#region src/utils/amll-converter.ts
/**
* 包含解析器内部的复杂数据结构和 AMLL 简单的数据结构的互转功能的模块
* @module amll-converter
*/
/**
* 将本解析器复杂的数据结构降级为 AMLL 所使用的较简单的数据结构
*/
function toAmllLyrics(result, options) {
	const amllLines = [];
	const convertToAmllLine = (source, isBG, isDuet) => {
		let amllWords = [];
		if (source.words && source.words.length > 0) amllWords = source.words.map((w) => {
			const amllWord = {
				startTime: w.startTime,
				endTime: w.endTime,
				word: w.text + (w.endsWithSpace ? " " : ""),
				romanWord: "",
				obscene: w.obscene,
				emptyBeat: w.emptyBeat
			};
			if (w.ruby && w.ruby.length > 0) amllWord.ruby = w.ruby.map((r) => ({
				startTime: r.startTime,
				endTime: r.endTime,
				word: r.text
			}));
			return amllWord;
		});
		else amllWords = [{
			startTime: source.startTime,
			endTime: source.endTime,
			word: source.text,
			romanWord: ""
		}];
		let transText = "";
		if (source.translations && source.translations.length > 0) transText = (options?.translationLanguage && source.translations.find((t) => t.language === options.translationLanguage) || source.translations[0]).text;
		let romanText = "";
		let romanWords;
		if (source.romanizations && source.romanizations.length > 0) {
			const targetRoman = options?.romanizationLanguage && source.romanizations.find((r) => r.language === options.romanizationLanguage) || source.romanizations[0];
			romanWords = targetRoman.words;
			if (!romanWords || romanWords.length === 0) romanText = targetRoman.text;
		}
		if (romanWords && amllWords.length > 0) alignRomanization(amllWords, romanWords);
		return {
			words: amllWords,
			translatedLyric: transText,
			romanLyric: romanText,
			isBG,
			isDuet,
			startTime: source.startTime,
			endTime: source.endTime
		};
	};
	let lastPersonAgentId = null;
	let lastPersonIsDuet = false;
	for (const line of result.lines) {
		const agentId = line.agentId || Values.AgentDefault;
		const agent = result.metadata.agents?.[agentId];
		const isGroup = agent?.type === Values.Group;
		const isOther = agent?.type === Values.Other;
		let currentIsDuet = false;
		if (isGroup) currentIsDuet = false;
		else if (lastPersonAgentId === null) {
			currentIsDuet = !!isOther;
			lastPersonAgentId = agentId;
			lastPersonIsDuet = currentIsDuet;
		} else if (lastPersonAgentId === agentId) currentIsDuet = lastPersonIsDuet;
		else {
			currentIsDuet = !lastPersonIsDuet;
			lastPersonAgentId = agentId;
			lastPersonIsDuet = currentIsDuet;
		}
		const amllMain = convertToAmllLine(line, false, currentIsDuet);
		amllLines.push(amllMain);
		if (line.backgroundVocal) {
			const simpleBg = convertToAmllLine(line.backgroundVocal, true, currentIsDuet);
			amllLines.push(simpleBg);
		}
	}
	const amllMetadata = [];
	const meta = result.metadata;
	if (meta.title) amllMetadata.push([Values.MusicName, meta.title]);
	if (meta.artist) amllMetadata.push([Values.Artists, meta.artist]);
	if (meta.album) amllMetadata.push([Values.Album, meta.album]);
	if (meta.isrc) amllMetadata.push([Values.ISRC, meta.isrc]);
	if (meta.authorIds) amllMetadata.push([Values.TTMLAuthorGithub, meta.authorIds]);
	if (meta.authorNames) amllMetadata.push([Values.TTMLAuthorGithubLogin, meta.authorNames]);
	if (meta.language) amllMetadata.push([Values.Language, [meta.language]]);
	if (meta.timingMode) amllMetadata.push([Values.TimingMode, [meta.timingMode]]);
	if (meta.songwriters) amllMetadata.push([Elements.Songwriters, meta.songwriters]);
	if (meta.platformIds) {
		if (meta.platformIds.ncmMusicId) amllMetadata.push([Values.NCMMusicId, meta.platformIds.ncmMusicId]);
		if (meta.platformIds.qqMusicId) amllMetadata.push([Values.QQMusicId, meta.platformIds.qqMusicId]);
		if (meta.platformIds.spotifyId) amllMetadata.push([Values.SpotifyId, meta.platformIds.spotifyId]);
		if (meta.platformIds.appleMusicId) amllMetadata.push([Values.AppleMusicId, meta.platformIds.appleMusicId]);
	}
	if (meta.rawProperties) for (const [key, value] of Object.entries(meta.rawProperties)) amllMetadata.push([key, value]);
	return {
		lines: amllLines,
		metadata: amllMetadata
	};
}
function alignRomanization(amllWords, romanWords) {
	let romanSearchStartIndex = 0;
	/** 交并比阈值，至少有 10% 的面积重合 */
	const MIN_IOU_THRESHOLD = .1;
	/** 快速通道，优先匹配时间戳完全相同的主歌词和音译音节，同时避免浮点数误差 */
	const FAST_TRACK_TOLERANCE_MS = 2;
	for (let i = 0; i < amllWords.length; i++) {
		const main = amllWords[i];
		const mainEndTime = main.endTime;
		let maxIou = 0;
		let bestMatchIndex = -1;
		let isFastTrackMatched = false;
		let j = romanSearchStartIndex;
		while (j < romanWords.length) {
			const sub = romanWords[j];
			if (Math.abs(main.startTime - sub.startTime) <= FAST_TRACK_TOLERANCE_MS) {
				main.romanWord = sub.text;
				romanSearchStartIndex = j + 1;
				isFastTrackMatched = true;
				break;
			}
			const subEndTime = sub.endTime;
			const overlapStart = Math.max(main.startTime, sub.startTime);
			const intersection = Math.max(0, Math.min(mainEndTime, subEndTime) - overlapStart);
			if (intersection > 0) {
				const unionStart = Math.min(main.startTime, sub.startTime);
				const iou = intersection / Math.max(1, Math.max(mainEndTime, subEndTime) - unionStart);
				if (iou > maxIou) {
					maxIou = iou;
					bestMatchIndex = j;
				}
			}
			if (sub.startTime >= mainEndTime) break;
			j++;
		}
		if (!isFastTrackMatched && bestMatchIndex !== -1 && maxIou >= MIN_IOU_THRESHOLD) {
			main.romanWord = romanWords[bestMatchIndex].text;
			romanSearchStartIndex = bestMatchIndex + 1;
		}
	}
}
/**
* 将 AMLL 格式的歌词和元数据转换为 TTMLResult 结构
*/
function toTTMLResult(amllLines, amllMetadata, options = {}) {
	const opts = {
		translationLanguage: "zh-Hans",
		...options
	};
	const metadata = { agents: {
		[Values.AgentDefault]: { id: Values.AgentDefault },
		[Values.AgentDefaultDuet]: { id: Values.AgentDefaultDuet }
	} };
	for (const entry of amllMetadata) {
		const [key, value] = entry;
		if (!value || value.length === 0) continue;
		switch (key) {
			case Values.MusicName:
				metadata.title = value;
				break;
			case Values.Artists:
				metadata.artist = value;
				break;
			case Values.Album:
				metadata.album = value;
				break;
			case Values.ISRC:
				metadata.isrc = value;
				break;
			case Values.TTMLAuthorGithub:
				metadata.authorIds = value;
				break;
			case Values.TTMLAuthorGithubLogin:
				metadata.authorNames = value;
				break;
			case Values.NCMMusicId:
			case Values.QQMusicId:
			case Values.SpotifyId:
			case Values.AppleMusicId:
				if (!metadata.platformIds) metadata.platformIds = {};
				metadata.platformIds[key] = value;
				break;
			default:
				if (!metadata.rawProperties) metadata.rawProperties = {};
				metadata.rawProperties[key] = value;
				break;
		}
	}
	const resultLines = [];
	let currentMainLine = null;
	for (const amllLine of amllLines) {
		const { mainSyllables, romanSyllables, fullText, romanText } = convertWords(amllLine);
		const lyricBase = {
			startTime: amllLine.startTime,
			endTime: amllLine.endTime,
			text: fullText,
			words: mainSyllables
		};
		if (amllLine.translatedLyric) lyricBase.translations = [{
			language: opts.translationLanguage,
			text: amllLine.translatedLyric
		}];
		if (amllLine.romanLyric || romanSyllables.length > 0) lyricBase.romanizations = [{
			language: opts.romanizationLanguage,
			text: amllLine.romanLyric || romanText,
			words: romanSyllables.length > 0 ? romanSyllables : void 0
		}];
		if (amllLine.isBG) if (currentMainLine && !currentMainLine.backgroundVocal) currentMainLine.backgroundVocal = lyricBase;
		else {
			const promotedLine = {
				agentId: currentMainLine ? currentMainLine.agentId : Values.AgentDefault,
				...lyricBase
			};
			resultLines.push(promotedLine);
		}
		else {
			const lyricLine = {
				agentId: amllLine.isDuet ? Values.AgentDefaultDuet : Values.AgentDefault,
				...lyricBase
			};
			resultLines.push(lyricLine);
			currentMainLine = lyricLine;
		}
	}
	return {
		metadata,
		lines: resultLines
	};
}
function convertWords(amllLine) {
	const mainSyllables = [];
	const romanSyllables = [];
	for (const word of amllLine.words) {
		const rawText = word.word;
		const trimmedText = rawText.trimEnd();
		const hasSpace = rawText !== trimmedText;
		const syllable = {
			text: trimmedText,
			startTime: word.startTime,
			endTime: word.endTime,
			endsWithSpace: hasSpace,
			obscene: word.obscene,
			emptyBeat: word.emptyBeat
		};
		if (word.ruby && word.ruby.length > 0) syllable.ruby = word.ruby.map((r) => ({
			startTime: r.startTime,
			endTime: r.endTime,
			text: r.word
		}));
		mainSyllables.push(syllable);
		if (word.romanWord) romanSyllables.push({
			text: word.romanWord.trim(),
			startTime: word.startTime,
			endTime: word.endTime
		});
	}
	return {
		mainSyllables,
		romanSyllables,
		fullText: amllLine.words.map((w) => w.word).join(""),
		romanText: romanSyllables.length > 0 ? romanSyllables.map((s) => s.text + (s.endsWithSpace ? " " : "")).join("") : ""
	};
}
//#endregion
//#region src/index.ts
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
function parseTTML(ttmlText) {
	return toAmllLyrics(TTMLParser.parse(ttmlText));
}
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
function exportTTML(ttmlLyric) {
	const result = toTTMLResult(ttmlLyric.lines, ttmlLyric.metadata);
	return new TTMLGenerator().generate(result);
}
//#endregion
export { TTMLGenerator, TTMLParser, exportTTML, parseTTML, toAmllLyrics, toTTMLResult };

//# sourceMappingURL=amll-ttml.mjs.map