# 知序 Learnmore

将选定的对话和项目材料整理为个人学习课程。首课是机器学习：线性回归、损失、梯度下降、泛化与正则化。

完整模块划分、数据流、接口及本地版/在线版能力边界见 [架构说明](docs/ARCHITECTURE.md)。

## 使用

在本目录运行 `node server.mjs`，或使用 PowerShell 运行 `./start.ps1`。打开 <http://127.0.0.1:4317>。无第三方依赖，需要 Node.js 22+。

- 知识概览：学习路径、内容统计与通俗总览。
- 课程阅读：课件/书本模式，章节导航、数值例子、公式解释、已读记录；梯度下降章节可点击执行参数更新。
- 故事学习：内置武侠/科幻/言情短篇；连接本机 Codex 后支持自定义风格、按材料量或手动长度生成。
- 名词与公式：搜索、符号、前提、例子和导出。
- 练习：简易/适中/困难各 3 道计算题，数值判题、提示、逐步解析和进度。
- 材料：粘贴文本，导入 TXT/MD/JSON/JSONL/CSV，选择同项目近 21 天 Codex 对话，读取项目文本。
- 下方问答：每次携带当前章节/题目、课程公式与术语、所选材料和最近 10 条问答。答案完成后显示，通常需要数秒至几十秒。
- 导出：完整 HTML 阅读版、课程 Markdown、名词公式速查表、故事，以及浏览器打印/PDF。HTML 内练习解析可展开。

## 本地 GPT 连接

使用已登录的 Codex CLI（`codex login status`），不需要在浏览器填写 API Key。可设置 `LEARNMORE_CODEX_BIN` 为 codex.exe 的绝对路径。CLI 路径通常已由 Codex 终端提供，启动脚本也会尝试定位。

每次调用以只读、临时会话运行，禁用 shell、应用和多智能体功能，并关闭网页搜索；只处理显式传入的文本，不开启外部连接器。生成结果通过 JSON Schema 约束，课程的数学正确性仍应由学习者结合参考资料核对。不要把内置示例或未连接状态当成模型已读取你的聊天。

项目读取默认 `D:\Learnmore`，可在材料区修改路径。跳过隐藏目录、依赖、常见凭据文件、符号链接与二进制文件。每文件最多 14,000 字符，总量约 100,000 字符，最多 80 个文件、4 层目录；会提示截断。对话只提取最近 24 条用户/助手正文，不提取系统/开发者/工具消息；超长对话截取末尾约 70,000 字符。只读选定目录对应的本地对话记录，并非实时订阅整个 Codex。

本机服务仅监听 127.0.0.1。网页与接口需同源，接口要求自定义请求头；不开放跨域。材料和学习进度保存在当前浏览器 localStorage，生成期间临时文件位于被 Git 忽略的 `.learnmore-runtime/`，结束后清除。刷新浏览器保留课程、材料与进度；问答和新生成故事暂存在当前页面内存，可用导出保存。

## 在线阅读版

`dist/` 可独立部署为私有静态网站。线上版提供全部内置机器学习内容、阅读/故事切换、练习、搜索、导出与浏览器进度记录。**线上版不运行本机 Codex，也不会读取电脑文件**；生成/追问会明确引导使用本地版。线上与本地浏览器的学习记录分别保存。

## 检查

运行 `node --check server.mjs`、`node --check dist/app.mjs`、`node --check dist/content.mjs` 检查语法；`node --test tests/core.test.mjs` 检查计算题答案、判题边界、对话提取及接口来源校验。安装了 npm 的环境也可使用 `npm run check` 和 `npm test`。

## 参考

首课为原创讲解和原创数值题，知识体系和题型参考公开教材《动手学深度学习》[线性回归](https://zh.d2l.ai/chapter_linear-networks/linear-regression.html)、[梯度下降](https://zh.d2l.ai/chapter_optimization/gd.html)、[模型选择](https://zh.d2l.ai/chapter_multilayer-perceptrons/underfit-overfit.html)。

Codex 集成依据 [OpenAI 非交互模式文档](https://learn.chatgpt.com/docs/non-interactive-mode) 和本机 CLI 帮助。未改动任何已有 PPT、申请材料或学校门户。
