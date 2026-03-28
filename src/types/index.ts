export interface Profile {
  name?: string;
  birth?: string;
  nation?: string;
  political?: string;
  origin?: string;
  email?: string;
  phone?: string;
  apiKey?: string;           // 阿里云 DashScope API Key
  geminiApiKey?: string;      // Google AI Studio API Key
  aiProvider?: 'dashscope' | 'gemini';  // 选择的 AI 提供商
  targetJobs: string[];
}

export interface Experience {
  id: number;
  type: 'education' | 'research' | 'award' | 'work' | 'other';
  title: string;
  time: string;
  role: string;
  desc: string;
  tags: string[];
}

export interface Resume {
  id: number;
  title: string;
  job: string;
  content: string;
  date: string;
  match: number;
  type: 'high' | 'normal';
}

export interface JobAnalysis {
  keywords: string[];
  skills: string[];
  matchedSkills: string[];
  missingSkills: string[];
}