# 智能简历管理系统

基于 Next.js + AI 的简历管理工具，支持智能提取、岗位匹配、简历诊断等功能。

## 功能特性

- 📄 **智能提取**：上传 PDF/文本简历，AI 自动提取结构化经历
- 🎯 **岗位匹配**：根据职位描述计算经历匹配度
- ✨ **AI 诊断**：分析简历问题并给出改进建议
- 📝 **多简历管理**：为不同岗位创建定制化简历
- 📤 **导出 PDF**：一键导出专业格式简历

## 技术栈

- Next.js 14 + React 18 + TypeScript
- Tailwind CSS
- 阿里云 DashScope (AI)
- pdfjs-dist (PDF 处理)

## 本地开发

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 部署

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Fork 本仓库到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量（可选）
4. 点击 Deploy

## 使用说明

1. 在「个人资料」页填写阿里云 DashScope API Key
2. 在「经历管理」页添加或导入你的经历
3. 在「智能创建」页生成针对特定岗位的简历
4. 导出 PDF 并投递

## API Key 获取

访问 [阿里云 DashScope](https://dashscope.aliyun.com/) 注册并获取 API Key。

## License

MIT
