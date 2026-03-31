# 智能简历管理系统 - 项目文档

## 项目概览
- **项目名称**: 智能简历管理系统
- **技术栈**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **AI服务**: 阿里云 DashScope (kimi-k2.5模型) / Google AI Studio (Gemini)
- **仓库**: https://github.com/jczhang1105/resume-manager
- **设计系统**: Atheneum (Stitch AI 生成)

## 关键配置

### API 配置
- **端点**: `https://coding.dashscope.aliyuncs.com/v1/chat/completions`
- **模型**: `kimi-k2.5`
- **文件位置**: `src/app/api/llm/route.ts`

### 双AI提供商支持
- 阿里云 DashScope (默认)
- Google AI Studio (Gemini)
- 切换位置: 个人资料页

### 部署状态
- **GitHub仓库**: https://github.com/jczhang1105/resume-manager
- **Vercel自动部署**: 已配置，push到main分支自动触发
- **访问地址**: 通过Vercel部署后可访问

## 项目结构
- `src/app/page.tsx` - 主应用组件（桌面端侧边栏布局）
- `src/app/api/llm/route.ts` - LLM API代理路由（支持双提供商）
- `src/lib/llm.ts` - 客户端LLM工具函数
- `src/lib/storage.ts` - localStorage数据持久化
- `ui/` - Stitch AI 生成的设计文件
- `docs/` - 项目文档
- `next.config.js` - Next.js配置（静态导出选项已注释）

## 设计系统

### Atheneum 主题
- **主色**: #0058be (专业蓝)
- **字体**: Manrope (标题) + Inter (正文) + 中文回退
- **布局**: 左侧边栏 + 顶部导航
- **风格**: Material Design 3

### 页面结构
1. 控制台首页 - 统计卡片、活动时间线、AI洞察
2. 经历管理 - 卡片列表、分类筛选、侧边统计
3. AI简历分析 - 三步流程、匹配度分析
4. 个人资料 - 双AI提供商配置
5. 我的简历 - 卡片网格管理

## 功能特性
1. 智能提取 - 上传PDF/文本简历，AI自动提取结构化经历
2. 岗位匹配 - 根据职位描述计算经历匹配度
3. AI诊断 - 分析简历问题并给出改进建议
4. 多简历管理 - 为不同岗位创建定制化简历
5. 导出PDF - 一键导出专业格式简历
6. 双AI支持 - 阿里云/Google AI Studio 切换

## 开发命令
```bash
npm install
npm run dev
npm run build    # 本地构建测试
```

## 更新工作流
```bash
git add .
git commit -m "描述修改"
git push origin main
```
等待1-2分钟Vercel自动部署完成

## 相关文档
- [Stitch AI 设计集成详情](./stitch-integration.md) - Atheneum 设计系统整合过程

---
最后更新: 2026-03-31
