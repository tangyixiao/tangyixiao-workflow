# 按任务选用、保留和更新技能

只引用本工作流即可。先写出这次要交付的东西和验收方法，再查看当前客户端实际提供的技能、工具与项目已有实现。优先复用能交付结果的那一个；只有另一个技能能补上具体缺口时才组合。宿主支持原生调用时按其方式加载。普通任务沿用已验证的版本。

## 能不能在这里用

- **模型能做哪一步？** 对照任务核实模型能否读图、生成图片、调用工具或操作文件。例如建模脚本可以由代码模型编写，造型验收还需要能看多视图渲染的模型或人工审阅。用当前可用能力走一个小样，记录实际可用的步骤。
- **宿主具备什么？** 看 Skill 源码、来源修订、许可证、必需的 CLI、插件、MCP 工具、版本和权限。目录可见、插件已加载、产物可用是三个分别验证的结果。专属某个宿主的技能只在相应环境启用。涉及远程模型、付费 API、上传作品或新增持续服务时，核对本次授权及成本。
- **留多久？** 一次性参考记录来源即可；仅服务单一项目的固定在项目范围；跨项目反复使用且通过小样验收的才长期安装。记录来源、修订、宿主、依赖和复测方法。长期保存前看许可是否允许再分发，按允许的范围备份。去除旧版或试验材料时，先查本地定制和仍在使用的项目，再按[清理指南](resources.md#recoverable-file-cleanup)处理。
- **何时更新？** 因明确更新请求、兼容性变化、修复或任务所需的新功能再评估升级。核对来源、版本差异、新依赖和权限，保留回退版本；更新后用原小样在当前模型和宿主复测。模型、客户端或工具链换版时也要重测关键一步。[验收与更新](acceptance-and-updates.md)

## 视觉资产怎样选

| 要交付什么 | 优先使用的能力 | 验收入口 |
| --- | --- | --- |
| 工具栏图标、应用图标 | 界面图标先复用项目图标库，可用 [Better Icons](https://github.com/better-auth/better-icons/tree/main/skills) 从同一集合选 SVG，核对该集合的许可。原创图标可用图像工具做概念稿；Expo 启动图标可用 [expo-app-icon](https://github.com/eho/agent-skills/tree/main/skills/expo-app-icon) 打包 | 在实际控件尺寸和深浅背景下查看 SVG；启动图标还要核对透明度、系统遮罩及原生构建后的桌面效果 |
| 封面、插画、透明素材 | 可用宿主的图像生成工具；文章按用途选择宝玉的 [封面](https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-cover-image) 或[配图](https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-article-illustrator)技能 | 在目标页面看裁剪、文字、边缘和透明背景；产品操作图用实拍或真实截图 |
| 演示视频、动效 | 真实操作录屏配 [Remotion](https://www.remotion.dev/docs/ai/skills) 或已有的 [DrawAI Video Studio](https://github.com/tangyixiao/drawai-video-studio)；HTML 动效可选 [HyperFrames](https://github.com/heygen-com/hyperframes) | 实际播放横竖版成片，核对操作结果、帧率、字幕安全区和小屏可读性。[视频指南](video.md) |
| 可编辑模型和可导入的 3D 资产 | 可用 [blender-modeler](https://github.com/calebrisc/blender-modeler) 配本地 Blender。DSH 的 [create-3d-model](https://github.com/CheshireJCat/blender/tree/main/skills/create-3d-model) 需要对应插件工具和兼容的宿主版本 | 对照尺寸和多视图修改模型；保留可编辑源文件，在实际目标环境重新导入导出件，检查比例、朝向、材质和贴图 |
