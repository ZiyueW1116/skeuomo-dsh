# GitHub Actions

本项目只维护 macOS 前端。唯一的 [CI 工作流](workflows/ci.yml) 在 `main` 推送、拉取请求和手动触发时使用 GitHub 托管的 macOS 运行器与 Node 24，检查构建、文档、界面、书桌回放和本机窗口。

工作流保持只读仓库权限，不依赖模型密钥、上游私有运行器或发布凭据。依赖版本从锁文件安装。构建后的测试先等待构建完成；真实模型测试由维护者在本地显式运行。

文档归档校验使用 GitHub 提供的拉取请求目标提交或推送前提交作为基线；首次推送与手动运行使用当前提交。保留完整 checkout 历史，确保校验能读取基线。

标准 macOS ARM 运行器只有 7 GB 内存。文档检查逐项运行，并将 Node 堆上限设为 4 GB，避免文档图超过默认 2 GB 堆上限，或多个生成器争用内存拖慢 CLI 帮助校验。

上游为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。保留原始提交历史、版权和 README 署名；不启用上游的 Dependabot、多平台兼容性矩阵或发布流水线。
