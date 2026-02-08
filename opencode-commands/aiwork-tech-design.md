---
description: 从需求文档生成前端技术方案
---

请执行以下流程，将需求文档转化为前端技术方案：

1. 调用 get_workspace_config 获取项目配置（框架、技术栈等）
2. 调用 get_requirement(name="$ARGUMENTS") 读取需求文档
   - 如果没有指定名称，调用 list_workspace_files(type="requirement") 列出所有需求文档让我选择
3. 检查是否有相关 API 文档（list_workspace_files(type="api")），如有则读取
4. 调用 get_tech_design_rules 获取技术方案模板
5. 基于需求内容、项目配置和模板，生成技术方案
6. **先向我展示技术方案大纲，等我确认后再生成完整内容**
7. 我确认后，使用 save_document(type="design") 保存技术方案
