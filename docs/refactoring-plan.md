# AMLL TTML Tool 重构规划（审查修订版）

> 基于原始计划（refactoring-plan.md, antigravity）并经两轮源码核验修订。所有条目已对照 `vercel@6d5ac426` 代码逐一验证。
> 工作分支：`refactor/save-pipeline`。基线：`vitest` 1 个测试文件 / 28 个用例全部通过。

## 0. 原计划审查结论

| 原条目 | 核验结论 | 修订 |
|---|---|---|
| 1.1 无语言码翻译/音译丢失 | ✅ 属实，且更严重 | LRC/纯文本/lrclib 导入、逐字音译编辑（`roman-word-view.tsx:59`）、`syncByLang` 落入 `und` 均丢失 |
| 1.2 全局 Map `delete` | ✅ 属实 | `ttml-writer.ts:743, 821` |
| 1.3 背景行丢失 | ⚠️ 部分 | 仅「div 首行为 BG」时丢失（空行后、或 BG 自带 `songPart` 触发新 div） |
| 1.4 历史恢复不重置文件名 | ✅ 属实 | 已存在确认弹窗，无需新增；用 `getSuggestedTtmlFileName(metadata)` |
| 2.1 改时间戳导致逐字数据失联 | ✅ 属实，范围远大于原文 | 共 ~15 处时间戳修改点；split-word 实际路径为 `modules/segmentation/components/split-word.tsx`；`reduce-stutter.tsx:115-155` 是唯一正确同步的范例 |
| 2.2 自动保存竞态 | ⚠️ 仅 UI 状态错误 | IndexedDB 事务顺序保证不会写入旧数据；仅状态显示虚假 Saved；另 `!isDirty` 时强制 Saved |
| 2.3 `isDirty = canUndo` | ✅ 属实 | 保存后永不清零 |
| 2.4 save-file 死锁 | ✅ 属实（Web 端也有） | 模块级 `planned` promise 全局锁 + 等 `focus`；Tauri 无 dialog/fs 插件，也走 webview 下载 |
| 2.5 beforeunload 未刷盘 | ⚠️ 描述不准 | 实际是**无条件**提示（不看 isDirty），也不刷盘 |
| 3.1 缺 Toast | ✅ 属实 | 使用现有 `pushNotificationAtom`，不引入新库；`meta-suggestion-manager` 完全无 try/catch |
| 3.2 文件名非法字符 | ✅ 属实 | 复用 `lrclib/ImportDialog.tsx:136` 的正则 |
| 3.3 parsererror | ✅ 属实 | |
| 3.4 ESLyRiC 后缀 | ⚠️ 理由修正 | `.lrc` 符合外部惯例，但本工具按 `.eslrc` 识别；导出 `.lrc` 再打开会走普通 LRC 解析丢逐字时间 → 改为 `.eslrc` |
| 3.5 纯文本导入不重置状态 | ✅ 属实 | 另缺 `vocalTags`；`agents` 缺省在 `main.ts` 默认值、`useFileOpener` 等多处同样缺失 |
| 3.6a songwriter 只取第一条 | ❌ 基本不成立 | 真实问题：parser `L830` 对 iTunes songwriters 不合并而是 push 第二条 entry |
| 3.6b 多背景行逐字数据被忽略 | ✅ 属实 | 逐行数据也只取 `bgList[0]` |
| 3.6c 空行消失 | ✅ 属实 | |
| 3.6d 字段未持久化 | ✅ 属实 | 另有 `optimizeOptions`、`romanWarning`；writer 总写 `xml:lang` 导致 `autoLang` 往返后变 false |
| 4.4 Review 直接写 lyricLinesAtom | ❌ 不成立 | Review 通过 `openFile()` 正常流程替换编辑器内容，仅 isDirty 时确认；降级为 P3 |

**原计划遗漏的问题（新增）**

- N1 **Parser 多背景行顺序错乱**：`ttml-parser.ts:1284-1290` 只 pop 最后一个 BG，产出 `[bg1, main, bg2]`，导出时 `bg1` 挂到上一行或丢失。
- N2 **Writer 自产无法回读的数据**：`isAutoFilled` 时省略 `xml:lang`（L929, L1080），回读为 `und` 后被跳过；且存在已标注语言时 parser 直接跳过无标注项（L615, L721）。
- N3 **零时间单词全部匹配首条逐字数据**（纯文本导入单词皆 0/0）。
- N4 **Ruby 单词丢失自身 begin/end**（`createRubyWordElement` L158-182）。
- N5 **非逐字模式只导出 `words[0]`**（L456-461, L544-554）。
- N6 **`exportTTMLText` 修改入参**（L438 写 `line.itunesKey`），可能对冻结状态抛错。
- N7 序列化出口共 7 处，`App.tsx:118` 错误页保存忽略特殊 span 空格设置。

---

## 阶段 0：安全网（必须最先完成）

目标：在动任何生产代码前，让测试能系统性暴露丢数据问题。

- 新建 `src/modules/project/logic/ttml-roundtrip.test.ts`：`parse → export → parse` 深度相等断言（忽略 `id` 等内存字段，写一个 `normalizeForCompare` 工具）。
- `fixtures/` 下放置覆盖以下场景的 TTML：多语言逐行/逐字翻译与音译、多背景行、div 首行为 BG、空行、Ruby、对唱/agent、songPart、无语言码翻译、iTunes songwriters + amll:meta songwriter。
- 针对 1.1/1.2/1.3/3.6b/3.6c/N1-N6 每个缺陷编写一个独立用例，当前会失败的用 `it.fails(...)` 标记（阶段 1 修复后翻转为 `it`）。
- 一个 `Object.freeze` 深冻结输入的用例（N6）。
- **完成标准**：`npx vitest run` 全绿（失败用例以 `it.fails` 形式存在）；不修改任何非测试文件。

## 阶段 1：序列化零丢失（P0）

### 1A ttml-writer / ttml-parser（同一子代理串行完成，同文件）

1. **1.1** 无 `*ByLang` 时回退读取 `translatedLyric` / `romanLyric` / `word.romanWord`；`und` 不再跳过——输出为**不带 `xml:lang`** 的 translation/transliteration（或主体内联 `x-translation`/`x-roman` span，二选一以 roundtrip 稳定为准）。
2. **N2** parser 不再因存在已标注语言而丢弃无标注项；`und` 与具名语言并存。
3. **1.2** 移除全局 `map.delete(lang)`，按行判断：某行有逐字数据时只跳过该行的逐行输出。
4. **1.3 + N1** parser 正确展平多背景行（保持 `[main, bg1, bg2]`）；writer 先预分组（BG 归属到前一主行，无主行可归属时生成空主行容器），不再在循环里 `continue`。
5. **3.6b** 去掉 `bgLines.length === 1` 限制，逐个 BG 行按 `bgIndex` 输出逐字/逐行数据。
6. **3.6c** 空行导出为占位 `<p>`，解析时还原为空行（不再作为 div 分隔符吞掉）。若与 AMLL 数据库格式冲突，降级为仅保留 div 分隔语义并在测试中记录。
7. **N4** Ruby 容器写出 begin/end；**N5** 非逐字模式拼接全部 words；**N6** writer 内部先 `structuredClone` 再处理，不改入参。
8. **3.3** parser 检测 `parsererror` 抛出明确错误。
9. **3.6a(修正)** parser 合并 iTunes songwriters 到同一 metadata entry。
- 完成标准：阶段 0 所有 `it.fails` 翻转为 `it` 且通过；原 28 个用例不退化；`npx tsc -b --noEmit` 无新增错误；`biome lint` 无新增问题。

### 1B 状态与弹窗（可与 1A 并行，文件不重叠）

1. **1.4** `HistoryRestore.tsx` 恢复时 `setSaveFileName(getSuggestedTtmlFileName(metadata))`。
2. **3.5** `ImportFromText.tsx` 改用 `newLyricLinesAtom`，重置 `projectId`、`saveFileName`，补 `agents: []`、`vocalTags: []`。
3. 统一 `main.ts` 中 `lyricLinesAtom` 初始值 / `newLyricLinesAtom` 默认值补齐 `agents`，移除 `as` 断言；`useFileOpener.ts:116-131`、`lrclib/ImportDialog.tsx` 同步补齐。
4. 抽出 `createEmptyProjectState()` / `loadLyricIntoEditor(store, lyric, {fileName})` 帮助函数，把「设歌词 + 重置历史 + 重置选区 + 设 projectId + 设文件名」收敛为一处，所有加载入口（打开文件、新建、纯文本、lrclib、历史恢复）改用它。

## 阶段 2：逐字数据关联重构（P1，原 2.1 + 4.2 合并提前）

原计划先做 `syncWordTimestamps` 再长期改 ID；核验发现修改点 ~15 处且 N3 无法用时间戳解决，故**直接做 ID 关联**，不做过渡方案。

- 数据模型：`TTMLTranslationWord` / `TTMLRomanWord` 增加 `wordId?: string`。
- Parser：解析逐字数据时按时间匹配得到 `wordId`（仅在解析阶段使用时间匹配一次）；时间全为 0 时按非空白词序号匹配。
- Writer：优先按 `wordId` 找词，输出时取**词的当前时间戳**；无 `wordId` 回退时间匹配（兼容旧自动保存数据）。
- UI：`edit-mode.tsx:2002-2006` 语言切换、`roman-word-view.tsx` 编辑改为按 `wordId`；逐字音译编辑写回 `wordRomanizationByLang[当前语言]`（修复 1.1 的编辑侧根因）。
- 结构性操作（分词、合并、删除词、拆行、RubyEditor、分词引擎）：提供 `remapWordLinkedData(line, mapping)` 工具，分词时文本保留在第一个子词、合并时拼接文本；仅需改这些结构操作点，纯时间修改点（TimeShift、频谱拖拽、打轴键）无需改动。
- 自动保存数据迁移：加载旧数据时补 `wordId`（`autosave.ts` 读取路径中做一次 migrate）。
- 完成标准：新增「打轴/平移/拖拽后导出逐字翻译不丢」「分词后不丢」「纯文本导入 0/0 时间单词不串」测试。

## 阶段 3：保存管线（P1/P2）

1. **SaveService**：新建 `src/modules/project/services/save-service.ts`，统一 7 处序列化出口：`serializeProject(lyric)`（读取设置、单一 options）、`saveToFile(lyric, fileName)`、`copyToClipboard`、统一成功/失败通知（`pushNotificationAtom`）。`App.tsx` 错误页、`useTopMenuActions`、`submit-to-amll`、`request-file-update-push` 改用它。
2. **2.4** 移除 `save-file`，实现 `downloadBlob(blob, name)`（`<a download>` + `URL.createObjectURL`，无全局锁，立即 resolve）。Tauri 原生保存对话框（需加 Rust 插件和 capability）列为可选后续项，不在本阶段。
3. **2.3** 新增 `savedRevisionAtom` / `lyricRevisionAtom`（每次编辑递增）；`isDirty = revision !== savedRevision`；手动保存、导出 TTML、提交成功后更新 savedRevision。保留现有消费点语义（打开/新建前确认）。
4. **2.2** AutosaveManager 引入版本号，旧 promise 完成时不覆盖新状态；`!isDirty` 不再伪造 Saved。
5. **2.5** `beforeunload` 仅在 `isDirty` 时提示，并同步触发一次立即自动保存（尽力而为）。
6. **3.1** 所有导出/剪贴板/词库导出操作统一 try/catch + 通知（`meta-suggestion-manager` 补 try/catch）。
7. **3.2** `metadata-filename.ts` 过滤 `\ / : * ? " < > |` 与控制字符，抽出 `sanitizeFileName` 供 lrclib 复用。
8. **3.4** ESLyRiC 导出后缀改 `eslrc`。
- 完成标准：`grep save-file src` 为空；`exportTTMLText` 仅在 save-service 与测试中被引用；isDirty 单元测试。

## 阶段 4：模块化拆分（P3，需阶段 0-3 测试护航）

1. 拆分 `ttml-parser.ts` / `ttml-writer.ts` 为 `logic/ttml/{parser,writer}/*`（按原计划 4.1 目录），旧路径保留 re-export 文件避免大面积改 import。纯搬迁，不改行为，roundtrip 测试必须全绿。
2. **3.6d** 以 `amll:` 命名空间属性持久化 `ignoreSync`、`endTimeLink`、`autoLang`（`amll:meta`），`optimizeOptions`。**需确认与 AMLL 数据库 / 下游播放器兼容**——属于格式决策，执行前征求维护者同意。
3. 网络层适配器（原 4.5）：收敛 `TAURI_ENV_PLATFORM` 分支。
4. Review 隔离（原 4.4 修正）：打开 PR 前若编辑器有内容（不论 isDirty），提示并先自动保存快照。

## 阶段 5：功能分层与延迟加载（产品决策，不由子代理执行）

- `React.lazy` 延迟加载 Review / NCM / LRCLIB / 分词实验台（可执行，低风险）。
- 移除或独立化 Review 中台、NCM、词库管理、分词实验台——**属于产品方向决策，需维护者决定**，本次重构不执行。

---

## 执行编排

| 步骤 | 子代理 | 并行性 | 文件范围 |
|---|---|---|---|
| S0 | 阶段 0 安全网 | 单独 | 仅测试与 fixtures |
| S1 | 1A 序列化修复 | 与 S1B 并行 | `ttml-writer.ts`, `ttml-parser.ts`, 测试 |
| S1B | 1B 状态/弹窗 | 与 S1 并行 | `states/main.ts`, modals, `useFileOpener.ts`, lrclib |
| S2 | 阶段 2 逐字关联 | 单独 | types, parser/writer, 编辑器组件, autosave |
| S3 | 阶段 3 保存管线 | 单独 | services, TopMenu, App, autosave, dialogs |
| S4 | 阶段 4.1 拆分 | 单独 | logic/ttml/* |

每步结束由主代理：审查 diff → `npx vitest run` → `npx tsc -b`（对比基线错误数）→ `npx biome lint` → 单独 commit。
