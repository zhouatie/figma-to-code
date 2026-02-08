---
description: 结合技术方案和 Figma 生成可交互的代码
---

请执行以下流程，结合技术方案和 Figma 设计稿生成带交互逻辑的代码：

1. 调用 get_workspace_config 获取项目配置
2. 调用 get_tech_design(name="$ARGUMENTS") 读取技术方案
   - 如果没有指定名称，调用 list_workspace_files(type="design") 列出所有技术方案让我选择
3. 检查并读取相关文档：
   - API 文档：get_api_spec
   - 交互文档：get_interaction_spec
4. 调用 get_server_status 确认 Figma 插件已连接
5. 调用 get_figma_selection 获取 Figma 节点数据
6. 调用 get_code_rules + get_component_mapping
7. **先向我展示完整实现方案，等我确认**：
   - 组件拆分方案
   - 状态管理设计
   - API 接口对接方案
   - 导航/路由方案
8. 我确认后，生成完整交互代码
9. 使用 save_generated_code 和 save_asset 保存

严格遵守代码生成规则，禁止跳过确认步骤直接生成代码。
