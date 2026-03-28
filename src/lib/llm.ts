'use client';

import * as pdfjs from 'pdfjs-dist';

// 设置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// 提取 PDF 文本
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      text += strings.join(' ') + '\n';
    }

    return text;
  } catch (e) {
    console.error('PDF解析错误:', e);
    throw new Error('PDF 解析失败，请确保文件是有效的 PDF 格式');
  }
}

// 提取文本文件内容
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    return extractTextFromPDF(file);
  }

  // 文本文件
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

export async function callLLM(
  apiKey: string,
  prompt: string,
  systemPrompt: string = '你是一个专业的简历优化助手，帮助用户分析和管理简历相关事务。',
  provider: 'dashscope' | 'gemini' = 'dashscope'
): Promise<string | null> {
  if (!apiKey) {
    alert(`请先在个人资料中填写 ${provider === 'gemini' ? 'Google AI Studio' : '阿里云 DashScope'} API Key`);
    return null;
  }

  console.log(`开始调用LLM API... (Provider: ${provider})`);

  try {
    // 调用本地API代理，绕过跨域限制
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider,
        apiKey,
        prompt,
        systemPrompt
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'API调用失败');
    }

    return data.content || '';
  } catch (e: any) {
    console.error('LLM调用错误:', e);
    alert('API调用失败: ' + (e.message || '未知错误') + '\n\n请按F12查看控制台详细日志');
    return null;
  }
}

// 技能关键词库
export const skillLibrary: Record<string, string[]> = {
  '编程': ['Python', 'Java', 'C++', 'JavaScript', '编程', '代码', '开发', '算法'],
  '数据': ['数据分析', '数据处理', '数据挖掘', '大数据', '数据科学', '统计', 'SPSS', 'Origin'],
  '机器学习': ['机器学习', '深度学习', 'AI', '人工智能', '神经网络', 'TensorFlow', 'PyTorch'],
  '科研': ['研究', '实验', '科研', '论文', '课题', '项目', '创新'],
  '英语': ['英语', 'CET', '雅思', '托福', 'IELTS', 'TOEFL', '口语'],
  '实验': ['实验', '测试', '检测', '分析', '质谱', '色谱', '显微镜'],
  '管理': ['管理', '组织', '领导', '班长', '负责人', '策划', '安排']
};

// 智能匹配技能
export function matchSkills(text: string): string[] {
  let matched: string[] = [];
  Object.keys(skillLibrary).forEach(cat => {
    skillLibrary[cat].forEach(skill => {
      if (text.toLowerCase().includes(skill.toLowerCase())) {
        matched.push(skill);
      }
    });
  });
  return [...new Set(matched)];
}

// 提取关键词
export function extractKeywords(text: string): string[] {
  const stopWords = ['的', '和', '与', '或', '在', '为', '有', '等', '进行', '负责', '工作', '岗位', '要求', '优先', '熟悉', '了解', '掌握', '具备', '能力', '经验', '以上', '以下'];
  const words = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w));
  return [...new Set(words)];
}

// 计算匹配度
export function calculateMatchScore(exp: { title: string; desc: string; tags: string[]; time?: string }, keywords: string[]): number {
  let score = 0;
  const text = (exp.title + ' ' + exp.desc + ' ' + (exp.tags || []).join(' ')).toLowerCase();

  keywords.forEach(kw => {
    if (text.includes(kw.toLowerCase())) score += 20;
  });

  const expSkills = matchSkills(text);
  score += expSkills.length * 10;

  if (exp.time && exp.time.includes('2024')) score += 10;
  if (exp.time && exp.time.includes('2025')) score += 15;
  if (exp.time && exp.time.includes('2026')) score += 20;

  return Math.min(score, 100);
}

// ===== 智能简历功能 Prompts =====

// 1. 提取经历信息 Prompt
export const prompts = {
  // 提取简历经历
  extractResume: `你是一个专业的简历分析助手。请从用户提供的简历文本中提取经历信息。

请严格按照以下JSON格式返回，不要有任何其他内容：
[
  {
    "type": "education/research/award/work/other",
    "title": "经历标题",
    "time": "时间，如2020.09-2024.06",
    "role": "角色/职位",
    "desc": "详细描述",
    "tags": ["技能标签1", "技能标签2"]
  }
]

注意事项：
- type 必须是以下之一：education(教育背景)、research(科研经历)、award(荣誉奖项)、work(学生工作)、other(其他)
- 如果无法确定类型，使用 "other"
- tags 提取关键技能关键词
- 只返回JSON数组，不要有其他文字`,

  // 生成简历
  generateResume: `你是一个专业的简历撰写专家。请根据用户提供的经历信息，生成一份专业的HTML格式简历。

要求：
1. 格式美观，专业大方
2. 针对目标岗位突出相关经历
3. 描述要简洁有力，使用动词开头
4. 量化成果（如：提升了30%效率）

请严格按照以下HTML格式返回，不要有任何其他内容：
<h1>姓名</h1>
<div class="info"><span>出生: xxx</span><span>邮箱: xxx</span>...</div>
<h2>教育背景</h2>
<div class="item">
  <div class="item-header"><span class="item-title">标题</span><span class="item-time">时间</span></div>
  <div class="item-role">角色/职位</div>
  <ul><li>描述1</li><li>描述2</li></ul>
</div>
...

返回纯HTML，不要有markdown格式代码块。`,

  // 简历诊断（给建议）
  diagnoseResume: `你是一个专业的简历诊断专家。请分析用户提供的简历内容，找出问题和改进建议。

请严格按照以下JSON格式返回：
{
  "overall": "总体评价（优缺点总结）",
  "issues": [
    {
      "type": "问题类型",
      "description": "具体问题描述",
      "suggestion": "修改建议"
    }
  ],
  "highlights": ["亮点1", "亮点2"],
  "scores": {
    "content": "内容评分0-100",
    "format": "格式评分0-100",
    "relevance": "针对性评分0-100",
    "overall": "综合评分0-100"
  }
}

问题类型包括：内容空洞、重点不突出、格式问题、针对性不强、描述不当、缺少量化等。只返回JSON，不要有其他文字。`,

  // 简历改写
  rewriteResume: `你是一个专业的简历优化专家。请根据以下诊断建议，改写用户的简历内容，使其更具吸引力和专业性。

请严格按照以下JSON格式返回：
{
  "personalInfo": {
    "name": "姓名（如无则保留原样）",
    "其他字段": "优化后的内容"
  },
  "sections": [
    {
      "type": "education/research/award/work/other",
      "items": [
        {
          "title": "优化后的标题",
          "time": "时间",
          "role": "优化后的角色",
          "desc": "优化后的描述（使用STAR法则，更具体、更有说服力）",
          "tags": ["技能标签"]
        }
      ]
    }
  ],
  "summary": "个人总结（可选）"
}

注意：
- 描述要具体、量化成果
- 使用强动词开头
- 突出与目标岗位相关的经历
- 只返回JSON，不要有其他文字`,

  // 岗位分析
  analyzeJob: `你是一个专业的HR和职业顾问。请深度分析以下岗位描述，提取关键信息和技能要求。

请严格按照以下JSON格式返回：
{
  "title": "岗位名称",
  "keywords": ["关键词1", "关键词2"],
  "requiredSkills": ["必备技能1", "必备技能2"],
  "preferredSkills": ["加分技能1", "加分技能2"],
  "experience": "经验要求总结",
  "education": "学历要求总结",
  "coreRequirements": ["核心要求1", "核心要求2"],
  "responsibilities": ["职责1", "职责2"],
  "analysis": "综合分析（岗位匹配度、建议）"
}

请详细分析，只返回JSON，不要有其他文字。`
};