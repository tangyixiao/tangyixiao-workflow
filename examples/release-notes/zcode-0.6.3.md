本版将工具箱和多账号管理纳入稳定版，并改进上下文超限与凭证异常的处理。

## 更新内容

- 原生中英文工具箱进入稳定版，可集中查看状态、模型与推理档位、重试设置、工具权限、缓存、用量和诊断信息。
- 多账号管理复用 Z·SWITCH 的账号库，支持保存、选择、更新、改名、删除和手动查询额度。默认独立模式只切换 DSH 使用的账号，也可选择与 ZCode 共用登录。
- 上下文超限现在会明确报错并结束超限会话，避免继续复用无效会话；同时修复社区 Retry 安装参数与损坏凭证处理。

## 安装与升级

### 运行要求

- Node.js 22 或更新版本，以及对应版本声明支持的 DSH 宿主。
- 独立账号模式需要兼容的 npm ZCode CLI 和操作系统保护的密钥存储；共享模式使用已安装的 Z·SWITCH 管理器。

### 安装方式

**DSH Desktop**：下载本发行的 [TGZ 安装包](https://github.com/tangyixiao/dsh-zcode-plan-bridge/releases/download/v0.6.3/dsh-zcode-plan-bridge-0.6.3.tgz)，在“扩展 → 插件管理 → 添加插件”中选择该文件。

**Web profile**：只用于自行管理的 Web profile。

```sh
dsh plugin --profile web add dsh-zcode-plan-bridge@0.6.3
```

## 兼容性与已知限制

- 自动换号只在明确额度耗尽后影响下一次请求，不跨账号重跑失败任务。限流、登录失败、上下文超限和 ESA 405 不会被当作额度耗尽。
- 如果 DSH 对话历史本身过长，仍需压缩对话或新开会话。
- 真实账号推理、令牌刷新和在线自动换号尚未完成实测验证，不能把隔离启动检查当成这些流程已验证。

<details>
<summary>校验与验证记录</summary>

**校验信息**

下载文件请核对附件 [SHA256SUMS.txt](https://github.com/tangyixiao/dsh-zcode-plan-bridge/releases/download/v0.6.3/SHA256SUMS.txt)。

**验证范围**

原发行记录包含离线测试、类型与构建检查、多平台 CI 和隔离宿主启动检查。隔离检查阻断网络且未生成内容，其覆盖不包含上面列出的真实账号流程。

**源码**

[对应源码 4e6526ed](https://github.com/tangyixiao/dsh-zcode-plan-bridge/tree/4e6526ed5726f6fe61400010c06a25766c7d1e21) · [该版本兼容声明](https://github.com/tangyixiao/dsh-zcode-plan-bridge/blob/4e6526ed5726f6fe61400010c06a25766c7d1e21/package.json)

</details>
