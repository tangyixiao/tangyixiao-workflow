## 修复内容

修正 DSH 兼容性声明的位置，使宿主和插件目录能正确读取既有支持范围。兼容范围、模型转发和授权行为保持不变，本版没有增加新的模型功能。

## 安装与升级

需要 Node.js 22 或更新版本，以及本版兼容声明覆盖的 DSH 宿主。

下载本发行的 [TGZ 安装包](https://github.com/tangyixiao/dsh-zcode-plan-bridge/releases/download/v0.5.1/dsh-zcode-plan-bridge-0.5.1.tgz)，在 DSH Desktop 的“扩展 → 插件管理 → 添加插件”中选择：

```text
dsh-zcode-plan-bridge-0.5.1.tgz
```

本发行提供以上 TGZ 安装路径；校验值见下方记录。

## 兼容性说明

已使用 `0.6.0-community.*` 预览版的用户应保留该预览版。0.5.x 稳定线不包含该预览分支的无限重试功能，本版不能作为功能等价的原位升级。

<details>
<summary>校验信息与源码</summary>

该发行未提供独立校验和附件，原始记录中的 TGZ SHA-256 为：

```text
3f4dcdc38a4faf3f3bd197474c06466126e287357b51a64d818f9e084ff44342
```

原发行记录包括离线检查和打包 manifest 的宿主兼容性检查，不代表新增了真实模型推理验证。

[对应源码 8a7ec736](https://github.com/tangyixiao/dsh-zcode-plan-bridge/tree/8a7ec7364dffd8c8c468ce8cbcae26cc716a9c5a) · [该版本兼容声明](https://github.com/tangyixiao/dsh-zcode-plan-bridge/blob/8a7ec7364dffd8c8c468ce8cbcae26cc716a9c5a/package.json)

</details>
