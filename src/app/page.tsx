'use client';

import { useState, useEffect, useRef } from 'react';
import { Profile, Experience, Resume, JobAnalysis } from '@/types';
import { loadProfile, saveProfile, loadExperiences, saveExperiences, loadResumes, saveResumes } from '@/lib/storage';
import { callLLM, matchSkills, extractKeywords, calculateMatchScore, extractTextFromFile, prompts } from '@/lib/llm';

type TabType = 'dashboard' | 'profile' | 'experience' | 'create' | 'resumes';
type ViewType = 'dashboard' | 'experience' | 'analysis' | 'profile' | 'resumes';

export default function ResumeManager() {
  const [activeTab, setActiveTab] = useState<ViewType>('dashboard');
  const [profile, setProfile] = useState<Profile>({ targetJobs: [] });
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '', birth: '', nation: '', political: '', origin: '', email: '', phone: '',
    apiKey: '', geminiApiKey: '', aiProvider: 'dashscope' as 'dashscope' | 'gemini',
    targetJobs: ''
  });
  const [expForm, setExpForm] = useState({
    type: 'education', title: '', time: '', role: '', tags: '', desc: ''
  });
  const [jobDesc, setJobDesc] = useState('');
  const [targetJob, setTargetJob] = useState('');
  const [selectedExps, setSelectedExps] = useState<number[]>([]);
  const [aiJobAnalysis, setAiJobAnalysis] = useState<any>(null);
  const [expFilter, setExpFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
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

  // Save profile
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

  // Add experience
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

  // Delete experience
  const handleDeleteExp = (id: number) => {
    if (!confirm('确定删除这条经历吗？')) return;
    const updated = experiences.filter(e => e.id !== id);
    setExperiences(updated);
    saveExperiences(updated);
  };

  // AI analyze job
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

  // Generate resume
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

    const typeNames: Record<string, string> = {
      education: '教育背景', research: '科研经历', award: '荣誉奖项', work: '学生工作', other: '其他'
    };

    const expText = selectedExperiences.map(exp => {
      return `【${typeNames[exp.type]}】${exp.title}\n时间: ${exp.time || '无'}\n角色: ${exp.role || '无'}\n描述: ${exp.desc || '无'}\n技能: ${exp.tags.join(', ')}`;
    }).join('\n\n');

    const prompt = `基本信息：姓名: ${userInfo.name}，出生: ${userInfo.birth}，民族: ${userInfo.nation}，政治面貌: ${userInfo.political}，籍贯: ${userInfo.origin}，邮箱: ${userInfo.email}，电话: ${userInfo.phone}

目标岗位: ${targetJob || '通用'}
${jobDesc ? '岗位JD:\n' + jobDesc : ''}

个人经历：\n${expText}`;

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
        match: aiJobAnalysis ? Math.round((aiJobAnalysis.matchedSkills?.length || 0) / ((aiJobAnalysis.matchedSkills?.length || 0) + (aiJobAnalysis.missingSkills?.length || 1)) * 100) : 85,
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

  // Delete resume
  const handleDeleteResume = (id: number) => {
    if (!confirm('确定删除这份简历吗？')) return;
    const updated = resumes.filter(r => r.id !== id);
    setResumes(updated);
    saveResumes(updated);
  };

  // Export PDF
  const handleExportPDF = (resume: Resume) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${resume.title}</title>
      <style>@media print { body { margin: 0; padding: 20px; } @page { margin: 15mm; } }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }</style>
      </head><body>${resume.content}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 100);
  };

  // Type colors
  const typeColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    education: { bg: 'bg-tertiary-fixed/30', text: 'text-tertiary', border: 'border-tertiary', icon: 'school' },
    research: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', icon: 'biotech' },
    award: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-500', icon: 'emoji_events' },
    work: { bg: 'bg-primary-fixed/30', text: 'text-primary', border: 'border-primary', icon: 'apartment' },
    other: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-500', icon: 'more_horiz' }
  };

  const typeNames: Record<string, string> = {
    education: '教育', research: '科研', award: '荣誉', work: '工作', other: '其他'
  };

  // ============ VIEWS ============

  // Dashboard View
  const DashboardView = () => (
    <div className="fade-in space-y-8">
      {/* Welcome Header */}
      <section>
        <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight mb-2">
          欢迎回来，{profile.name || 'Alex'}。你的简历已有 <span className="text-primary">88% 完成度</span>，助力开启 <span className="text-primary">下一段职业旅程</span>。
        </h2>
        <p className="text-on-surface-variant font-body">完成最后一个项目描述即可达到 100%。</p>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: 'work_history', label: '经历总数', value: experiences.length, sub: '本月 +2', color: 'primary' },
          { icon: 'description', label: '已创简历', value: resumes.length, sub: '', color: 'primary' },
          { icon: 'auto_awesome', label: 'AI 分析次数', value: '42', sub: '前 5% 用户', color: 'primary' },
          { icon: 'bolt', label: '综合匹配度', value: '94%', sub: '', color: 'tertiary' },
        ].map((stat, idx) => (
          <div key={idx} className="card card-hover p-6 flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-2xl text-primary mb-3">{stat.icon}</span>
              <p className="text-xs font-label uppercase tracking-wider text-on-surface-variant opacity-70">{stat.label}</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <h3 className="text-3xl font-headline font-extrabold">{stat.value}</h3>
              {stat.sub && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stat.color === 'tertiary' ? 'bg-tertiary/10 text-tertiary' : 'bg-green-50 text-green-600'}`}>{stat.sub}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* Two Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-xl font-headline font-bold">最近动态</h4>
              <button className="text-primary font-bold text-sm hover:underline">查看历史</button>
            </div>
            <div className="space-y-8 relative timeline">
              {[
                { title: '简历已优化', desc: '高级产品设计师 (Google 模板)', time: '2小时前', color: 'border-primary' },
                { title: 'AI 技能缺口分析', desc: '发现 Meta 相关职位的 3 个缺失关键词。', time: '昨天', color: 'border-tertiary' },
                { title: '已添加经历', desc: 'Stripe 自由职业首席设计师。', time: '10月 24日', color: 'border-secondary' },
              ].map((item, idx) => (
                <div key={idx} className="timeline-item">
                  <div className={`timeline-dot ${item.color}`}></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-on-surface">{item.title}</h5>
                      <p className="text-sm text-on-surface-variant mt-1">{item.desc}</p>
                    </div>
                    <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bento Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-primary-container to-primary p-6 rounded-xl text-white">
              <h4 className="font-bold mb-2">简历评分卡</h4>
              <p className="text-xs opacity-80 mb-6">你的排版非常适合 ATS 系统识别。</p>
              <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-[92%]"></div>
              </div>
              <p className="text-right text-[10px] mt-2 font-bold uppercase tracking-widest">A+ 评级</p>
            </div>
            <div className="bg-surface-container-high p-6 rounded-xl border border-white/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">share</span>
                </div>
                <h4 className="font-bold">公开链接</h4>
              </div>
              <p className="text-xs text-on-surface-variant mb-4">你的专业作品集目前已上线。</p>
              <button className="w-full py-2 bg-white text-on-surface text-xs font-bold rounded-lg shadow-sm">管理可见性</button>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="space-y-6">
          <div className="card p-8 h-full">
            <h4 className="text-xl font-headline font-bold mb-6">快速操作</h4>
            <div className="space-y-3">
              {[
                { icon: 'add_circle', label: '创建新简历', action: () => setActiveTab('analysis') },
                { icon: 'playlist_add', label: '添加经历', action: () => setActiveTab('experience') },
                { icon: 'analytics', label: '分析职位描述', action: () => setActiveTab('analysis') },
                { icon: 'file_download', label: '导出所有数据', action: () => {} },
              ].map((item, idx) => (
                <button key={idx} onClick={item.action} className="w-full flex items-center justify-between p-4 bg-surface-container-low hover:bg-primary/5 rounded-xl group transition-all">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">{item.icon}</span>
                    <span className="text-sm font-bold">{item.label}</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-40 group-hover:opacity-100">chevron_right</span>
                </button>
              ))}
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/10">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">当前目标职位</p>
              <div className="p-4 bg-tertiary-fixed rounded-xl border border-tertiary/10">
                <p className="font-bold text-on-tertiary-fixed mb-1">资深用户体验架构师</p>
                <p className="text-xs text-on-tertiary-fixed opacity-70">旧金山 / 远程</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <section className="card p-8 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary to-primary-container"></div>
        <div className="flex items-start justify-between relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-tertiary-container text-white text-[10px] font-extrabold rounded-full uppercase tracking-tighter">市场需求分析</span>
              <span className="text-xs font-bold text-on-surface-variant opacity-60">最近更新：刚刚</span>
            </div>
            <h3 className="text-2xl font-headline font-extrabold mb-4">当前就业市场洞察</h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              过去一个季度，金融科技和医疗保健行业对 <span className="font-bold text-on-surface">设计系统专家</span> 和 <span className="font-bold text-on-surface">AI 界面设计师</span> 的需求激增了 24%。你目前的个人资料与这些高增长职位的 <span className="text-primary font-bold">匹配度高达 94%</span>。
            </p>
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: 'trending_up', label: '薪资趋势', value: '同比 +12%' },
                { icon: 'location_on', label: '热门地区', value: '伦敦 / 远程' },
                { icon: 'group', label: '竞争程度', value: '中等' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-sm">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60">{item.label}</p>
                    <p className="text-sm font-bold">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // Experience Management View
  const ExperienceView = () => {
    const filteredExps = experiences.filter(exp => {
      if (expFilter === 'all') return true;
      return exp.type === expFilter;
    });

    const typeCount = experiences.reduce((acc, exp) => {
      acc[exp.type] = (acc[exp.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="fade-in space-y-6">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <nav className="flex text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">
              <span className="hover:text-primary cursor-pointer transition-colors">工作区</span>
              <span className="mx-2">/</span>
              <span className="text-on-surface-variant">项目组合管理</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight text-on-surface leading-tight">经历库</h2>
            <p className="text-on-surface-variant mt-1 text-sm font-body max-w-lg">管理您的职业旅程。为随时可供调研的简历导出提供有序记录。</p>
          </div>
          <button onClick={() => setEditingExp({} as Experience)} className="btn-primary flex items-center gap-2">
            <span className="material-symbols-outlined">add_circle</span>
            添加经历
          </button>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            {/* Filter Bar */}
            <div className="bg-surface-container-lowest p-2 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex p-1 bg-surface-container-low rounded-xl">
                {['all', 'education', 'research', 'award', 'work'].map((f) => (
                  <button key={f} onClick={() => setExpFilter(f)} className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${
                    expFilter === f ? 'text-primary bg-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}>
                    {f === 'all' ? '全部' : typeNames[f]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-4">
                <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-tighter">排序方式</span>
                <select className="bg-transparent border-none text-xs font-bold text-on-surface focus:ring-0 cursor-pointer">
                  <option>最近优先</option>
                  <option>由远及近</option>
                </select>
              </div>
            </div>

            {/* Experience Cards */}
            <div className="space-y-4">
              {filteredExps.length === 0 ? (
                <div className="card text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-outline mb-4">work</span>
                  <h3 className="font-semibold text-on-surface mb-2">暂无经历</h3>
                  <p className="text-sm text-on-surface-variant mb-4">添加您的第一条经历</p>
                  <button onClick={() => setEditingExp({} as Experience)} className="btn-primary">立即添加</button>
                </div>
              ) : (
                filteredExps.map(exp => {
                  const colors = typeColors[exp.type];
                  return (
                    <div key={exp.id} className="card card-hover p-6 relative overflow-hidden group">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${colors.border.replace('border-', '')}`}></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-2xl {colors.text}">{colors.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-on-surface leading-none">{exp.title}</h3>
                              <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-[10px] font-bold rounded uppercase tracking-wider`}>{typeNames[exp.type]}</span>
                            </div>
                            {exp.role && <p className="text-on-surface-variant text-sm font-medium">{exp.role}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingExp(exp)} className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant"><span className="material-symbols-outlined text-lg">edit</span></button>
                          <button onClick={() => handleDeleteExp(exp.id)} className="p-2 hover:bg-error-container/20 rounded-lg text-error"><span className="material-symbols-outlined text-lg">delete</span></button>
                        </div>
                      </div>
                      <div className="ml-16">
                        {exp.time && (
                          <div className="flex items-center gap-2 text-xs font-medium text-primary mb-3">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            {exp.time}
                          </div>
                        )}
                        {exp.desc && <p className="text-on-surface-variant text-sm leading-relaxed max-w-2xl line-clamp-2">{exp.desc}</p>}
                        {exp.tags.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {exp.tags.slice(0, 5).map((tag, i) => (
                              <span key={i} className="px-3 py-1 bg-primary-fixed/20 text-on-primary-fixed-variant text-[11px] font-bold rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Stats */}
            <div className="card p-6">
              <h4 className="text-sm font-bold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">analytics</span>
                库统计
              </h4>
              <div className="space-y-4">
                {[
                  { label: '工作经历', count: typeCount.work || 0, color: 'bg-primary' },
                  { label: '教育背景', count: typeCount.education || 0, color: 'bg-tertiary' },
                  { label: '科研项目', count: typeCount.research || 0, color: 'bg-green-500' },
                  { label: '荣誉奖励', count: typeCount.award || 0, color: 'bg-purple-500' },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.color}`}></div>
                      <span className="text-xs font-medium text-on-surface-variant group-hover:text-primary transition-colors">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-on-surface bg-surface-container-high px-2 py-0.5 rounded">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-outline-variant/20">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">资料完整度</span>
                  <span className="text-xs font-bold text-primary">94%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-[94%]"></div>
                </div>
                <p className="text-[10px] text-on-surface-variant/60 mt-2 leading-tight">您的经历详情非常完整，非常适合 AI 生成简历。</p>
              </div>
            </div>

            {/* Pro Tip */}
            <div className="bg-primary-container p-6 rounded-2xl relative overflow-hidden group text-white">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
              <div className="relative z-10">
                <span className="material-symbols-outlined mb-2">lightbulb</span>
                <h5 className="text-sm font-bold mb-2">效率小贴士</h5>
                <p className="text-white/80 text-xs leading-relaxed mb-4">添加具体的量化结果（例如"增加收入 20%"）可以让您的经历在 ATS 系统中脱颖而出。</p>
                <button className="w-full py-2 bg-white text-primary text-[10px] font-bold rounded-lg hover:bg-opacity-90 transition-all uppercase tracking-widest">了解更多</button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="px-2">
              <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">最近操作</h4>
              <div className="space-y-4">
                {[
                  { icon: 'edit', title: '更新了技能', desc: '系统架构师 • 2小时前' },
                  { icon: 'content_copy', title: '克隆了条目', desc: '研究员 • 昨天' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-outline-variant/30 text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">{item.title}</p>
                      <p className="text-[10px] text-on-surface-variant">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // AI Analysis View
  const AnalysisView = () => (
    <div className="fade-in space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8">
        {['选择经历', '分析职位', '预览与导出'].map((step, idx) => {
          const isActive = idx === 1;
          const isCompleted = idx < 1;
          return (
            <div key={idx} className={`flex-1 flex flex-col items-center gap-2 ${idx > 1 ? 'opacity-40' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                isActive ? 'bg-primary text-white step-active' : isCompleted ? 'bg-green-500 text-white' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {idx + 1}
              </div>
              <span className={`text-xs font-label uppercase tracking-widest ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{step}</span>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left: Input */}
        <section className="col-span-7 space-y-6">
          <div className="card p-8 shadow-floating relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">职位描述</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-low hover:bg-surface-container-high text-primary font-semibold rounded-full transition-all text-xs">
                <span className="material-symbols-outlined text-sm">link</span>
                链接导入
              </button>
            </div>
            <div className="relative">
              <textarea
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
                className="w-full h-96 bg-surface-container border-none focus:ring-0 rounded-xl p-6 text-sm text-on-surface placeholder:text-outline font-body leading-relaxed resize-none"
                placeholder="在此粘贴职位描述，让我们的 AI 分析关键词密度、所需技能和文化契合度..."
              />
              <button className="absolute bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all font-semibold">
                <span className="material-symbols-outlined">content_paste</span>
                从剪贴板粘贴
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant/60">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>为了获得最佳效果，请包含角色、职责和要求的资格。</span>
            </div>
          </div>

          {/* Experience Selection */}
          <div className="card p-6">
            <h3 className="font-bold text-lg mb-4">选择要包含的经历</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {experiences.map(exp => {
                const isSelected = selectedExps.includes(exp.id);
                return (
                  <div key={exp.id} onClick={() => {
                    setSelectedExps(isSelected ? selectedExps.filter(id => id !== exp.id) : [...selectedExps, exp.id]);
                  }} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary-fixed' : 'border-transparent bg-surface-container'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-white border-2 border-outline'}`}>
                        {isSelected && <span className="material-symbols-outlined text-xs">check</span>}
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
        </section>

        {/* Right: AI Analysis */}
        <section className="col-span-5 space-y-6">
          <div className="card p-8 shadow-floating">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary material-symbols-filled">insights</span>
              AI 分析报告
            </h3>

            {!aiJobAnalysis ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-outline mb-4">psychology</span>
                <p className="text-on-surface-variant">粘贴职位描述后点击分析</p>
                <button onClick={handleAIAnalyzeJob} disabled={!jobDesc.trim()} className="btn-primary mt-4 disabled:opacity-50">
                  <span className="material-symbols-outlined">auto_awesome</span>
                  AI 分析职位
                </button>
              </div>
            ) : (
              <>
                {/* Match Score */}
                <div className="flex items-center gap-8 mb-8 p-4 bg-primary/5 rounded-2xl">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle className="text-surface-container-high" cx="56" cy="56" fill="transparent" r="48" stroke="currentColor" strokeWidth="8"></circle>
                      <circle className="text-primary" cx="56" cy="56" fill="transparent" r="48" stroke="currentColor" strokeDasharray="301.59" strokeDashoffset="75.4" strokeWidth="8"></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-primary">75%</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface">匹配度百分比</h4>
                    <p className="text-sm text-on-surface-variant">您的档案与此高级职位的匹配度很高。</p>
                  </div>
                </div>

                {/* Matched Skills */}
                <div className="mb-6">
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant block mb-3">已匹配技能</label>
                  <div className="flex flex-wrap gap-2">
                    {['React.js', 'TypeScript', 'System Design', 'Agile'].map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="mb-8">
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant block mb-3">缺失技能</label>
                  <div className="flex flex-wrap gap-2">
                    {['GraphQL', 'AWS Lambda'].map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-xs font-medium rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Suggestions */}
                <div className="border-t border-surface-container-high pt-6">
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant block mb-4">AI 改进建议</label>
                  <ul className="space-y-4">
                    {[
                      '将"管理一个团队"替换为"统筹协调一个 8 人的跨职能小组"以匹配领导力关键词。',
                      '在您的 React 经验中添加量化指标（例如："将加载时间缩短了 40%"）。',
                      '在您最近的项目描述中提及"利益相关者管理"。',
                    ].map((suggestion, i) => (
                      <li key={i} className="flex gap-3 text-sm text-on-surface-variant leading-snug">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 right-0 w-[calc(100%-16rem)] bg-white/60 backdrop-blur-2xl px-12 py-6 flex justify-between items-center z-40 border-t border-white/20">
        <div className="flex items-center gap-4">
          <div className="text-xs text-on-surface-variant">
            <span className="font-bold text-primary">准备好润色了吗？</span> AI 已完成扫描。
          </div>
        </div>
        <div className="flex gap-4">
          <button className="px-8 py-3 text-primary font-bold hover:bg-primary-fixed/30 rounded-lg transition-all">
            保存草稿
          </button>
          <button onClick={handleGenerateResume} disabled={isLoading || selectedExps.length === 0} className="px-10 py-3 bg-gradient-to-br from-primary to-primary-container text-white rounded-lg font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
            {isLoading ? <span className="material-symbols-outlined loading">refresh</span> : '下一步：预览与导出'}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </footer>
    </div>
  );

  // Profile View
  const ProfileView = () => (
    <div className="fade-in max-w-3xl space-y-6">
      <h2 className="text-2xl font-headline font-bold">个人资料设置</h2>

      {/* Basic Info */}
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">person</span>
          基本信息
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '姓名', key: 'name' },
            { label: '出生日期', key: 'birth' },
            { label: '民族', key: 'nation' },
            { label: '政治面貌', key: 'political' },
            { label: '籍贯', key: 'origin' },
            { label: '邮箱', key: 'email' },
            { label: '电话', key: 'phone' },
          ].map(field => (
            <div key={field.key} className={field.key === 'email' || field.key === 'phone' ? 'col-span-2' : ''}>
              <label className="text-sm text-on-surface-variant mb-1 block">{field.label}</label>
              <input
                type="text"
                value={formData[field.key as keyof typeof formData]}
                onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                className="input-field"
              />
            </div>
          ))}
        </div>
      </div>

      {/* AI Config */}
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">psychology</span>
          AI 配置
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-on-surface-variant mb-1 block">AI 提供商</label>
            <select
              value={formData.aiProvider}
              onChange={e => setFormData({ ...formData, aiProvider: e.target.value as 'dashscope' | 'gemini' })}
              className="input-field"
            >
              <option value="dashscope">阿里云 DashScope</option>
              <option value="gemini">Google AI Studio</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-on-surface-variant mb-1 block">API Key</label>
            <input
              type="password"
              value={formData.aiProvider === 'gemini' ? formData.geminiApiKey : formData.apiKey}
              onChange={e => formData.aiProvider === 'gemini'
                ? setFormData({ ...formData, geminiApiKey: e.target.value })
                : setFormData({ ...formData, apiKey: e.target.value })
              }
              placeholder={formData.aiProvider === 'gemini' ? 'Google AI Studio API Key' : '阿里云 DashScope API Key'}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Target Jobs */}
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">work</span>
          目标职位
        </h3>
        <input
          type="text"
          value={formData.targetJobs}
          onChange={e => setFormData({ ...formData, targetJobs: e.target.value })}
          placeholder="输入目标职位，用逗号分隔"
          className="input-field"
        />
      </div>

      <button onClick={handleSaveProfile} className="btn-primary w-full">
        保存更改
      </button>
    </div>
  );

  // Resumes View
  const ResumesView = () => (
    <div className="fade-in space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-headline font-bold">我的简历</h2>
        <button onClick={() => setActiveTab('analysis')} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined">add</span>
          创建新简历
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resumes.length === 0 ? (
          <div className="card col-span-full text-center py-12">
            <span className="material-symbols-outlined text-4xl text-outline mb-4">description</span>
            <h3 className="font-semibold text-on-surface mb-2">暂无简历</h3>
            <p className="text-sm text-on-surface-variant mb-4">创建您的第一份简历</p>
            <button onClick={() => setActiveTab('analysis')} className="btn-primary">立即创建</button>
          </div>
        ) : (
          resumes.map(resume => (
            <div key={resume.id} className="card card-hover p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{resume.title}</h3>
                  <p className="text-sm text-on-surface-variant">{resume.job}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${resume.match >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {resume.match}% 匹配
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-outline mb-4">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                {resume.date}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewResume(resume)} className="flex-1 py-2 bg-surface-container text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-container-high transition-colors">
                  预览
                </button>
                <button onClick={() => handleExportPDF(resume)} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-container transition-colors">
                  导出
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Edit Experience Modal
  const ExperienceModal = () => {
    if (!editingExp) return null;
    const isNew = !editingExp.id;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-lg font-headline font-bold">{isNew ? '添加经历' : '编辑经历'}</h2>
            <button onClick={() => setEditingExp(null)} className="w-8 h-8 flex items-center justify-center">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">类型</label>
              <select value={expForm.type} onChange={e => setExpForm({ ...expForm, type: e.target.value })} className="input-field">
                <option value="education">教育背景</option>
                <option value="research">科研经历</option>
                <option value="award">荣誉奖项</option>
                <option value="work">工作经历</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">标题</label>
              <input type="text" value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })} placeholder="例如：高级产品经理" className="input-field" />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">时间</label>
              <input type="text" value={expForm.time} onChange={e => setExpForm({ ...expForm, time: e.target.value })} placeholder="例如：2021年1月 - 至今" className="input-field" />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">公司/组织</label>
              <input type="text" value={expForm.role} onChange={e => setExpForm({ ...expForm, role: e.target.value })} placeholder="例如：Google" className="input-field" />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">描述</label>
              <textarea value={expForm.desc} onChange={e => setExpForm({ ...expForm, desc: e.target.value })} placeholder="描述您的经历..." rows={4} className="input-field resize-none" />
            </div>
            <div>
              <label className="text-sm text-on-surface-variant mb-1 block">技能（逗号分隔）</label>
              <input type="text" value={expForm.tags} onChange={e => setExpForm({ ...expForm, tags: e.target.value })} placeholder="例如：React, TypeScript, 领导力" className="input-field" />
            </div>
          </div>
          <div className="p-4 border-t border-outline-variant flex gap-3">
            <button onClick={() => setEditingExp(null)} className="flex-1 py-3 bg-surface-container text-on-surface rounded-xl font-medium">取消</button>
            <button onClick={handleAddExperience} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium">保存</button>
          </div>
        </div>
      </div>
    );
  };

  // Resume Preview Modal
  const PreviewModal = () => {
    if (!previewResume) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-lg font-headline font-bold">{previewResume.title}</h2>
            <div className="flex gap-2">
              <button onClick={() => handleExportPDF(previewResume)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined">download</span>
                导出 PDF
              </button>
              <button onClick={() => setPreviewResume(null)} className="w-8 h-8 flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[70vh]">
            <div className="resume-preview border rounded-xl" dangerouslySetInnerHTML={{ __html: previewResume.content }} />
          </div>
        </div>
      </div>
    );
  };

  // Loading Overlay
  const LoadingOverlay = () => isLoading ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full loading"></div>
        <p className="text-on-surface font-medium">AI 正在处理...</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="sidebar-nav">
        <div className="px-2 mb-8 mt-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Atheneum</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant opacity-60">简历系统</p>
        </div>
        <nav className="flex-1 space-y-1">
          {[
            { id: 'dashboard', label: '控制台', icon: 'dashboard' },
            { id: 'profile', label: '个人资料', icon: 'account_circle' },
            { id: 'experience', label: '经历管理', icon: 'work' },
            { id: 'analysis', label: 'AI 简历助手', icon: 'psychology' },
            { id: 'resumes', label: '我的简历', icon: 'description' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ViewType)}
              className={`sidebar-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-4 px-2">
          <button onClick={() => setActiveTab('analysis')} className="w-full py-3 btn-primary text-sm">
            制作新简历
          </button>
        </div>
        <div className="mt-auto space-y-1 pt-4 border-t border-outline-variant/10">
          <button className="sidebar-item w-full text-left">
            <span className="material-symbols-outlined">settings</span>
            设置
          </button>
          <button className="sidebar-item w-full text-left">
            <span className="material-symbols-outlined">help</span>
            帮助中心
          </button>
        </div>
      </aside>

      {/* Top Navigation */}
      <header className="top-nav">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-60">search</span>
            <input
              type="text"
              placeholder="搜索经历、职位或简历..."
              className="w-full bg-surface-container-high/40 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border-r border-outline-variant/20 pr-4">
            <button className="p-2 hover:bg-slate-50 rounded-full transition-all text-on-surface-variant">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-all text-on-surface-variant">
              <span className="material-symbols-outlined">history</span>
            </button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-all text-on-surface-variant">
              <span className="material-symbols-outlined">apps</span>
            </button>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden xl:block">
              <p className="font-bold text-slate-900">{profile.name || 'Alex Chen'}</p>
              <p className="text-[10px] text-on-surface-variant">高级版会员</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold">
              {(profile.name || 'A').charAt(0)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-64 pt-24 pb-12 px-8 min-h-screen">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'experience' && <ExperienceView />}
        {activeTab === 'analysis' && <AnalysisView />}
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'resumes' && <ResumesView />}
      </main>

      {/* Modals */}
      <ExperienceModal />
      <PreviewModal />
      <LoadingOverlay />
    </div>
  );
}
