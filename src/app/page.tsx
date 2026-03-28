'use client';

import { useState, useEffect, useRef } from 'react';
import { Profile, Experience, Resume, JobAnalysis } from '@/types';
import { loadProfile, saveProfile, loadExperiences, saveExperiences, loadResumes, saveResumes } from '@/lib/storage';
import { callLLM, matchSkills, extractKeywords, calculateMatchScore, extractTextFromFile, prompts } from '@/lib/llm';
import {
  Home, Briefcase, Sparkles, FileText, User, Bell, Search, Plus,
  Edit2, Trash2, ChevronRight, Check, Upload, Download, X,
  Lightbulb, RefreshCw, Eye, EyeOff, Wand2
} from 'lucide-react';

// 类型名称映射
const typeNames: Record<string, string> = {
  education: '教育背景',
  research: '科研经历',
  award: '荣誉奖项',
  work: '学生工作',
  other: '其他'
};

const typeColors: Record<string, { bg: string; text: string }> = {
  education: { bg: 'bg-primary-fixed', text: 'text-primary' },
  research: { bg: 'bg-secondary-fixed', text: 'text-secondary' },
  award: { bg: 'bg-tertiary-fixed', text: 'text-tertiary' },
  work: { bg: 'bg-green-100', text: 'text-green-700' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600' }
};

type TabType = 'dashboard' | 'experience' | 'match' | 'resumes' | 'profile';

export default function ResumeManager() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [profile, setProfile] = useState<Profile>({ targetJobs: [] });
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '', birth: '', nation: '', political: '', origin: '', email: '', phone: '',
    apiKey: '', geminiApiKey: '', aiProvider: 'dashscope' as 'dashscope' | 'gemini',
    targetJobs: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [expForm, setExpForm] = useState({
    type: 'education', title: '', time: '', role: '', tags: '', desc: ''
  });
  const [importText, setImportText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [targetJob, setTargetJob] = useState('');
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [aiJobAnalysis, setAiJobAnalysis] = useState<any>(null);
  const [selectedExps, setSelectedExps] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载数据
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
      geminiApiKey: p.geminiApiKey || '',
      aiProvider: p.aiProvider || 'dashscope',
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
      geminiApiKey: formData.geminiApiKey,
      aiProvider: formData.aiProvider,
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

    if (editingExp) {
      const updated = experiences.map(e => e.id === editingExp.id ? { ...exp, id: e.id } : e);
      setExperiences(updated);
      saveExperiences(updated);
      setEditingExp(null);
    } else {
      const updated = [...experiences, exp];
      setExperiences(updated);
      saveExperiences(updated);
    }

    setExpForm({ type: 'education', title: '', time: '', role: '', tags: '', desc: '' });
  };

  // 删除经历
  const handleDeleteExp = (id: number) => {
    if (!confirm('确定删除这条经历吗？')) return;
    const updated = experiences.filter(e => e.id !== id);
    setExperiences(updated);
    saveExperiences(updated);
  };

  // 智能导入
  const handleLLMImport = async () => {
    if (!importText.trim()) { alert('请粘贴简历文本'); return; }
    const currentApiKey = formData.aiProvider === 'gemini' ? formData.geminiApiKey : formData.apiKey;
    if (!currentApiKey) { alert(`请先在个人资料中填写${formData.aiProvider === 'gemini' ? 'Google AI Studio' : '阿里云 DashScope'} API Key`); return; }

    setIsLoading(true);
    const result = await callLLM(currentApiKey, importText, prompts.extractResume, formData.aiProvider);
    setIsLoading(false);

    if (!result) return;

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```/g, '');

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        const newExps = parsed.map((item: any) => ({
          id: Date.now() + Math.random(),
          type: (item.type || 'other') as Experience['type'],
          title: item.title || '',
          time: item.time || '',
          role: item.role || '',
          desc: item.desc || '',
          tags: item.tags || []
        }));
        const updated = [...experiences, ...newExps];
        setExperiences(updated);
        saveExperiences(updated);
        alert(`成功导入 ${newExps.length} 条经历！`);
        setImportText('');
      }
    } catch (e) {
      console.error('导入解析错误:', e);
      alert('导入失败：返回格式不正确');
    }
  };

  // 生成简历
  const handleGenerateResume = async () => {
    const currentApiKey = formData.aiProvider === 'gemini' ? formData.geminiApiKey : formData.apiKey;
    if (!currentApiKey) { alert(`请先填写${formData.aiProvider === 'gemini' ? 'Google AI Studio' : '阿里云 DashScope'} API Key`); return; }
    if (selectedExps.length === 0) { alert('请选择至少一条经历'); return; }

    const selectedExperiences = experiences.filter(e => selectedExps.includes(e.id));

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

    const expText = selectedExperiences.map(exp => {
      return `【${typeNames[exp.type]}】${exp.title}\n时间: ${exp.time || '无'}\n角色: ${exp.role || '无'}\n描述: ${exp.desc || '无'}\n技能: ${exp.tags.join(', ')}`;
    }).join('\n\n');

    const prompt = `基本信息：姓名: ${userInfo.name}，出生: ${userInfo.birth}，民族: ${userInfo.nation}，政治面貌: ${userInfo.political}，籍贯: ${userInfo.origin}，邮箱: ${userInfo.email}，电话: ${userInfo.phone}

目标岗位: ${targetJob || '通用'}
${jobDesc ? '岗位JD:\n' + jobDesc : ''}

个人经历：
${expText}`;

    const result = await callLLM(currentApiKey, prompt, prompts.generateResume, formData.aiProvider);
    setIsLoading(false);

    if (!result) return;

    try {
      let html = result.trim();
      if (html.includes('```html')) html = html.replace(/```html/g, '').replace(/```/g, '');
      else if (html.startsWith('```')) html = html.replace(/```/g, '');

      const newResume: Resume = {
        id: Date.now(),
        title: targetJob ? `${targetJob}简历` : '简历',
        job: targetJob || '通用',
        content: html,
        date: new Date().toLocaleDateString(),
        match: 85,
        type: 'high'
      };

      const updated = [newResume, ...resumes];
      setResumes(updated);
      saveResumes(updated);
      setPreviewResume(newResume);
      alert('简历生成成功！');
    } catch (e) {
      console.error('生成错误:', e);
      alert('简历生成失败');
    }
  };

  // AI 岗位分析
  const handleAIAnalyzeJob = async () => {
    const currentApiKey = formData.aiProvider === 'gemini' ? formData.geminiApiKey : formData.apiKey;
    if (!currentApiKey) { alert(`请先填写${formData.aiProvider === 'gemini' ? 'Google AI Studio' : '阿里云 DashScope'} API Key`); return; }
    if (!jobDesc.trim()) { alert('请输入岗位描述'); return; }

    setIsLoading(true);
    setAiJobAnalysis(null);

    const result = await callLLM(currentApiKey, jobDesc, prompts.analyzeJob, formData.aiProvider);
    setIsLoading(false);

    if (!result) return;

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(jsonStr);
      setAiJobAnalysis(parsed);
    } catch (e) {
      console.error('分析解析错误:', e);
      alert('分析结果解析失败');
    }
  };

  // 删除简历
  const handleDeleteResume = (id: number) => {
    if (!confirm('确定删除这份简历吗？')) return;
    const updated = resumes.filter(r => r.id !== id);
    setResumes(updated);
    saveResumes(updated);
  };

  // 导出PDF
  const handleExportPDF = (resume: Resume) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${resume.title}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
              @page { margin: 15mm; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
          </style>
        </head>
        <body>${resume.content}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 100);
  };

  // 底部导航项
  const navItems = [
    { id: 'dashboard' as TabType, label: '首页', icon: Home },
    { id: 'experience' as TabType, label: '经历', icon: Briefcase },
    { id: 'match' as TabType, label: '匹配', icon: Sparkles },
    { id: 'resumes' as TabType, label: '简历', icon: FileText },
    { id: 'profile' as TabType, label: '我的', icon: User },
  ];

  // ==================== 页面组件 ====================

  // 首页 Dashboard
  const DashboardView = () => (
    <div className="space-y-6 fade-in">
      {/* Welcome Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-headline font-bold text-on-surface">
          Welcome back, {profile.name || 'Alex'}
        </h1>
        <p className="text-on-surface-variant mt-2">
          Your resume is currently matching 88% of your target job roles.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('experience')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-container rounded-2xl text-on-surface font-medium hover:bg-surface-container-high transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Experience</span>
        </button>
        <button
          onClick={() => setActiveTab('match')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl font-medium shadow-floating hover:bg-primary-container transition-colors"
        >
          <Sparkles className="w-5 h-5" />
          <span>Create Resume</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4">
        {[
          { icon: Briefcase, value: experiences.length, label: 'Total Experiences', color: 'bg-primary-container' },
          { icon: FileText, value: resumes.length, label: 'Resumes Created', color: 'bg-secondary-container' },
          { icon: Sparkles, value: '24', label: 'AI Analysis Used', color: 'bg-tertiary-container' },
          { icon: Lightbulb, value: '88%', label: 'Match Score', color: 'bg-green-500' },
        ].map((stat, idx) => (
          <div key={idx} className="card card-hover flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-headline font-bold text-on-surface">{stat.value}</div>
              <div className="text-sm text-on-surface-variant">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { icon: RefreshCw, title: 'Resume Optimized', desc: 'AI enhanced your senior developer resume bullets for better impact.', time: '2 HOURS AGO', color: 'bg-primary-container' },
            { icon: Sparkles, title: 'Job Match Analysis', desc: 'Analysis complete for "Senior UX Designer" position at Apple.', time: 'YESTERDAY', color: 'bg-secondary-container' },
            { icon: Plus, title: 'New Experience Added', desc: 'Added "Lead Product Designer" role at Meta to your profile.', time: '3 DAYS AGO', color: 'bg-surface-container' },
          ].map((activity, idx) => (
            <div key={idx} className="card flex gap-4">
              <div className={`w-10 h-10 ${activity.color} rounded-full flex items-center justify-center shrink-0`}>
                <activity.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-on-surface">{activity.title}</h3>
                <p className="text-sm text-on-surface-variant line-clamp-2">{activity.desc}</p>
                <span className="text-xs text-outline mt-1">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4">Quick Actions</h2>
        <div className="space-y-3">
          <button
            onClick={() => setActiveTab('match')}
            className="w-full card flex items-center gap-4 hover:bg-surface-container-low transition-colors"
          >
            <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-on-surface">Analyze Job</h3>
              <p className="text-sm text-on-surface-variant">Check fit for any job description</p>
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className="w-full card flex items-center gap-4 hover:bg-surface-container-low transition-colors"
          >
            <div className="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center">
              <Edit2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-on-surface">Quick Edit</h3>
              <p className="text-sm text-on-surface-variant">Update primary contact info</p>
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </button>
        </div>
      </div>

      {/* Upgrade Banner */}
      <div className="bg-primary rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-headline font-bold text-lg mb-2">Upgrade to Lumina Pro</h3>
          <p className="text-white/80 text-sm mb-4">Unlock unlimited AI tailoring and priority job matching.</p>
          <button className="bg-white text-primary px-6 py-2 rounded-full font-medium text-sm">
            Get Started
          </button>
        </div>
        <Sparkles className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
      </div>
    </div>
  );

  // 经历管理页面
  const ExperienceView = () => {
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const filteredExps = experiences.filter(exp => {
      if (filter !== 'all' && exp.type !== filter) return false;
      if (searchQuery && !exp.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    return (
      <div className="space-y-4 fade-in">
        {/* Header */}
        <div className="text-center py-2">
          <h1 className="text-2xl font-headline font-bold text-on-surface">Experience Management</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search experiences, skills, or roles..."
            className="w-full pl-12 pr-4 py-3 bg-surface-container rounded-2xl border border-transparent focus:border-primary outline-none transition-all"
          />
        </div>

        {/* Add Button */}
        <button
          onClick={() => setEditingExp({} as Experience)}
          className="w-full py-4 bg-primary text-white rounded-2xl font-medium flex items-center justify-center gap-2 shadow-floating hover:bg-primary-container transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Experience
        </button>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'all', label: 'All' },
            { id: 'education', label: 'Education' },
            { id: 'research', label: 'Research' },
            { id: 'award', label: 'Awards' },
            { id: 'work', label: 'Work' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Experience List */}
        <div className="space-y-4">
          {filteredExps.length === 0 ? (
            <div className="card text-center py-12">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-outline" />
              </div>
              <h3 className="font-semibold text-on-surface mb-2">No experiences yet</h3>
              <p className="text-sm text-on-surface-variant mb-4">Add your first experience to get started</p>
              <button
                onClick={() => setEditingExp({} as Experience)}
                className="px-6 py-2 bg-primary text-white rounded-full font-medium"
              >
                Add Now
              </button>
            </div>
          ) : (
            filteredExps.map(exp => {
              const colors = typeColors[exp.type];
              return (
                <div key={exp.id} className="card card-hover">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} mb-2`}>
                        {typeNames[exp.type].toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-on-surface text-lg">{exp.title}</h3>
                      {exp.role && (
                        <p className="text-sm text-on-surface-variant">{exp.role}</p>
                      )}
                      {exp.time && (
                        <p className="text-xs text-outline mt-1">{exp.time}</p>
                      )}
                      {exp.desc && (
                        <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{exp.desc}</p>
                      )}
                      {exp.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {exp.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-primary-fixed rounded-full text-xs text-on-surface">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingExp(exp)}
                        className="w-8 h-8 bg-surface-container rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-on-surface-variant" />
                      </button>
                      <button
                        onClick={() => handleDeleteExp(exp.id)}
                        className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FAB for Add */}
        <button
          onClick={() => setEditingExp({} as Experience)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-floating hover:bg-primary-container transition-colors z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    );
  };

  // 编辑经历弹窗
  const ExperienceModal = () => {
    if (!editingExp) return null;
    const isNew = !editingExp.id;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-lg font-headline font-bold text-on-surface">
              {isNew ? 'Add Experience' : 'Edit Experience'}
            </h2>
            <button onClick={() => setEditingExp(null)} className="w-8 h-8 flex items-center justify-center">
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Type</label>
              <select
                value={expForm.type}
                onChange={e => setExpForm({ ...expForm, type: e.target.value })}
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
              >
                <option value="education">Education</option>
                <option value="research">Research</option>
                <option value="award">Awards</option>
                <option value="work">Work</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Title</label>
              <input
                type="text"
                value={expForm.title}
                onChange={e => setExpForm({ ...expForm, title: e.target.value })}
                placeholder="e.g. Senior Product Designer"
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Time Period</label>
              <input
                type="text"
                value={expForm.time}
                onChange={e => setExpForm({ ...expForm, time: e.target.value })}
                placeholder="e.g. 2021 - Present"
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Role / Organization</label>
              <input
                type="text"
                value={expForm.role}
                onChange={e => setExpForm({ ...expForm, role: e.target.value })}
                placeholder="e.g. Google"
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Description</label>
              <textarea
                value={expForm.desc}
                onChange={e => setExpForm({ ...expForm, desc: e.target.value })}
                placeholder="Describe your experience..."
                rows={4}
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">Skills (comma separated)</label>
              <input
                type="text"
                value={expForm.tags}
                onChange={e => setExpForm({ ...expForm, tags: e.target.value })}
                placeholder="e.g. Figma, Design Systems, Leadership"
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="p-4 border-t border-outline-variant flex gap-3">
            <button
              onClick={() => setEditingExp(null)}
              className="flex-1 py-3 bg-surface-container text-on-surface rounded-full font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExperience}
              className="flex-1 py-3 bg-primary text-white rounded-full font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 匹配/创建简历页面
  const MatchView = () => (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="text-center py-2">
        <h1 className="text-2xl font-headline font-bold text-on-surface">Find your <span className="text-primary">perfect</span></h1>
        <p className="text-2xl font-headline font-bold text-on-surface">career orbit.</p>
        <p className="text-on-surface-variant mt-2 text-sm">AI-driven matching for the next generation of digital pioneers.</p>
      </div>

      {/* Job Match Card */}
      <div className="bg-primary rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-medium mb-3">NEW MATCH</span>
          <h3 className="text-2xl font-headline font-bold mb-1">Product Designer</h3>
          <p className="text-white/80 mb-4">Meta Labs • Remote</p>
          <button
            onClick={() => setTargetJob('Product Designer')}
            className="px-4 py-2 bg-white text-primary rounded-full font-medium text-sm"
          >
            View Role
          </button>
        </div>
        <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-24 h-24 text-white/10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center py-4">
          <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-2">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-headline font-bold text-on-surface">{experiences.length}</div>
          <div className="text-xs text-on-surface-variant uppercase tracking-wide">Experiences</div>
        </div>
        <div className="card text-center py-4">
          <div className="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center mx-auto mb-2">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-headline font-bold text-on-surface">85%</div>
          <div className="text-xs text-on-surface-variant uppercase tracking-wide">Profile Power</div>
          <div className="w-full h-1 bg-surface-container rounded-full mt-2">
            <div className="h-full w-[85%] bg-primary rounded-full" />
          </div>
        </div>
      </div>

      {/* Resume Creation */}
      <div className="card">
        <h3 className="font-headline font-bold text-lg text-on-surface mb-4">Create Resume</h3>

        {/* Step 1: Select Experiences */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-on-surface">Step 1: Select Experiences</span>
            <span className="text-xs text-primary font-medium">{selectedExps.length} selected</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {experiences.map(exp => {
              const isSelected = selectedExps.includes(exp.id);
              return (
                <div
                  key={exp.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedExps(selectedExps.filter(id => id !== exp.id));
                    } else {
                      setSelectedExps([...selectedExps, exp.id]);
                    }
                  }}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-fixed'
                      : 'border-transparent bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-primary text-white' : 'bg-white border-2 border-outline'
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-on-surface text-sm">{exp.title}</div>
                      <div className="text-xs text-on-surface-variant">{exp.time}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Job */}
        <div className="mb-4">
          <label className="text-sm text-on-surface-variant mb-1 block">Target Job Title</label>
          <input
            type="text"
            value={targetJob}
            onChange={e => setTargetJob(e.target.value)}
            placeholder="e.g. Product Designer"
            className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
          />
        </div>

        {/* Job Description */}
        <div className="mb-4">
          <label className="text-sm text-on-surface-variant mb-1 block">Job Description (Optional)</label>
          <textarea
            value={jobDesc}
            onChange={e => setJobDesc(e.target.value)}
            placeholder="Paste job requirements here to allow AI to tailor your resume..."
            rows={4}
            className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none resize-none"
          />
          <div className="text-right text-xs text-outline mt-1">{jobDesc.length} / 2000</div>
        </div>

        {/* AI Analyze Button */}
        <button
          onClick={handleAIAnalyzeJob}
          disabled={isLoading || !jobDesc.trim()}
          className="w-full py-3 bg-surface-container text-on-surface rounded-xl font-medium flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
        >
          <Wand2 className="w-5 h-5" />
          AI Analyze Job
        </button>

        {/* Analysis Results */}
        {aiJobAnalysis && (
          <div className="bg-primary-fixed rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-on-surface mb-2">Analysis Results</h4>
            <div className="text-sm text-on-surface-variant mb-2">{aiJobAnalysis.title}</div>
            {aiJobAnalysis.requiredSkills && (
              <div className="flex flex-wrap gap-2">
                {aiJobAnalysis.requiredSkills.slice(0, 5).map((skill: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-primary text-white rounded-full text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerateResume}
          disabled={isLoading || selectedExps.length === 0}
          className="w-full py-4 bg-primary text-white rounded-2xl font-medium flex items-center justify-center gap-2 shadow-floating disabled:opacity-50"
        >
          {isLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {isLoading ? 'Generating...' : 'Generate Resume'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // 简历列表页面
  const ResumesView = () => (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="text-center py-2">
        <h1 className="text-2xl font-headline font-bold text-on-surface">My Resumes</h1>
        <p className="text-on-surface-variant mt-2">{resumes.length} resumes saved</p>
      </div>

      {/* Resume List */}
      <div className="space-y-4">
        {resumes.length === 0 ? (
          <div className="card text-center py-12">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-outline" />
            </div>
            <h3 className="font-semibold text-on-surface mb-2">No resumes yet</h3>
            <p className="text-sm text-on-surface-variant mb-4">Create your first resume with AI</p>
            <button
              onClick={() => setActiveTab('match')}
              className="px-6 py-2 bg-primary text-white rounded-full font-medium"
            >
              Create Resume
            </button>
          </div>
        ) : (
          resumes.map(resume => (
            <div key={resume.id} className="card card-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-on-surface text-lg">{resume.title}</h3>
                  <p className="text-sm text-on-surface-variant">{resume.job}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-outline">{resume.date}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      resume.match >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {resume.match}% Match
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewResume(resume)}
                    className="w-8 h-8 bg-surface-container rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors"
                  >
                    <Eye className="w-4 h-4 text-on-surface-variant" />
                  </button>
                  <button
                    onClick={() => handleExportPDF(resume)}
                    className="w-8 h-8 bg-primary-container rounded-full flex items-center justify-center hover:bg-primary transition-colors"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => handleDeleteResume(resume.id)}
                    className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // 个人资料页面
  const ProfileView = () => (
    <div className="space-y-4 fade-in pb-8">
      {/* Header */}
      <div className="text-center py-2">
        <h1 className="text-2xl font-headline font-bold text-on-surface">Account Settings</h1>
        <p className="text-on-surface-variant mt-2 text-sm">Manage your professional identity and AI integration preferences.</p>
      </div>

      {/* Basic Information */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-headline font-bold text-lg text-primary">Basic Information</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Full Name', key: 'name', type: 'text' },
            { label: 'Birth Date', key: 'birth', type: 'text' },
            { label: 'Nationality', key: 'nation', type: 'text' },
            { label: 'Political Status', key: 'political', type: 'text' },
            { label: 'Place of Origin', key: 'origin', type: 'text' },
            { label: 'Email Address', key: 'email', type: 'email' },
            { label: 'Phone Number', key: 'phone', type: 'tel' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-sm text-on-surface-variant mb-1 block">{field.label}</label>
              <input
                type={field.type}
                value={formData[field.key as keyof typeof formData]}
                onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none transition-all"
              />
            </div>
          ))}
        </div>
      </div>

      {/* AI Configuration */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-headline font-bold text-lg text-secondary">AI Intelligence</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-on-surface-variant mb-1 block">AI Provider Selection</label>
            <select
              value={formData.aiProvider}
              onChange={e => setFormData({ ...formData, aiProvider: e.target.value as 'dashscope' | 'gemini' })}
              className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
            >
              <option value="dashscope">Alibaba Cloud DashScope</option>
              <option value="gemini">Google AI Studio</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-on-surface-variant mb-1 block">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.aiProvider === 'gemini' ? formData.geminiApiKey : formData.apiKey}
                onChange={e => formData.aiProvider === 'gemini'
                  ? setFormData({ ...formData, geminiApiKey: e.target.value })
                  : setFormData({ ...formData, apiKey: e.target.value })
                }
                placeholder={formData.aiProvider === 'gemini' ? 'Google AI Studio API Key' : 'DashScope API Key'}
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none pr-12"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
              >
                {showApiKey ? <EyeOff className="w-5 h-5 text-outline" /> : <Eye className="w-5 h-5 text-outline" />}
              </button>
            </div>
            <p className="text-xs text-outline mt-2">
              Your keys are encrypted locally before transmission.
            </p>
          </div>
        </div>
      </div>

      {/* Target Jobs */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-tertiary-container rounded-full flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-headline font-bold text-lg text-tertiary">Target Jobs</h2>
        </div>
        <div>
          <input
            type="text"
            value={formData.targetJobs}
            onChange={e => setFormData({ ...formData, targetJobs: e.target.value })}
            placeholder="Add more job titles..."
            className="w-full px-4 py-3 bg-surface-container rounded-xl border border-transparent focus:border-primary outline-none"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.targetJobs?.map((job, i) => (
              <span key={i} className="px-3 py-1 bg-secondary-fixed rounded-full text-sm text-on-surface flex items-center gap-1">
                {job}
                <button onClick={() => {
                  const newJobs = profile.targetJobs.filter((_, idx) => idx !== i);
                  setProfile({ ...profile, targetJobs: newJobs });
                }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveProfile}
        className="w-full py-4 bg-primary text-white rounded-2xl font-medium shadow-floating hover:bg-primary-container transition-colors"
      >
        Save Changes
      </button>
    </div>
  );

  // 简历预览弹窗
  const PreviewModal = () => {
    if (!previewResume) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-lg font-headline font-bold text-on-surface">{previewResume.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleExportPDF(previewResume)}
                className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button onClick={() => setPreviewResume(null)} className="w-8 h-8 flex items-center justify-center">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[70vh]">
            <div
              className="resume-preview border rounded-xl"
              dangerouslySetInnerHTML={{ __html: previewResume.content }}
            />
          </div>
        </div>
      </div>
    );
  };

  // 主渲染
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-card flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-headline font-bold text-xl text-primary">Lumina</span>
        </div>
        <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center overflow-hidden">
          <User className="w-5 h-5 text-on-surface" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 px-4">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'experience' && <ExperienceView />}
        {activeTab === 'match' && <MatchView />}
        {activeTab === 'resumes' && <ResumesView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-outline-variant px-2 py-2 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center gap-1 py-1 px-3 transition-colors"
              >
                <div className={`p-2 rounded-2xl transition-all duration-200 ${
                  isActive ? 'bg-primary text-white shadow-floating' : 'text-outline hover:bg-surface-container'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-outline'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <ExperienceModal />
      <PreviewModal />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-on-surface font-medium">AI is working...</p>
          </div>
        </div>
      )}
    </div>
  );
}
