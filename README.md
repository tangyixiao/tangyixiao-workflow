# Tangyixiao Workflow

[English](README.en.md) · [上手指南](docs/getting-started.md) · [模块与边界](docs/modules.md) · [客户端支持](docs/client-support.md)

用这个 Skill 给仓库写 README、准备 PR 和发行说明。随附的本地 CLI 可以检查已接入项目的配置、受管理的 AGENTS 段落和候选发行文件。

当前是 **0.1.0-alpha.1 开发版**，需要 **Node.js 22 或更新版本**和 **Git**。源码仓库是 [tangyixiao/tangyixiao-workflow](https://github.com/tangyixiao/tangyixiao-workflow)。本版尚未作为 npm 包或产品 Release 发布；`@tangyixiao/workflow` 是项目包名，`tywf` 是命令别名，下面直接使用源码 CLI，不依赖全局命令。

## 安装到 Codex

首次使用可从 GitHub [下载 main 源码 ZIP](https://github.com/tangyixiao/tangyixiao-workflow/archive/refs/heads/main.zip)。解压后，在包含 `bin/pwf.mjs` 的目录打开 PowerShell。已有源码的可以直接进入该目录。

先用 `doctor` 检查环境，再用 `install` 预览安装计划。给 `install` 加上 `--apply` 后会写入选定的 Skill 目录。最后运行 `status`，确认 `state` 为 `complete`。

```powershell
node bin/pwf.mjs doctor
$skillDir = Join-Path $env:USERPROFILE '.codex/skills/tangyixiao-workflow'
node bin/pwf.mjs install --destination "$skillDir"
node bin/pwf.mjs install --destination "$skillDir" --apply
node bin/pwf.mjs status --destination "$skillDir"
```

安装副本携带必要 CLI/runtime 和按需参考，无需网络或另装依赖。让客户端重新发现 Skill 后，调用 `$tangyixiao-workflow`，例如：

> 用 $tangyixiao-workflow 检查这个项目，先预览接入计划，保留已有 README、工作区和未提交修改

本机发现、实际调用和其他客户端兼容性分别验证；文件落盘不代表所有会话已经加载。[支持范围](docs/client-support.md)

## 给自己的仓库或其他项目写公开文案

在目标仓库直接调用 Skill 即可，无需先运行 `adopt`。先看该项目的贡献指南、模板和近期已接受的同类内容，再根据实际改动起草。例如，给上游项目补了一条安装命令后，可以这样调用：

> 用 $tangyixiao-workflow 阅读这个项目的贡献指南、PR 模板和我的 diff，给这次 README 改动写一个英文 PR 标题和正文。

| 要写的内容 | 读者需要知道什么 |
| --- | --- |
| README、仓库 About 和 Wiki | README 给出第一次使用的步骤和预期结果，About 用一句话说明项目用途，Wiki 每页带读者完成一项具体任务。 |
| PR、commit、issue 和 discussion | PR 说明改动及验证方法，commit 标明单次改动，issue 给出复现条件或使用场景，discussion 提出需要讨论的问题。 |
| Release 和 GitHub Actions | 发行说明写明本版变化以及获取或升级方式。Actions 用步骤名说明检查什么，摘要告诉读者结果以及失败后该看哪里。 |

起草、核对项目事实和发布后回读的方法见[公开协作写作指南](skills/tangyixiao-workflow/references/public-writing.md)。

需求不清或项目要跨阶段推进时，可参照[需求、计划与决策指南](skills/tangyixiao-workflow/references/planning-and-decisions.md)。交付前用[仓库维护清单](skills/tangyixiao-workflow/references/repository-stewardship.md)检查哪些入口需要更新。准备公开文件或换设备时，先看[文件去向与跨设备环境](skills/tangyixiao-workflow/references/files-and-devices.md)。

## 接入已有项目

把项目路径、仓库名和类型换成真实值；`npm`、`static`、`generic` 只选适用的一种。

```powershell
node bin/pwf.mjs adopt --project 'D:/path/to/project' --repository 'owner/repository' --profile npm
node bin/pwf.mjs adopt --project 'D:/path/to/project' --repository 'owner/repository' --profile npm --apply
node bin/pwf.mjs check --project 'D:/path/to/project'
```

接入配置保存在项目的 `.github/project-workflow.json`，保留该路径用于兼容；明确应用时可增加受管理的 AGENTS 区块。已有定制、许可证和无关文件保留，冲突应先检查。安装 Skill 与接入项目是两件事。

## 能执行什么

| 能力 | 本版范围 |
| --- | --- |
| `install` / `status` / `uninstall` | 明确 Skill 目录的计划、安装状态和保护修改后的卸载 |
| `adopt` / `check` / `upgrade` | 项目接入、受管理内容漂移检查及升级计划；写入需要 `--apply` |
| `release-check` | 离线校验候选的产品、版本、渠道和声明文件哈希；不发布、不证明包内入口或安装成功 |
| `notes-check` | 检查发行正文中的结构和明显的交差式叙事；不判断功能声明是否属实 |
| `finish` | 查看本任务登记资源和清理计划；不执行删除或停止进程 |
| 设计、文档、运营、视频参考 | 指导真实工作和核验；不自带建站平台、录屏器、渲染器或 bot 服务 |

完整接口以 `node bin/pwf.mjs --help` 为准。项目测试、GitHub 设置、CI、合并、发布、实际运行需要各自的证据。资源预算是可配置约定，不能替代客户端沙箱或操作系统配额。

## 留存、分享与升级

Skill 负责发现和调用，项目配置负责跨会话留存，核心仓库维护唯一版本源。升级核心后，先查看安装／项目升级计划，再应用符合范围的差异；不自动覆盖所有项目。需要卸载时先预览 `uninstall --destination ...`，已被修改的文件应保留。

精选 README／网站快照、原规范来源和发行正文修订案例见[来源说明](docs/provenance.md)。账户级 `.github` 社区默认文件仍单独维护；这里不会自动控制所有 agent，也没有后台守护程序。

代码和原创文档采用 [Apache-2.0](LICENSE)，见 [NOTICE](NOTICE)。引用项目和第三方素材保留各自权利与来源说明。

## 项目网站

下载或克隆仓库后，用浏览器打开[中文首页](project-website/site/index.html)或 [English homepage](project-website/site/en/index.html)。两个版本都可以离线阅读。
