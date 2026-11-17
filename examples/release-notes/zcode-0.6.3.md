## 主要变化

- 原生中英文工具箱进入稳定版，可集中查看状态、模型与推理档位、重试设置、工具权限、缓存、用量和诊断信息。
- 多账号管理复用 Z·SWITCH 的账号库，支持保存、选择、更新、改名、删除和手动查询额度。默认独立模式只切换 DSH 使用的账号，也可选择与 ZCode 共用登录。
- 上下文超限现在会明确报错并结束超限会话，避免继续复用无效会话；同时修复社区 Retry 安装参数与损坏凭证处理。

## 安装与升级

需要 Node.js 22 或更新版本，以及插件声明支持的 DSH 宿主。独立账号模式还需要兼容的 npm ZCode CLI 和操作系统保护的密钥存储；共享模式使用已安装的 Z·SWITCH 管理器。

**DSH Desktop**：下载本发行的 [TGZ 安装包](https://github.com/tangyixiao/dsh-zcode-plan-bridge/releases/download/v0.6.3/dsh-zcode-plan-bridge-0.6.3.tgz)，在“扩展 → 插件管理 → 添加插件”中选择文件。

**自行管理的 Web profile**：

```sh
dsh plugin --profile web add dsh-zcode-plan-bridge@0.6.3
```

下载文件请核对附件 [SHA256SUMS.txt](https://github.com/tangyixiao/dsh-zcode-plan-bridge/releases/download/v0.6.3/SHA256SUMS.txt)。

## 使用限制

- 自动换号只在明确额度耗尽后影响下一次请求，不跨账号重跑失败任务。限流、登录失败、上下文超限和 ESA 405 不会被当作额度耗尽。
- 如果 DSH 对话历史本身过长，仍需压缩对话或新开会话。
- 真实账号推理、令牌刷新和在线自动换号尚未完成实测验证，不能把隔离启动检查当成这些流程已验证。

<details>
<summary>验证记录与源码</summary>

原发行记录包含离线测试、类型与构建检查、多平台 CI 和隔离宿主启动检查。隔离检查阻断网络且未生成内容，其覆盖不包含上面列出的真实账号流程。

[对应源码 4e6526ed](https://github.com/tangyixiao/dsh-zcode-plan-bridge/tree/4e6526ed5726f6fe61400010c06a25766c7d1e21) · [该版本兼容声明](https://github.com/tangyixiao/dsh-zcode-plan-bridge/blob/4e6526ed5726f6fe61400010c06a25766c7d1e21/package.json)

</details>
