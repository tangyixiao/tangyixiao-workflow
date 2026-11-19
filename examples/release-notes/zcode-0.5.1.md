本版修正兼容性声明的读取位置，使 DSH 宿主和插件目录能正确识别既有支持范围。

## 更新内容

- 修正 DSH 兼容性声明的位置；兼容范围、模型转发和授权行为保持不变，没有增加新的模型功能。

## 安装与升级

### 运行要求

- Node.js 22 或更新版本，以及对应版本声明支持的 DSH 宿主。

### 安装方式

**DSH Desktop**：下载本发行的 [TGZ 安装包](https://github.com/tangyixiao/dsh-zcode-plan-bridge/releases/download/v0.5.1/dsh-zcode-plan-bridge-0.5.1.tgz)，在“扩展 → 插件管理 → 添加插件”中选择该文件。

## 兼容性与已知限制

- 已使用 `0.6.0-community.*` 预览版的用户应保留该预览版。0.5.x 稳定线不包含该预览分支的无限重试功能，本版不能作为功能等价的原位升级。

<details>
<summary>校验与验证记录</summary>

**校验信息**

该发行未提供独立校验和附件，原始记录中的 TGZ SHA-256 为：

```text
3f4dcdc38a4faf3f3bd197474c06466126e287357b51a64d818f9e084ff44342
```

**验证范围**

原发行记录包括离线检查和打包 manifest 的宿主兼容性检查，不代表新增了真实模型推理验证。

**源码**

[对应源码 8a7ec736](https://github.com/tangyixiao/dsh-zcode-plan-bridge/tree/8a7ec7364dffd8c8c468ce8cbcae26cc716a9c5a) · [该版本兼容声明](https://github.com/tangyixiao/dsh-zcode-plan-bridge/blob/8a7ec7364dffd8c8c468ce8cbcae26cc716a9c5a/package.json)

</details>
