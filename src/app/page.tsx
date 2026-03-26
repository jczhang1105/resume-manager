'use client';

import { useState, useEffect, useRef } from 'react';
import { Profile, Experience, Resume, JobAnalysis } from '@/types';
import { loadProfile, saveProfile, loadExperiences, saveExperiences, loadResumes, saveResumes } from '@/lib/storage';
import { callLLM, matchSkills, extractKeywords, calculateMatchScore, extractTextFromFile, prompts } from '@/lib/llm';
import { LayoutDashboard, User, Briefcase, Sparkles, FileText, Sparkle, Trash2, Edit, Download, X, Check, Upload, Wand2, FileUp, Lightbulb, RefreshCw } from 'lucide-react';

// 类型名称映射
const typeNames: Record<string, string> = {
  education: '教育背景',
  research: '科研经历',
  award: '荣誉奖项',
  work: '学生工作',
  other: '其他'
};

type TabType = 'dashboard' | 'profile' | 'experience' | 'create' | 'resumes';

export default function ResumeManager() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [profile, setProfile] = useState<Profile>({ targetJobs: [] });
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [expFilter, setExpFilter] = useState<string>('all');
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis>({ keywords: [], skills: [], matchedSkills: [], missingSkills: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '', birth: '', nation: '', political: '', origin: '', email: '', phone: '', apiKey: '', targetJobs: ''
  });
  const [expForm, setExpForm] = useState({
    type: 'education', title: '', time: '', role: '', tags: '', desc: ''
  });
  const [importText, setImportText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [targetJob, setTargetJob] = useState('');
  const [resumeTitle, setResumeTitle] = useState('');

  // 新增状态
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [rewriteResult, setRewriteResult] = useState<any>(null);
  const [aiJobAnalysis, setAiJobAnalysis] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = loadProfile();
    const e = loadExperiences();
    const r = loadResumes();
    setProfile(p);
    setExperiences(e);
    setResumes(r);
    setFormData({
      name: p.name || '',
      birth: p.birth || '',
      nation: p.nation || '',
      political: p.political || '',
      origin: p.origin || '',
      email: p.email || '',
      phone: p.phone || '',
      apiKey: p.apiKey || '',
      targetJobs: (p.targetJobs || []).join(', ')
    });
  }, []);

  // 保存资料
  const handleSaveProfile = () => {
    const newProfile: Profile = {
      name: formData.name,
      birth: formData.birth,
      nation: formData.nation,
      political: formData.political,
      origin: formData.origin,
      email: formData.email,
      phone: formData.phone,
      apiKey: formData.apiKey,
      targetJobs: formData.targetJobs.split(',').map(s => s.trim()).filter(s => s)
    };
    setProfile(newProfile);
    saveProfile(newProfile);
    alert('保存成功！');
  };

  // 添加经历
  const handleAddExperience = () => {
    if (!expForm.title.trim()) { alert('请输入标题'); return; }
    const autoTags = matchSkills(expForm.desc + ' ' + expForm.title);
    const manualTags = expForm.tags.split(',').map(t => t.trim()).filter(t => t);
    const allTags = [...new Set([...autoTags, ...manualTags])];

    const exp: Experience = {
      id: Date.now(),
      type: expForm.type as Experience['type'],
      title: expForm.title,
      time: expForm.time,
      role: expForm.role,
      desc: expForm.desc,
      tags: allTags
    };

    const newExps = [...experiences, exp];
    setExperiences(newExps);
    saveExperiences(newExps);
    setExpForm({ type: 'education', title: '', time: '', role: '', tags: '', desc: '' });
    alert('添加成功！自动识别技能标签: ' + allTags.join(', '));
  };

  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formData.apiKey) {
      alert('请先在个人资料中填写API Key');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 检查文件类型
    const validTypes = ['.txt', '.pdf', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) {
      alert('仅支持 .txt, .pdf, .md 格式文件');
      return;
    }

    // 检查文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('文件大小不能超过 5MB');
      return;
    }

    setUploadedFile(file);
    setIsExtracting(true);

    try {
      // 提取文件内容
      const text = await extractTextFromFile(file);
      setImportText(text);
      alert(`文件 "${file.name}" 解析成功！内容已填入文本框，请检查后点击"AI智能提取"按钮。`);
    } catch (err: any) {
      alert('文件解析失败: ' + err.message);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // LLM智能导入（支持文本和文件）
  const handleLLMImport = async () => {
    if (!importText.trim()) { alert('请粘贴简历文本或上传文件'); return; }
    if (!formData.apiKey) { alert('请先在个人资料中填写API Key'); return; }

    setIsLoading(true);

    const result = await callLLM(formData.apiKey, importText, prompts.extractResume);

    setIsLoading(false);

    if (!result) return;

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```/g, '');
      }

      const extracted = JSON.parse(jsonStr);
      const typeMap: Record<string, string> = { '教育背景': 'education', '科研经历': 'research', '荣誉奖项': 'award', '学生工作': 'work', '其他': 'other' };

      const newExps: Experience[] = extracted.map((exp: any, idx: number) => ({
        id: Date.now() + idx,
        type: typeMap[exp.type] || exp.type || 'other',
        title: exp.title || '',
        time: exp.time || '',
        role: exp.role || '',
        desc: exp.desc || '',
        tags: Array.isArray(exp.tags) ? exp.tags : []
      }));

      const allExps = [...experiences, ...newExps];
      setExperiences(allExps);
      saveExperiences(allExps);
      setImportText('');
      setUploadedFile(null);
      alert(`✨ AI成功导入 ${newExps.length} 条经历！`);
    } catch (e) {
      console.error('解析错误:', e);
      alert('AI返回格式解析失败');
    }
  };

  // 分析岗位
  const handleAnalyzeJob = () => {
    let keywords: string[] = [];
    if (jobDesc) {
      keywords = extractKeywords(jobDesc);
    }
    if (targetJob) {
      keywords = [...keywords, ...targetJob.toLowerCase().split(/[,，]/).filter(s => s.trim())];
    }

    const allKeywords = [...new Set(keywords)];
    setJobAnalysis({ keywords: allKeywords, skills: [], matchedSkills: [], missingSkills: [] });
  };

  // 生成简历（规则）
  const handleGenerateResume = () => {
    const selectedIds = Array.from(document.querySelectorAll('.exp-select:checked')).map(cb => parseInt((cb as HTMLInputElement).value));
    const selectedExps = experiences.filter(e => selectedIds.includes(e.id));

    if (selectedExps.length === 0) { alert('请选择经历'); return; }

    let content = '<h1>' + (formData.name || '姓名') + '</h1>';
    content += '<div class="info">';
    if (formData.birth) content += '<span>出生: ' + formData.birth + '</span>';
    if (formData.nation) content += '<span>民族: ' + formData.nation + '</span>';
    if (formData.political) content += '<span>政治面貌: ' + formData.political + '</span>';
    if (formData.origin) content += '<span>籍贯: ' + formData.origin + '</span>';
    if (formData.email) content += '<span>邮箱: ' + formData.email + '</span>';
    if (formData.phone) content += '<span>电话: ' + formData.phone + '</span>';
    content += '</div>';

    ['education', 'research', 'work', 'award', 'other'].forEach(type => {
      const exps = selectedExps.filter(e => e.type === type);
      if (exps.length > 0) {
        content += '<h2>' + typeNames[type] + '</h2>';
        exps.forEach(exp => {
          content += '<div class="item"><div class="item-header"><span class="item-title">' + exp.title + '</span><span class="item-time">' + (exp.time || '') + '</span></div>';
          if (exp.role) content += '<div class="item-role">' + exp.role + '</div>';
          if (exp.desc) {
            const lines = exp.desc.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
              content += '<ul>';
              lines.forEach(line => content += '<li>' + line.trim() + '</li>');
              content += '</ul>';
            }
          }
          content += '</div>';
        });
      }
    });

    const matchScore = selectedExps.reduce((s, e) => s + calculateMatchScore(e, jobAnalysis.keywords), 0) / Math.max(selectedExps.length, 1);

    const resume: Resume = {
      id: Date.now(),
      title: resumeTitle || '我的简历',
      job: targetJob,
      content,
      date: new Date().toLocaleDateString(),
      match: Math.round(matchScore),
      type: matchScore >= 70 ? 'high' : 'normal'
    };

    const newResumes = [resume, ...resumes];
    setResumes(newResumes);
    saveResumes(newResumes);
    setPreviewResume(resume);
  };

  // LLM生成简历（优化版）
  const handleLLMGenerate = async () => {
    if (!formData.apiKey) { alert('请先填写API Key'); return; }

    const selectedIds = Array.from(document.querySelectorAll('.exp-select:checked')).map(cb => parseInt((cb as HTMLInputElement).value));
    const selectedExps = experiences.filter(e => selectedIds.includes(e.id));

    if (selectedExps.length === 0) { alert('请选择经历'); return; }

    setIsLoading(true);

    const userInfo = {
      name: formData.name || '姓名',
      birth: formData.birth || '',
      nation: formData.nation || '',
      political: formData.political || '',
      origin: formData.origin || '',
      email: formData.email || '',
      phone: formData.phone || ''
    };

    const expText = selectedExps.map(exp => {
      return `【${typeNames[exp.type]}】${exp.title}\n时间: ${exp.time || '无'}\n角色: ${exp.role || '无'}\n描述: ${exp.desc || '无'}\n技能: ${exp.tags.join(', ')}`;
    }).join('\n\n');

    const prompt = `基本信息：姓名: ${userInfo.name}，出生: ${userInfo.birth}，民族: ${userInfo.nation}，政治面貌: ${userInfo.political}，籍贯: ${userInfo.origin}，邮箱: ${userInfo.email}，电话: ${userInfo.phone}

目标岗位: ${targetJob || '通用'}
${jobDesc ? '岗位JD:\n' + jobDesc : ''}

个人经历：
${expText}`;

    const result = await callLLM(formData.apiKey, prompt, prompts.generateResume);

    setIsLoading(false);

    if (!result) return;

    try {
      let html = result.trim();
      if (html.includes('```html')) {
        html = html.replace(/```html/g, '').replace(/```/g, '');
      } else if (html.startsWith('```')) {
        html = html.replace(/```/g, '');
      }

      const matchScore = selectedExps.reduce((s, e) => s + calculateMatchScore(e, jobAnalysis.keywords), 0) / Math.max(selectedExps.length, 1);

      const resume: Resume = {
        id: Date.now(),
        title: resumeTitle || '我的简历',
        job: targetJob,
        content: html,
        date: new Date().toLocaleDateString(),
        match: Math.round(matchScore),
        type: matchScore >= 70 ? 'high' : 'normal'
      };

      const newResumes = [resume, ...resumes];
      setResumes(newResumes);
      saveResumes(newResumes);
      setPreviewResume(resume);
    } catch (e) {
      console.error('生成错误:', e);
      alert('AI生成失败');
    }
  };

  // 简历诊断（给建议）
  const handleDiagnoseResume = async () => {
    if (!formData.apiKey) { alert('请先填写API Key'); return; }
    if (experiences.length === 0) { alert('请先添加经历'); return; }

    setIsLoading(true);
    setDiagnoseResult(null);

    const resumeContent = experiences.map(exp => {
      return `${typeNames[exp.type]}: ${exp.title}\n时间: ${exp.time}\n角色: ${exp.role}\n描述: ${exp.desc}\n技能: ${exp.tags.join(', ')}`;
    }).join('\n\n');

    const result = await callLLM(formData.apiKey, resumeContent, prompts.diagnoseResume);

    setIsLoading(false);

    if (!result) return;

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonStr);
      setDiagnoseResult(parsed);
    } catch (e) {
      console.error('诊断解析错误:', e);
      alert('诊断结果解析失败');
    }
  };

  // 简历改写（自动改写）
  const handleRewriteResume = async () => {
    if (!formData.apiKey) { alert('请先填写API Key'); return; }
    if (experiences.length === 0) { alert('请先添加经历'); return; }

    setIsLoading(true);
    setRewriteResult(null);

    const resumeContent = experiences.map(exp => {
      return `${typeNames[exp.type]}: ${exp.title}\n时间: ${exp.time}\n角色: ${exp.role}\n描述: ${exp.desc}\n技能: ${exp.tags.join(', ')}`;
    }).join('\n\n');

    const prompt = `目标岗位: ${targetJob || '通用'}\n简历内容:\n${resumeContent}`;

    const result = await callLLM(formData.apiKey, prompt, prompts.rewriteResume);

    setIsLoading(false);

    if (!result) return;

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonStr);
      setRewriteResult(parsed);
    } catch (e) {
      console.error('改写解析错误:', e);
      alert('改写结果解析失败');
    }
  };

  // 应用改写结果
  const applyRewrite = () => {
    if (!rewriteResult || !rewriteResult.sections) return;

    const typeMap: Record<string, Experience['type']> = { '教育背景': 'education', '科研经历': 'research', '荣誉奖项': 'award', '学生工作': 'work', '其他': 'other' };

    const newExps: Experience[] = [];
    rewriteResult.sections.forEach((section: any) => {
      const type: Experience['type'] = typeMap[section.type] || 'other';
      section.items?.forEach((item: any, idx: number) => {
        newExps.push({
          id: Date.now() + newExps.length,
          type,
          title: item.title || '',
          time: item.time || '',
          role: item.role || '',
          desc: item.desc || '',
          tags: Array.isArray(item.tags) ? item.tags : []
        });
      });
    });

    if (newExps.length > 0) {
      const allExps = [...experiences, ...newExps];
      setExperiences(allExps);
      saveExperiences(allExps);
      setRewriteResult(null);
      alert(`已应用 ${newExps.length} 条优化后的经历！`);
    }
  };

  // AI 岗位分析
  const handleAIAnalyzeJob = async () => {
    if (!formData.apiKey) { alert('请先填写API Key'); return; }
    if (!jobDesc.trim()) { alert('请输入岗位描述'); return; }

    setIsLoading(true);
    setAiJobAnalysis(null);

    const result = await callLLM(formData.apiKey, jobDesc, prompts.analyzeJob);

    setIsLoading(false);

    if (!result) return;

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonStr);
      setAiJobAnalysis(parsed);

      // 同时更新关键词
      if (parsed.keywords) {
        setJobAnalysis(prev => ({ ...prev, keywords: parsed.keywords, skills: parsed.requiredSkills || [] }));
      }
    } catch (e) {
      console.error('岗位分析解析错误:', e);
      alert('岗位分析结果解析失败');
    }
  };

  // 删除经历
  const handleDeleteExp = (id: number) => {
    if (!confirm('确定删除？')) return;
    const newExps = experiences.filter(e => e.id !== id);
    setExperiences(newExps);
    saveExperiences(newExps);
  };

  // 删除简历
  const handleDeleteResume = (id: number) => {
    if (!confirm('确定删除？')) return;
    const newResumes = resumes.filter(r => r.id !== id);
    setResumes(newResumes);
    saveResumes(newResumes);
  };

  // 过滤后的经历
  const filteredExp = expFilter === 'all' ? experiences : experiences.filter(e => e.type === expFilter);

  // 计算匹配分
  const getScoredExps = () => {
    return experiences.map(exp => ({
      ...exp,
      score: calculateMatchScore(exp, jobAnalysis.keywords)
    })).sort((a, b) => b.score - a.score);
  };

  // 计算统计数据
  const stats = {
    totalExp: experiences.length,
    research: experiences.filter(e => e.type === 'research').length,
    awards: experiences.filter(e => e.type === 'award').length,
    resumes: resumes.length
  };

  // 所有标签
  const allTags = experiences.flatMap(e => e.tags || []);
  const tagCounts: Record<string, number> = {};
  allTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const scoredExps = getScoredExps();
  const avgScore = scoredExps.length ? Math.round(scoredExps.reduce((a, b) => a + b.score, 0) / scoredExps.length) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Sparkle className="w-5 h-5 text-blue-500" />
              智能简历管理系统
            </h1>
            <div className="flex gap-2 sm:gap-4">
              {[
                { id: 'dashboard', label: '概览', icon: LayoutDashboard },
                { id: 'profile', label: '个人资料', icon: User },
                { id: 'experience', label: '经历管理', icon: Briefcase },
                { id: 'create', label: '智能生成', icon: Sparkles },
                { id: 'resumes', label: '我的简历', icon: FileText },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-500 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 概览页面 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* AI分析面板 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📊 智能分析概览
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/15 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold">{stats.totalExp}</div>
                  <div className="text-sm opacity-80">总经历数</div>
                </div>
                <div className="bg-white/15 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold">{stats.research}</div>
                  <div className="text-sm opacity-80">科研项目</div>
                </div>
                <div className="bg-white/15 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold">{stats.awards}</div>
                  <div className="text-sm opacity-80">荣誉奖项</div>
                </div>
                <div className="bg-white/15 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold">{stats.resumes}</div>
                  <div className="text-sm opacity-80">已生成简历</div>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="text-sm mb-2">🏅 技能标签分布</h4>
                <div className="flex flex-wrap gap-2">
                  {sortedTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-white/20 rounded-full text-sm cursor-pointer hover:bg-white/30 transition-colors"
                      style={{ fontSize: `${12 + Math.min(count * 2, 8)}px` }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 智能建议 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">💡 智能建议</h3>
                <div className="space-y-3">
                  {stats.research < 2 && (
                    <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                      <h4 className="font-medium">增加科研经历</h4>
                      <p className="text-sm text-gray-600 mt-1">建议添加1-2段科研项目经验，提升申请竞争力</p>
                    </div>
                  )}
                  {experiences.length < 5 && (
                    <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                      <h4 className="font-medium">丰富经历内容</h4>
                      <p className="text-sm text-gray-600 mt-1">建议补充学生工作或奖项，提升简历丰富度</p>
                    </div>
                  )}
                  {sortedTags.length < 5 && (
                    <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                      <h4 className="font-medium">完善技能标签</h4>
                      <p className="text-sm text-gray-600 mt-1">为经历添加更多技能标签，有助于智能匹配</p>
                    </div>
                  )}
                  {sortedTags.length >= 5 && stats.research >= 2 && experiences.length >= 5 && (
                    <div className="text-gray-500 text-center py-4">各项指标良好！</div>
                  )}
                </div>
              </div>

              {/* 岗位推荐 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">🎯 适合岗位推荐</h3>
                <div className="space-y-3">
                  {sortedTags.some(([t]) => t.includes('Python') || t.includes('机器学习')) && (
                    <div className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => { setTargetJob('算法工程师'); setActiveTab('create'); }}>
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">算法工程师</h4>
                        <span className="text-green-600 font-medium">90%</span>
                      </div>
                    </div>
                  )}
                  {sortedTags.some(([t]) => t.includes('Java') || t.includes('开发')) && (
                    <div className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => { setTargetJob('Java开发工程师'); setActiveTab('create'); }}>
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Java开发工程师</h4>
                        <span className="text-green-600 font-medium">85%</span>
                      </div>
                    </div>
                  )}
                  {sortedTags.some(([t]) => t.includes('数据分析') || t.includes('统计')) && (
                    <div className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => { setTargetJob('数据分析师'); setActiveTab('create'); }}>
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">数据分析师</h4>
                        <span className="text-green-600 font-medium">80%</span>
                      </div>
                    </div>
                  )}
                  {sortedTags.length === 0 && (
                    <div className="text-gray-500 text-center py-4">添加经历后自动推荐</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 个人资料页面 */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6">基本信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出生年月</label>
                <input
                  type="text"
                  value={formData.birth}
                  onChange={e => setFormData({ ...formData, birth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如: 2001.11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">民族</label>
                <input
                  type="text"
                  value={formData.nation}
                  onChange={e => setFormData({ ...formData, nation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如: 汉族"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">政治面貌</label>
                <input
                  type="text"
                  value={formData.political}
                  onChange={e => setFormData({ ...formData, political: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如: 共青团员"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">籍贯</label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={e => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如: 福建省龙岩市"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="手机号"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标岗位</label>
                <input
                  type="text"
                  value={formData.targetJobs}
                  onChange={e => setFormData({ ...formData, targetJobs: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如: Java开发工程师, 算法工程师"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">阿里云 DashScope API Key</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-xxxxxx 在阿里云控制台获取"
                />
                <p className="text-xs text-gray-500 mt-1">用于调用通义千问模型，使功能更智能</p>
              </div>
            </div>
            <button
              onClick={handleSaveProfile}
              className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              保存资料
            </button>
          </div>
        )}

        {/* 经历管理页面 */}
        {activeTab === 'experience' && (
          <div className="space-y-6">
            {/* 添加经历 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">添加新经历</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                  <select
                    value={expForm.type}
                    onChange={e => setExpForm({ ...expForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="education">教育背景</option>
                    <option value="research">科研经历</option>
                    <option value="award">荣誉奖项</option>
                    <option value="work">学生工作</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                  <input
                    type="text"
                    value={expForm.title}
                    onChange={e => setExpForm({ ...expForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如: 西北农林科技大学-环境科学"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时间</label>
                  <input
                    type="text"
                    value={expForm.time}
                    onChange={e => setExpForm({ ...expForm, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如: 2020.09 - 2024.06"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色/职位</label>
                  <input
                    type="text"
                    value={expForm.role}
                    onChange={e => setExpForm({ ...expForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如: 项目负责人"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">技能标签</label>
                  <input
                    type="text"
                    value={expForm.tags}
                    onChange={e => setExpForm({ ...expForm, tags: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如: Python, 数据分析"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">详细描述</label>
                  <textarea
                    value={expForm.desc}
                    onChange={e => setExpForm({ ...expForm, desc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="输入详细内容"
                  />
                </div>
              </div>
              <button
                onClick={handleAddExperience}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                添加经历
              </button>
            </div>

            {/* 智能导入 */}
            <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2">🤖 智能导入经历</h2>
              <p className="text-sm text-gray-600 mb-4">上传简历文件或粘贴文本，系统自动提取经历</p>

              {/* 文件上传区域 */}
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`inline-flex items-center gap-2 px-4 py-2 border border-blue-300 rounded-md cursor-pointer hover:bg-blue-100 transition-colors ${
                    isExtracting ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  <FileUp className="w-4 h-4" />
                  {isExtracting ? '正在解析文件...' : uploadedFile ? uploadedFile.name : '上传简历文件 (.txt, .pdf, .md)'}
                </label>
                {uploadedFile && (
                  <button
                    onClick={() => { setUploadedFile(null); setImportText(''); }}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows={6}
                placeholder="或者粘贴简历文本..."
              />
              <div className="flex gap-3">
                <button
                  onClick={handleLLMImport}
                  disabled={isLoading || isExtracting}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '🤖 AI分析中...' : isExtracting ? '📄 解析中...' : '✨ AI智能提取'}
                </button>
              </div>
            </div>

            {/* 经历列表 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">已添加的经历</h2>
              <div className="flex gap-2 mb-4 flex-wrap">
                {['all', 'education', 'research', 'award', 'work'].map(type => (
                  <button
                    key={type}
                    onClick={() => setExpFilter(type)}
                    className={`px-4 py-1.5 rounded-md text-sm ${
                      expFilter === type
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'all' ? '全部' : typeNames[type]}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">类型</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">标题</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">时间</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">技能标签</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExp.map(exp => (
                      <tr key={exp.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">{typeNames[exp.type]}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{exp.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exp.time || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {exp.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteExp(exp.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredExp.length === 0 && (
                  <div className="text-center py-8 text-gray-500">暂无经历</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 智能生成页面 */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 输入岗位 + 简历优化 */}
              <div className="space-y-4">
                {/* 简历诊断与优化 */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 text-white">
                  <h2 className="text-lg font-semibold mb-4">💡 简历诊断与优化</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDiagnoseResume}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                    >
                      <Lightbulb className="w-5 h-5" />
                      <span>AI诊断</span>
                    </button>
                    <button
                      onClick={handleRewriteResume}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                    >
                      <Wand2 className="w-5 h-5" />
                      <span>AI改写</span>
                    </button>
                  </div>
                </div>

                {/* 诊断结果展示 */}
                {diagnoseResult && (
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold">📊 诊断结果</h2>
                      <button onClick={() => setDiagnoseResult(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* 评分 */}
                    {diagnoseResult.scores && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {Object.entries(diagnoseResult.scores).map(([key, value]: [string, any]) => (
                          <div key={key} className="text-center p-2 bg-gray-50 rounded">
                            <div className="text-2xl font-bold text-blue-600">{value}</div>
                            <div className="text-xs text-gray-500">{key === 'content' ? '内容' : key === 'format' ? '格式' : key === 'relevance' ? '针对性' : '综合'}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {diagnoseResult.overall && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm">{diagnoseResult.overall}</p>
                      </div>
                    )}

                    {diagnoseResult.issues && diagnoseResult.issues.length > 0 && (
                      <div className="space-y-2">
                        {diagnoseResult.issues.map((issue: any, idx: number) => (
                          <div key={idx} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                            <div className="font-medium text-sm">{issue.type}</div>
                            <div className="text-sm text-gray-600">{issue.description}</div>
                            <div className="text-sm text-green-600 mt-1">💡 {issue.suggestion}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 改写结果展示 */}
                {rewriteResult && (
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold">✨ AI改写结果</h2>
                      <div className="flex gap-2">
                        <button onClick={applyRewrite} className="px-3 py-1 bg-green-500 text-white rounded text-sm">
                          应用改写
                        </button>
                        <button onClick={() => setRewriteResult(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {rewriteResult.sections?.map((section: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium text-sm mb-2">{typeNames[section.type] || section.type}</div>
                          {section.items?.map((item: any, i: number) => (
                            <div key={i} className="mb-2 pb-2 border-b last:border-0">
                              <div className="font-medium">{item.title}</div>
                              {item.role && <div className="text-sm text-gray-600">{item.role}</div>}
                              {item.desc && <div className="text-sm text-gray-500 mt-1">{item.desc}</div>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 输入岗位 */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">🎯 输入目标岗位</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">目标岗位JD</label>
                      <textarea
                        value={jobDesc}
                        onChange={e => setJobDesc(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        placeholder="粘贴岗位描述..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">或输入岗位名称</label>
                      <input
                        type="text"
                        value={targetJob}
                        onChange={e => setTargetJob(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="如: 算法工程师"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAnalyzeJob}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        🔍 智能分析岗位
                      </button>
                      <button
                        onClick={handleAIAnalyzeJob}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? '🤖 AI分析中...' : '🤖 AI深度分析'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI JD分析结果 */}
                {aiJobAnalysis && (
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold">📋 AI深度分析</h2>
                      <button onClick={() => setAiJobAnalysis(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {aiJobAnalysis.requiredSkills && (
                        <div>
                          <div className="text-sm font-medium mb-1">必备技能：</div>
                          <div className="flex flex-wrap gap-1">
                            {aiJobAnalysis.requiredSkills.map((s: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-xs">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiJobAnalysis.preferredSkills && (
                        <div>
                          <div className="text-sm font-medium mb-1">加分技能：</div>
                          <div className="flex flex-wrap gap-1">
                            {aiJobAnalysis.preferredSkills.map((s: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-600 rounded text-xs">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiJobAnalysis.coreRequirements && (
                        <div>
                          <div className="text-sm font-medium mb-1">核心要求：</div>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {aiJobAnalysis.coreRequirements.map((r: string, i: number) => (
                              <li key={i}>• {r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiJobAnalysis.analysis && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm font-medium mb-1">综合分析：</div>
                          <p className="text-sm text-gray-600">{aiJobAnalysis.analysis}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 简单JD分析结果 */}
                {jobAnalysis.keywords.length > 0 && !aiJobAnalysis && (
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">📋 JD智能分析</h2>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="mb-2">
                        <span className="text-sm font-medium">关键词：</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {jobAnalysis.keywords.slice(0, 10).map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-600 rounded text-xs">{kw}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 智能匹配 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-2">⚡ 智能匹配排序</h2>
                <p className="text-sm text-gray-500 mb-4">系统根据岗位需求自动排序</p>

                {/* 匹配度进度条 */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                      style={{ width: `${avgScore}%` }}
                    />
                  </div>
                  <div className="text-center mt-2">
                    匹配度: <span className="font-bold text-green-600">{avgScore}%</span>
                  </div>
                </div>

                {/* 经历列表 */}
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {scoredExps.map((exp, i) => (
                    <div key={exp.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="exp-select w-4 h-4"
                        defaultChecked={exp.type === 'education' || exp.score >= 40}
                        value={exp.id}
                      />
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-medium ${i < 3 ? 'bg-yellow-500' : 'bg-blue-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{exp.title}</div>
                        <div className="text-xs text-gray-500">{typeNames[exp.type]} · {exp.score >= 60 ? '高度匹配' : exp.score >= 30 ? '相关' : '基础'}</div>
                      </div>
                      <div className="text-green-600 font-medium text-sm">{exp.score}分</div>
                    </div>
                  ))}
                  {scoredExps.length === 0 && (
                    <div className="text-center py-8 text-gray-500">请先添加经历</div>
                  )}
                </div>
              </div>
            </div>

            {/* 生成简历 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">📝 生成简历</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">简历标题</label>
                  <input
                    type="text"
                    value={resumeTitle}
                    onChange={e => setResumeTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如: 求职XX公司算法工程师"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateResume}
                  className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  🚀 一键智能生成（规则）
                </button>
                <button
                  onClick={handleLLMGenerate}
                  disabled={isLoading}
                  className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '🤖 AI生成中...' : '✨ AI智能生成（推荐）'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 我的简历页面 */}
        {activeTab === 'resumes' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6">我的简历</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumes.map(r => (
                <div
                  key={r.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setPreviewResume(r)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{r.title}</h3>
                    <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">{r.match}%</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">{r.date} · {r.job || '通用'}</div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{r.type === 'high' ? '高匹配' : '普通'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteResume(r.id); }}
                      className="text-red-500 hover:text-red-700 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {resumes.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">暂无简历</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 预览弹窗 */}
      {previewResume && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewResume(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">简历预览</h3>
              <button onClick={() => setPreviewResume(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="resume-preview" dangerouslySetInnerHTML={{ __html: previewResume.content }} />
            <div className="border-t px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  const html = previewResume.content;
                  const fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>简历</title><style>body{font-family:arial;padding:40px;max-width:800px;margin:0 auto;line-height:1.6}h1{text-align:center;font-size:28px}h2{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin:24px 0 16px}h3{font-size:16px}.item{margin-bottom:16px}.item-header{display:flex;justify-content:space-between}.item-title{font-weight:500}.item-time{color:#999}ul{padding-left:18px}li{margin:6px 0}</style></head><body>' + html + '</body></html>';
                  const blob = new Blob([fullHtml], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = '简历.html';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Download className="w-4 h-4 inline mr-1" />
                下载HTML
              </button>
              <button
                onClick={() => setPreviewResume(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}