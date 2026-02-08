---
description: 从 Figma 设计稿生成静态 UI 代码
---

请执行以下流程，从 Figma 设计稿生成静态 UI 代码：

1. 调用 get_server_status 确认 Figma 插件已连接
2. 调用 get_workspace_config 获取项目配置
3. 调用 get_figma_selection 获取当前选中的 Figma 节点数据
4. 调用 get_code_rules 获取代码生成规则
5. 调用 get_component_mapping 获取组件映射配置
6. 分析节点结构，**先向我展示以下方案，等我确认**：
   - 节点结构分析
   - 组件拆分方案（名称、路径、职责）
   - 资源处理方案（图片/图标）
   - 技术决策说明
7. 我确认后，生成代码并使用 save_generated_code 保存
8. 资源文件使用 save_asset 保存

严格遵守代码生成规则，禁止跳过确认步骤直接生成代码。
