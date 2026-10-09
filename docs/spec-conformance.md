# AMLL TTML 格式规范符合性审计

- 审计对象：`src/modules/project/logic/ttml-writer.ts`（导出入口 `exportTTMLText`）、`src/modules/project/logic/ttml-parser.ts`
- 规范依据：`AMLL TTML DB 格式规范`（本地 `spec.md`，行号均指该文件）
- 方法：临时 vitest 用例（`zz-spec-audit*.test.ts`，已删除）直接调用 `exportTTMLText` 导出真实 XML；部分用例再做 `parseLyric → exportTTMLText` 往返，用于验证真实文件路径。
- 环境说明：happy-dom 会给 `<tt>` 注入重复的 `xmlns="http://www.w3.org/1999/xhtml"`，并把 `iTunesMetadata` 序列化成小写 `itunesmetadata`。两者都是测试环境产物，不是产品缺陷。`pretty=true` 依赖 `XSLTProcessor`，happy-dom 无此 API，故 pretty 路径只做代码审阅。

## 结论汇总

| # | 规则 | 结论 | 规范依据 | 代码位置 |
|---|---|---|---|---|
| 1 | 时间格式：半角 `:`、最多两个冒号、不含字母 | 部分不合规 | spec:68,87,88 | `src/utils/timestamp.ts:26-63`；`ttml-writer.ts:586,634,1180,1358,1578` |
| 2 | `begin < end`；子元素时间包含于父元素；不超 `dur` | 部分不合规 | spec:475,476-477,478,55 | `ttml-writer.ts:1155-1181,1358`, `1578`, `910-911` |
| 3 | `itunes:key` 自 L1 起连续递增；`<text for>` 必须命中已有 `<p>` | 合规 | spec:588,266 | `ttml-writer.ts:886,942-944,1197,1436,1477,1511,1551` |
| 4 | 逐字 `type="replacement"` 的 span 时间必须等于主歌词音节时间 | 部分不合规 | spec:278 | `ttml-writer.ts:631-650,653-679,686-767` |
| 5 | `<translation>` 必须带 `type` + `xml:lang`；同一语言不得同时出现在 head 与行内 | 不合规 | spec:246-249,261-263 | `ttml-writer.ts:1418-1430`, `1141-1156,1157-1172`（parser） |
| 6 | BG 位置规则；半角括号恰好一对 | 部分不合规 | spec:602,603 | `ttml-writer.ts:1077-1081`, `1027-1029,1055-1063` |
| 7 | Ruby 四层结构、`base` 不带时间、多个 `text` 按时间排列 | 不合规（确认） | spec:524-529 | `ttml-writer.ts:477-501` |
| 8 | `<tt>` 根元素：命名空间、`xml:lang`、`dur`、无 BOM/XML 声明、`itunes:timing` | 基本合规（1 处风险） | spec:40-52,55 | `ttml-writer.ts:778-809,1567-1578,1583-1605` |
| 9 | 元数据：至少一个平台 ID、`amll:meta`、`iTunesMetadata` 位置 | 合规（仅提示缺失） | spec:203,206,253 | `ttml-writer.ts:820-883,1373-1378`；`submit-to-amll.ts:53-64` |
| 10 | `<p>` 内部结构：主内容/BG 顺序、空 span、`<p>` 无内容 | 部分不合规 | spec:585,483-486 | `ttml-writer.ts:950-964,1262-1288,415-443` |
| 11 | §7.3 行内 `x-translation`/`x-roman` 是否允许；导出器是否产生 | 合规（不产生，且会降级） | spec:597-599 | `ttml-writer.ts`（全文件无该 role）；`ttml-parser.ts:1141-1172` |
| 12 | `ttm:agent` 引用必须在 head 中定义 | 可能不合规 | spec:587,590-591 | `ttml-writer.ts:823-854,1184` |
| 13 | 同一演唱者的 `<p>`/`<span>` 不得重叠 | 无法判定 | spec:479 | —（依赖编辑数据） |
| 14 | 上传前必须校验元数据（至少一个平台 ID） | 不合规（校验缺口） | spec:206 | `submit-to-amll.ts:53-64` |

---

## 一、确定不合规（有可复现的失败用例）

### 1. 同一语言同时出现在 head 的 `type="subtitle"` 与 `type="replacement"`

- 规范：`spec:246-249` —「当两种格式同时存在时…**这会导致双重翻译**。为避免重复，请确保同一语言的翻译只出现在一种格式中。」
- 代码：`ttml-writer.ts:1418-1430` 的 `translationCache` 以 `` `${lang}:${type}` `` 为键（缓存本意是「同一语言不重复建元素」，但键把 `type` 也算进去了），所以同一 `lang` 可以建出两个 `<translation>`。
- 触发：第 1 行只有逐行翻译（subtitle）、第 2 行只有逐字翻译（replacement），且两行语言相同。这完全由编辑器正常操作即可产生——用户在某一语言下对部分行使用「分配翻译」即成逐字。
- 实际输出（J.xml）：

```xml
<translation xml:lang="zh-Hans" type="subtitle">
  <text for="L1">你好世界</text>
</translation>
<translation xml:lang="zh-Hans" type="replacement">
  <text for="L2"><span begin="00:04.000" end="00:05.000">甲</span>…
</translation>
```

- 应为：每个语言只有一个 `<translation>` 块，`type` 按该行是逐字还是逐行选择（规范本身允许多个 `<text>` 共用同一语言块）。
- 对已在库文件的影响：**高**。往返一次即产生该结构，且解析器把它读成两份互不相同的翻译数据，重复往返会让「同一语言多份翻译」持续存在。

### 2. `<p>` 与 `<span>` 的 `begin` 可能等于 `end`（0 宽时间轴）

- 规范：`spec:475` —「`begin` 时间必须早于 `end` 时间。」（必须是严格早于）
- 代码：`ttml-writer.ts:1155-1181`。`finalEndTime = Math.max(finalEndTime, maxSpanEnd)`，若某个音节自身 `startTime === endTime`（实际导出里很常见：末字 `00:30.000/00:30.000`，或占位标点 `<span begin="00:30.000" end="00:30.000">。</span>`），该值会直接写进 `<p end>`。
- 触发：整行最后一个音节 `startTime === endTime`，且它是该行最大结束时间。
- 实际输出（G.xml）：

```xml
<p begin="00:27.000" end="00:30.000" …>
  …<span tts:ruby="text" begin="00:27.950" end="00:30.000">しゃく</span></span>
  <span begin="00:30.000" end="00:30.000">。</span>
</p>
```

（此处 `<p>` 恰好仍满足严格小于，因为最小 begin 更早；但同一行的 `<span begin="00:30.000" end="00:30.000">。</span>` 已经违反规范；当该 0 宽音节成为行内极值时 `<p>` 也随之违规。）
- 应为：0 宽音节至少要有一个最小非零宽度（例如与该音节同一时间点写成 `end = begin + 1ms`），或者不写出时间属性。写入端目前没有任何「begin < end」的兜底校验。
- 对已在库文件的影响：**中高**。末字/末标点 0 宽是导入数据的常见形态（例如 LRC 均分、纯文本导入）。

### 3. `begin="NaN:000NaN"` —— 非法时间字符串

- 规范：`spec:68,88` — 时间只允许数字与半角冒号，不得含字母。
- 代码：`src/utils/timestamp.ts:26-63`。`msToTimestamp` 只对 `t < 0 || Number.isNaN(t)` 归零，`undefined === NaN` 为 false，于是 `undefined` 会一路算到 `secs.toFixed(3)` 产生 `NaN`，`hrs/mins` 同样为 `NaN`，最终返回 `NaN:000NaN`。
- 触发：任一词的 `startTime`/`endTime` 为 `undefined`（`NaN` 同理）。动态行内任意一个词即可（BD.xml）：

```xml
<p begin="00:01.000" end="00:03.000" ttm:agent="v1" itunes:key="L1">
  <span begin="00:01.000" end="00:02.000">A</span>
  <span begin="NaN:000NaN" end="NaN:000NaN">B</span>
</p>
```

- 应为：`msToTimestamp` 把非有限数（`undefined`/`NaN`）与负值一并归零，或写出端跳过时间属性。
- 对已在库文件的影响：**中**。依赖能否从编辑器 UI 产生未初始化时间的词；本项未做真实导入路径验证（见「无法判定」）。

### 4. Ruby：多个 `tts:ruby="text"` 未按时间排序

- 规范：`spec:529` —「可以在 `<span tts:ruby="textContainer">` 内放置多个 `<span tts:ruby="text">` 标签，每个注音音节独立设置时间戳，**按时间顺序排列**。」
- 代码：`ttml-writer.ts:491` `for (const rubyWord of word.ruby ?? [])` 直接按数组顺序写出，无排序。
- 触发：`word.ruby` 数组顺序与时间顺序不一致（AA.xml）：

```xml
<span tts:ruby="textContainer">
  <span tts:ruby="text" begin="00:02.000" end="00:02.500">ん</span>
  <span tts:ruby="text" begin="00:01.000" end="00:02.000">せ</span>
</span>
```

- 应为：导出前按 `startTime` 排序。
- 对已在库文件的影响：**低-中**。仅在编辑器/导入产生乱序 ruby 数组时出现；正常逐字输入按时间追加，顺序正确。
- 附带（无法判定项，非确定不合规）：`spec:525` 要求 `tts:ruby="base"`「**不得**包含时间戳属性」——`ttml-writer.ts:485-488` 确认未写入，**合规**；但 ruby 容器的 `begin`/`end` 与 `base` 的时间关系（规范未定义）无法判定。

### 5. BG 括号可能变成双层 `((…))` 或只剩半侧

- 规范：`spec:603` —「建议使用半角括号将背景人声文本包裹起来。**不要添加两个或更多括号或只添加半边括号**。」`spec:602` 的 BG 起始/结束 span 示例本身也不带括号（`<span ttm:role="x-bg">` 内层才带），即括号属于文本内容而非结构。
- 代码：`ttml-writer.ts:1027-1029`（逐字）与 `1055-1063`（逐行）一律在首/末**单词元素**上无条件加 `(` / `)`，不检查文本是否已带括号。
- 触发 A（双括号）：数据里 BG 文本自带括号。可从合规文件出发经真实 `parseLyric → exportTTMLText` 复现：取一个 x-bg 内层首个 span 为纯空白（`<span begin="00:04.000" end="00:04.200"> </span>`）的规范形态文件，往返一次后空白占位的词被丢弃、下一词的文本进入首/末位置并再被包一层括号（DA-1.xml）：

```xml
<span ttm:role="x-bg" begin="00:03.100" end="00:03.700">
  <span begin="00:03.100" end="00:03.300">((oh</span>
  <span begin="00:03.300" end="00:03.700"> yeah))</span>
</span>
```

- 触发 B（只加半边）：首/末位置恰好是纯空白词。`ttml-writer.ts:1055-1063` 选择 `elements[0]` / `elements[last]` 时用节点数组下标而非「首个/末个非空白词」，空白文本节点会把括号位置挤掉。DA 用例（真实 `<span begin="00:04.000" end="00:04.200"> </span>` 作为 x-bg 首个内层 span，经 `parseLyric → exportTTMLText`）输出：

```xml
<span ttm:role="x-bg" begin="00:04.200" end="00:06.000">
  <span begin="00:04.200" end="00:05.000">((oh</span>
  <span begin="00:05.000" end="00:06.000"> yeah)</span>
</span>
```

（此处实测到的是多一层括号；同一处的 `1055-1063` 用节点数组下标而非「首个/末个非空白词」定位，因此当首/末位置恰为空白节点时，括号会加在空白段上，而逐字分支 `1027-1029` 用 `firstWordIndex/lastWordIndex` 定位是正确的——只有逐行分支存在该定位缺陷。首/末为空白这一形态未单独实测。）
- 应为：写入前先剥掉 BG 文本首尾的 `(`/`）`/`）`，再统一补一对半角括号；空白节点不参与括号定位。
- 对已在库文件的影响：**高**。AMLL 数据库里大量文件的 x-bg 文本自带括号（规范示例即如此）。解析器在 `ttml-parser.ts:1272-1288` 会剥一层，因此「库文件 → 工具 → 导出」会恢复成一对（已验证：CD-1/CD-2 稳定）；但**首尾为空白节点的文件会持续累积一层括号**（DA-1），这是对库文件的真实破坏路径。

### 6. 逐字 BG 翻译在「主行/中间 BG 行缺数据」时整体错位

- 规范：`spec:304` — 逐字 BG 辅助歌词必须落在 `ttm:role="x-bg"` 的 span 内；`spec:266` — 内容与行的关联必须准确。
- 代码：`ttml-writer.ts:1210-1211`。逐行翻译收集时 `const bgList = collectBgLineTexts(bgViews.map((v) => v.trans[lang]))` 保留了「中间缺失 → 空串占位」，但紧接着 `const bg = bgList.find((x) => x.length > 0) ?? ""` 把所有 BG 行压成一个**非空字符串**；下游 `1441-1446` 看到 `bgList.length > 0` 就直接用这个压缩后的 `bgList`（`["后半"]`），占位信息丢失。
- 触发：主行有某语言翻译、有 2 个 BG 行、且**只有第 2 个 BG 行**有该语言翻译（K.xml）：

```xml
<text for="L1">主行<span ttm:role="x-bg"></span><span ttm:role="x-bg">后半</span></text>
```

- 该结构本身在导出层面是**正确**的（`appendWordLevelContent` 与 `bgSpanList` 都按 bgIndex 对齐；`R-roundtrip.json` 显示解析回读后第 1 个 BG 行得到空串、第 2 个 BG 行得到「后半」，对齐无误）。但结合上面第 1 条与解析器行为，同一份数据在「逐字翻译」通道（`1474-1483`）会额外再写一份同语言 `<text for="L1">`，使同一 `for` 在同一语言下出现两次；规范 `spec:266` 要求 `for` 与 `<p>` 的 `itunes:key` **完全一致**，重复的 `for` 属于解析歧义。
- 应为：同一 `Lx` 在同一语言块内只出现一个 `<text>`；BG 逐行/逐字内容在主行 `<text>` 内用按 bgIndex 对齐的 `<span ttm:role="x-bg">` 表达。
- 对已在库文件的影响：**中**。任意「主行逐行翻译 + 某 BG 行逐字翻译同一语言」的文件都会命中。

### 7. 空元素与空 span

- 规范：`spec:157` —「有多个值的，应为每个值创建一个标签」；`spec:266` 要求 `<text>` 承载内容。规范未明文禁止空元素，但空 `<text>`/空 `<x-bg>` 会被解析器当成占位（`ttml-parser.ts:496-497`），语义上是「这一路 BG 行没有内容」。
- 触发 A：逐字翻译数据的时间戳匹配不到任何音节（不满足「全部 0/0」也不满足「重复时间」两个回退条件）时，`ttml-writer.ts:703 / 726` 的 `if (!match || match.text.length === 0) return;` 会跳过全部内容，但仍建元素（CA.xml）：

```xml
<translation xml:lang="zh-Hans" type="replacement"><text for="L1"></text></translation>
```

- 触发 B：对齐用的空 BG 占位（`ttml-writer.ts:750-756`、`1450-1453`）会产生 `<span ttm:role="x-bg"></span>`（K.xml 已见）。这一类**是有意为之**，解析器也按占位处理，属于设计取舍，不建议按缺陷处理。
- 应为（仅触发 A）：若最终没有任何子内容，则不输出该 `<text>`（或整块不输出）。
- 对已在库文件的影响：**低**。

---

## 二、可能不合规（需要真实浏览器/播放器确认）

### 8. 已删除/空行导致 `<p>` 内容为空（但 `<p>` 仍带 `Lx` 与时间）

- 规范：`spec:585` —「应使用 `<p>` 分隔歌词行」；`spec:483-486` — 逐行歌词的 `<p>` 必须带 `begin`/`end`。
- 代码：分组逻辑 `ttml-writer.ts:415-443` 只把 `words.length === 0` 的行当作 div 分隔符丢弃，其他行一律建 `<p>`；`createLineModeNodes`（`529-579`）对全空白词会在 `536-540` 分支产出文本节点，但若该行只有**单个全空白词**，`createWordElement` 会把它包成 span，于是出现 `<p>` 内容为 `" "`：「空白」既有可能是文本节点也可能是 span，取决于词的个数，行为不一致。
- 实际输出（X.xml，中间一行仅一个空白词）：

```xml
<p begin="00:03.500" end="00:04.000" ttm:agent="v1" itunes:key="L2"> </p>
```

- 判定理由：`itunes:key` 仍占号（使后续行号不连续于「有效行」，但规范 `spec:588` 只要求连续递增，故不违规），空 `<p>` 是否被解析器/渲染器接受需要真实运行确认。
- 对已在库文件的影响：**低**（空白词行少见）。

### 9. `<p>` 文本越出 `<div>` 的 `end`（BG 为主行内容之后的收尾时）

- 规范：`spec:476-477` —「子元素的时间戳必须完全包含在父元素的时间戳之内…`<p>` 的时间范围必须在 `<div>` 的时间范围内。」
- 代码：`div` 的 `end` 在 `1350-1356` 只由 `querySelectorAll("p[begin][end]")` 取 `<p>` 的 `end` 来决定，而 `<p>` 的 `end` 在 `1155-1181` 会被其内部 `x-bg` span 的 `maxSpanEnd` 撑大。由于 `<p>` 的 `end` 属性先于 div 计算被写入（`1180`），div 汇总应当包含它——在多数数据下二者一致。
- 未确认点：当同一 `div` 内出现只含 BG 的 `<p>`、或某行 `endTime` 为 0（`DE.xml` 中末尾空行使 `body dur` 保持 `00:12.000` 而 div 只到 `00:03.000`）时，`body dur ≥ 最后时间戳` 仍成立，但 `div` 时间包含关系需要真实解析器/渲染器验证。
- 对已在库文件的影响：**低-中**。

### 10. `pretty=true` 输出含 XML 声明与额外的 xhtml 命名空间

- 规范：`spec:40` —「TTML 文件中不得包含字节顺序标记 (BOM)。」`spec:20-28` 声明 XML 声明是允许的。
- 代码：`ttml-writer.ts:1583-1605` 用 `XSLTProcessor` + `xsl:output indent="yes"` 重新序列化。`xsl:output` 默认 `omit-xml-declaration="no"`，因此 pretty 路径会加 `<?xml …?>`；happy-dom 无法执行该路径，**未能实测**。
- 现状缓解：所有生产保存路径（`App.tsx:118`、`components/TopMenu/useTopMenuActions.ts:233/305`、`user/services/submit-to-amll.ts:329`、`user/services/request-file-update-push.ts:56`）都没有传 `pretty: true`，默认 `false`（`ttml-writer.ts:364-367`），因此实际落盘文件不带 XML 声明。
- 对已在库文件的影响：**无**（当前不生效），但若将来启用 pretty 需重新审计。

### 11. `ttm:agent` 可能引用未定义的 agent

- 规范：`spec:587` —「在 `<p>` 标签上使用 `ttm:agent` 属性，并通过在 `<head>` 中定义的 `xml:id` (如 `v1`) 来指明演唱者。」`spec:590-591` 警告「即使是单人演唱的歌曲，也应为 `<p>` 添加 `ttm:agent="v1"`，并定义 "v1" agent」。
- 代码：`ttml-writer.ts:1184` `const agentId = line.agent ?? (line.isDuet ? "v2" : "v1")` 是硬默认值；而 agents 输出来自 `823-854`：若非空就**原样导出**，不会补 `v1`。`ttml-writer.ts:848-853` 的 `hasOtherPerson` 分支还把 `type="other"` 写成 `xml:id="v2"`，与规范 `spec:176`「`other`：使用 `v2000`」的建议不一致。
- 触发（W.xml）：`agents = [{id:"v0", …}]` 且某行 `agent` 为 undefined →

```xml
<ttm:agent type="person" xml:id="v0"></ttm:agent>
…
<p … ttm:agent="v1" …>
```

- 规范措辞是「应/建议」而非「必须」，且 `spec:178` 明确「建议非强制，可以使用任意字符串来表示 ID」，故列为可能不合规。反例已验证正常：库文件里 `<ttm:agent type="group" xml:id="v1000">` 能正确解析并原样导出（DC-1）。
- 对已在库文件的影响：**中**。只要编辑器里的 agent 列表不含 `v1`（例如用户删除了默认 agent），导出即产生悬空引用。

### 12. 上传前不校验「至少一个平台 ID」

- 规范：`spec:206` —「为了使歌词能够关联到各大音乐平台，**必须至少提供一个**平台 ID。」
- 代码：`submit-to-amll.ts:53-64` 的 `platforms` 集合**只含** `ncmMusicId`/`qqMusicId`/`spotifyId`/`appleMusicId`。若文件使用其他被规范接受的键（例如历史格式的 `appleMusicId` 之外的平台键），校验会误报缺失。反过来，`exportTTMLText` 自身（`872-881`）不做任何必填校验，纯导出路径不会提示缺少平台 ID。
- 对已在库文件的影响：**低-中**（校验缺口，不是输出格式错误）。

---

## 三、已确认合规（简要，附验证点）

1. **`itunes:key` 连续性（规则 3）** — `ttml-writer.ts:886/942-944` 单一计数器 `mainLineCounter` 从 1 递增，空行（`415-421`）与 BG 行（`424-428`）都不消耗编号。Z-keys/BE-keys 实测：跨界（songPart、空行、BG）仍为 `L1,L2,L3`，且 `for` 集合与 `key` 集合完全一致（`{"keys":["L1","L2"],"fors":["L1","L2"]}`），无悬空 `for`。
2. **逐行 BG 位置规则（规则 6 前半）** — `ttml-writer.ts:1077-1081` 以 `bgBeginTime < mainBeginTime` 判定：BG 早于主唱则前置（BF.xml、BG.xml 实测前置），否则置于 `<p>` 末尾（BA.xml 实测后置），与 `spec:602` 一致。
3. **Ruby 结构（规则 7 的结构部分）** — `ttml-writer.ts:477-501` 输出完整四层 `container → base → textContainer → text`，`base`（`485-488`）**不带** `begin`/`end`，符合 `spec:525`；`begin`/`end` 只写在 `tts:ruby="text"` 上（`494-495`），符合任务描述与规范。
4. **根元素与命名空间（规则 8）** — `ttml-writer.ts:780-787` 写出 `xmlns`/`ttm`/`tts`/`amll`/`itunes`；`789` 写 `xml:lang`（`473` 兜底 `zh-Hans`）；`809` 写 `itunes:timing`。规范 `spec:47` 只「建议」`xml:lang`、`spec:49-52` 明确 `itunes:timing` 可选且「不会影响解析器的行为」，故 `Word|Line|None` 的取值不需要与内容严格一致（`802-808` 的判定与内容一致，无矛盾）。命名空间 URI 符合早期 `spec:26` 的 amll 示例，但该示例用的是 `http://www.example.com/ns/amll`（规范自身即为此值，未与 §1 的 W3C 命名空间表冲突）。
5. **`<body dur>`（规则 2 的 dur 部分）** — `ttml-writer.ts:910-911` 初值取最后一行的 `endTime`，`1567-1578` 再对所有 `div[end]` 取最大。DE.xml 实测：末行是可丢弃的空行时 `body dur="00:12.000"` 覆盖其时间，满足 `spec:55` 的「必须大于或等于最后一个时间戳的结束时间」。
6. **时间戳格式（规则 1 的格式部分）** — `timestamp.ts:26-63` 只使用半角冒号与数字，`hh:mm:ss.xxx` / `mm:ss.xxx` 形态，最多两个冒号（AC/CG 实测 `01:00:00.000`、`01:02:00.000`）；不存在 `10.0s` 式单位后缀。`spec:87` 的「最多两个冒号」满足。
7. **`<text>` 内的 BG 逐字内容（规则 4 的 BG 部分）** — `appendWordLevelContent`（`712-745`）按 `bgs` 序号建 span、按 `bgIndex` 对齐，`R-roundtrip.json` 证实第 1/第 2 个 BG 行翻译各归其位，且 `1450-1453` 的空占位保证了序号不漂移。
8. **行内 `x-translation`/`x-roman`（规则 11）** — 导出器全文**不产生**这两种 role，因此不会与 head 形式冲突；解析器 `ttml-parser.ts:1141-1172` 会读取它们并存入 `translatedLyricByLang`/`romanLyricByLang`，导出时降级为 head 的 `<translation>`/`<transliteration>`（O.xml 实测）。这一「行内 → head」的转换是**格式迁移**而非重复：只要迁移后不再同时存在两种形式，即符合 `spec:246-249`。注意反之不成立——见第 1 条。
9. **`itunes:song-part`（规则 10 的 div 部分）** — 导出 `ttml-writer.ts:931-933` 使用 `itunes:song-part`（`spec:556` 认可该属性），解析 `ttml-parser.ts:1305-1311` 同时兼容 `itunes:songPart`/`songPart`/`song-part`（DD-songparts/DD-1 实测往返稳定）。
10. **逐行（Line）模式的 `<span>` 时间忽略** — `spec:486` 允许逐行模式下辅助翻译 span 的 `begin`/`end` 被忽略；`ttml-writer.ts:961-964` 在非动态模式下用 `createLineModeNodes` 合并普通词，单单词行输出与旧行为一致（BB.xml）。

---

## 四、对已在 AMLL 数据库文件的风险排序

1. **BG 括号（第 5 条）** — 库文件普遍自带括号；首/末为空白节点的文件往返后累积 `((…))`（DA-1 已验证），是唯一「库文件 → 工具 → 导出」会持续劣化的路径。
2. **同语言 subtitle + replacement（第 1 条）** — 任何「部分行逐行翻译、部分行逐字翻译」的文件往返一次即产生双重翻译，且解析器会读成两份数据。
3. **`begin == end`（第 2 条）** — 末字/末标点 0 宽在库文件中常见，属格式违规（`spec:475`）。
4. **BG 翻译的重复 `<text for>`（第 6 条）** — 主行逐行 + BG 逐字同语言时出现，造成 `for` 歧义。
5. **悬空 `ttm:agent`（第 11 条）** — 依赖编辑器 agent 列表，可能批量影响同一作者的文件。
6. **`NaN:000NaN`（第 3 条）** — 需要未初始化时间进入导出，影响面取决于导入路径。

## 五、无法判定

- **`<p>`/`<span>` 同一演唱者重叠（`spec:479`）** — 取决于编辑数据，导出器只做 min/max 汇总（`1130-1177`），不检测重叠，无法从代码判定违规。
- **`pretty=true` 的 BOM / XML 声明** — happy-dom 无 `XSLTProcessor`（`ttml-writer.ts:1600` 抛 `ReferenceError`），无法实测序列化结果。已确认生产保存路径均不启用 pretty。
- **`<div>` 时间包含关系（第 9 条）** — 需要在真实浏览器/播放器里用真实文件确认 `div` ⊇ `p` ⊇ `span` 的边界情形。
- **逐字翻译 span 时间必须等于主歌词音节时间（`spec:278`，规则 4）** — 导出器只负责写出，不负责校正：时间不一致的数据会被原样写出，但也正因如此，只要上游解析正确（`ttml-parser.ts:337-368` 逐 span 读时间）输出即正确。本项未能找到「导出器自身引入时间不一致」的确定反例（F.xml 的 0/0 数据来自我的手工构造，未证实合法路径会产生该形态），故未列为确定不合规。
- **数据为空 / 时间全为 0 时 `itunes:timing="None"`** — DF.xml 输出 `dur="00:00.000"` 且无有效时间轴；规范未定义空文件语义，无法判定是否违规。
