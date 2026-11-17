import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import {
  GraduationCap, LayoutDashboard, BookOpen, Clock, RefreshCw, CheckSquare,
  Calendar, StickyNote, Layers, BarChart3, Bot, Settings, LogOut,
  Menu, X, Moon, Sun, Search, Sparkles
} from 'lucide-react';
import { Dashboard } from '@/pages/Dashboard';
import { SubjectsPage } from '@/pages/SubjectsPage';
import { StudyTrackerPage } from '@/pages/StudyTrackerPage';
import { RevisionCentrePage } from '@/pages/RevisionCentrePage';
import { TasksPage } from '@/pages/TasksPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { NotesPage } from '@/pages/NotesPage';
import { FlashcardsPage } from '@/pages/FlashcardsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LearningCentrePage } from '@/pages/LearningCentrePage';
import { AIAssistant } from '@/components/AIAssistant';

type Page =
  | 'dashboard' | 'learning' | 'subjects' | 'study' | 'revision' | 'tasks'
  | 'calendar' | 'notes' | 'flashcards' | 'analytics' | 'settings';

type SearchResult = {
  id: string;
  title: string;
  detail: string;
  page: Page;
};

const NAV_ITEMS: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'learning', label: 'Learning Centre', icon: Sparkles },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
  { id: 'study', label: 'Study Tracker', icon: Clock },
  { id: 'revision', label: 'Revision Centre', icon: RefreshCw },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function AppShell() {
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const navItems = NAV_ITEMS;

  useEffect(() => {
    const query = search.trim();
    if (!user || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const pattern = `%${query}%`;

      try {
        const subjectsRequest = supabase
          .from('subjects')
          .select('id, name')
          .eq('user_id', user.id)
          .ilike('name', pattern)
          .limit(5);

        const [subjects, tasks, notes, flashcards, events] = await Promise.all([
          subjectsRequest,
          supabase.from('tasks').select('id, title, status').eq('user_id', user.id).ilike('title', pattern).limit(5),
          supabase.from('notes').select('id, title').eq('user_id', user.id).ilike('title', pattern).limit(5),
          supabase.from('flashcards').select('id, front').eq('user_id', user.id).ilike('front', pattern).limit(5),
          supabase.from('calendar_events').select('id, title, event_type').eq('user_id', user.id).ilike('title', pattern).limit(5),
        ]);

        const subjectRows = subjects.data ?? [];
        const subjectIds = subjectRows.map((subject) => subject.id);
        const topics = subjectIds.length
          ? await supabase.from('topics').select('id, name, subject_id').in('subject_id', subjectIds).ilike('name', pattern).limit(5)
          : { data: [] };

        if (cancelled) return;

        const results: SearchResult[] = [
          ...subjectRows.map((item) => ({ id: item.id, title: item.name, detail: 'Subject', page: 'subjects' as const })),
          ...(topics.data ?? []).map((item) => ({
            id: item.id, title: item.name,
            detail: `Topic in ${subjectRows.find((subject) => subject.id === item.subject_id)?.name ?? 'Subject'}`,
            page: 'subjects' as const,
          })),
          ...(tasks.data ?? []).map((item) => ({ id: item.id, title: item.title, detail: 'Task', page: 'tasks' as const })),
          ...(notes.data ?? []).map((item) => ({ id: item.id, title: item.title, detail: 'Note', page: 'notes' as const })),
          ...(flashcards.data ?? []).map((item) => ({ id: item.id, title: item.front, detail: 'Flashcard', page: 'flashcards' as const })),
          ...(events.data ?? []).map((item) => ({ id: item.id, title: item.title, detail: 'Calendar event', page: 'calendar' as const })),
        ].slice(0, 12);

        setSearchResults(results);
      } catch (error) {
        console.error('Global search failed:', error);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, user]);

  const selectSearchResult = (result: SearchResult) => {
    setPage(result.page);
    setSearch('');
    setSearchResults([]);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'learning': return <LearningCentrePage />;
      case 'subjects': return <SubjectsPage />;
      case 'study': return <StudyTrackerPage />;
      case 'revision': return <RevisionCentrePage />;
      case 'tasks': return <TasksPage />;
      case 'calendar': return <CalendarPage />;
      case 'notes': return <NotesPage />;
      case 'flashcards': return <FlashcardsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'settings': return <SettingsPage />;
    }
  };

  const SidebarContent = () => (
    <>
      <button
        type="button"
        onClick={() => { setPage('dashboard'); setSidebarOpen(false); }}
        className="group flex items-center gap-3 px-4 py-5 border-b border-app text-left w-full transition-all duration-300 hover:bg-white/40 dark:hover:bg-white/[0.06]"
        aria-label="Go to StudyTrack dashboard"
        title="Go to dashboard"
      >
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent))' }}>
          <GraduationCap size={20} />
        </span>
        <span className="text-lg font-bold text-primary tracking-tight">StudyTrack</span>
      </button>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setPage(item.id);
              setSidebarOpen(false);
            }}
            className={`nav-link w-full ${page === item.id ? 'active' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-app space-y-1">
        <button
          onClick={() => { setPage('settings'); setSidebarOpen(false); }}
          className={`nav-link w-full ${page === 'settings' ? 'active' : ''}`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button onClick={signOut} className="nav-link w-full">
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col surface border-r border-app shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col surface border-r border-app animate-slide-in-right">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 btn-ghost btn !p-1.5 z-10"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-app surface flex items-center gap-4 px-4 lg:px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden btn-ghost btn !p-2">
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-md relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
            <input
              className="input pl-10"
              placeholder="Search subjects, topics, tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('');
                  setSearchResults([]);
                }
                if (e.key === 'Enter' && searchResults[0]) {
                  selectSearchResult(searchResults[0]);
                }
              }}
              aria-label="Search your StudyTrack data"
              aria-expanded={search.trim().length >= 2}
              aria-controls="global-search-results"
            />
            {search.trim().length >= 2 && (
              <div
                id="global-search-results"
                className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-app surface shadow-xl z-50 overflow-hidden"
                role="listbox"
              >
                {searching ? (
                  <p className="px-4 py-3 text-sm text-secondary">Searching your StudyTrack...</p>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto py-1">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.page}-${result.id}`}
                        type="button"
                        onClick={() => selectSearchResult(result)}
                        className="w-full text-left px-4 py-2.5 hover:surface-tertiary transition-colors"
                        role="option"
                      >
                        <span className="block text-sm font-medium text-primary truncate">{result.title}</span>
                        <span className="block text-xs text-tertiary mt-0.5">{result.detail}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-sm text-secondary">No matching subjects, topics, tasks, notes, flashcards or events.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              className="btn btn-primary !px-3"
              title="Open Study AI"
            >
              <Bot size={18} />
              <span className="hidden sm:inline">Study AI</span>
            </button>
            <button onClick={toggleTheme} className="btn-ghost btn !p-2" title="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button type="button" onClick={() => setPage('settings')}
              className="w-9 h-9 rounded-full overflow-hidden bg-brand-500 text-white flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-transparent hover:ring-brand-400 transition-all"
              title="Open profile settings" aria-label="Open profile settings">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Your profile" className="w-full h-full object-cover" /> : (profile?.display_name?.trim()?.charAt(0).toUpperCase() || 'U')}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={page} className="animate-fade-in">{renderPage()}</div>
        </main>
      </div>

      {/* AI Assistant drawer */}
      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
