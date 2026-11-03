# GitHub Actions

本项目只维护 macOS 前端。唯一的 [CI 工作流](workflows/ci.yml) 在 `main` 推送、拉取请求和手动触发时使用 GitHub 托管的 macOS 运行器与 Node 24，检查构建、文档、界面、书桌回放和本机窗口。

工作流保持只读仓库权限，不依赖模型密钥、上游私有运行器或发布凭据。依赖版本从锁文件安装。构建后的测试先等待构建完成；真实模型测试由维护者在本地显式运行。

上游为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。保留原始提交历史、版权和 README 署名；不启用上游的 Dependabot、多平台兼容性矩阵或发布流水线。
