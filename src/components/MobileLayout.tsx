'use client';

import { ReactNode } from 'react';
import { Home, Briefcase, Sparkles, FileText, User } from 'lucide-react';

type TabType = 'dashboard' | 'experience' | 'match' | 'resumes' | 'profile';

interface LayoutProps {
  children: ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const navItems: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: '首页', icon: Home },
  { id: 'experience', label: '经历', icon: Briefcase },
  { id: 'match', label: '匹配', icon: Sparkles },
  { id: 'resumes', label: '简历', icon: FileText },
  { id: 'profile', label: '我的', icon: User },
];

export function MobileLayout({ children, activeTab, onTabChange }: LayoutProps) {
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
        <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-on-surface" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 px-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <div className={`p-2 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-primary text-white' : 'text-outline'
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
    </div>
  );
}
