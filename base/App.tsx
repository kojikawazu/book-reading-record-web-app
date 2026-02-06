
import React, { useState, useEffect } from 'react';
import { ORGANIC_CRAFT_THEME, MENU_ITEMS } from './constants';
import { 
  BookOpen, 
  Settings, 
  ChevronRight, 
  PenTool, 
  Info, 
  Search, 
  ExternalLink,
  MessageSquare,
  BarChart3,
  Bookmark,
  Home,
  Target,
  Users,
  Bell,
  Heart,
  ArrowLeft,
  X,
  Trash2,
  Save,
  Check,
  Calendar,
  Tag,
  Share2,
  ArrowUpRight,
  Zap,
  Clock,
  LogOut,
  Camera,
  Award,
  Globe,
  Lock,
  Mail
} from 'lucide-react';

const IconMap: Record<string, any> = {
  Home,
  PenTool,
  BookOpen,
  BarChart3,
  Target,
  Bookmark,
  Users,
  Search,
  Settings,
  Info
};

type ViewState = 'login' | 'dashboard' | 'create' | 'edit' | 'details' | 'stats' | 'library' | 'progress' | 'settings';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<ViewState>('login');
  const [activeMenu, setActiveMenu] = useState('home');
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const theme = ORGANIC_CRAFT_THEME;

  useEffect(() => {
    document.body.className = `${theme.fontFamily} transition-all duration-500`;
  }, [theme]);

  const handleMenuClick = (id: string) => {
    setActiveMenu(id);
    switch(id) {
      case 'home': setView('dashboard'); break;
      case 'library': setView('library'); break;
      case 'stats': setView('stats'); break;
      case 'goals': setView('progress'); break;
      case 'settings': setView('settings'); break;
      case 'logs': setView('create'); break;
      default: setView('dashboard');
    }
  };

  if (!isLoggedIn && view === 'login') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-[#f7f3f0] via-[#eae3db] to-[#d8c8a1]">
        <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-1000">
          <div className="bg-white/40 backdrop-blur-2xl p-12 rounded-[48px] shadow-2xl shadow-[#3d405b]/10 border border-white/40 text-center">
            <div className={`w-20 h-20 ${theme.colors.primary} ${theme.styles.borderRadius} flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-[#81b29a]/30`}>
              <BookOpen size={40} />
            </div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">LeafLog</h1>
            <p className="text-sm opacity-60 mb-10 font-medium">思考の森へようこそ</p>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); setView('dashboard'); }}>
              <div className="relative"><Mail className="absolute left-5 top-5 opacity-20" size={18} /><input type="email" placeholder="メールアドレス" className="w-full pl-14 pr-6 py-5 bg-white/60 border-none outline-none rounded-3xl text-sm focus:ring-2 ring-[#81b29a]/30 transition-all" /></div>
              <div className="relative"><Lock className="absolute left-5 top-5 opacity-20" size={18} /><input type="password" placeholder="パスワード" className="w-full pl-14 pr-6 py-5 bg-white/60 border-none outline-none rounded-3xl text-sm focus:ring-2 ring-[#81b29a]/30 transition-all" /></div>
              <button className={`w-full py-5 ${theme.colors.primary} text-white font-bold text-sm uppercase tracking-widest rounded-3xl shadow-lg shadow-[#81b29a]/40 hover:scale-[1.02] transition-all`}>ログインする</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const InputField = ({ label, placeholder, type = "text" }: any) => (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">{label}</label>
      <input type={type} placeholder={placeholder} className={`w-full px-6 py-4 bg-[#f7f3f0] border-none outline-none text-sm ${theme.styles.borderRadius} focus:ring-2 ring-[#81b29a]/30 transition-all`} />
    </div>
  );

  return (
    <div className={`flex h-screen w-full overflow-hidden ${theme.colors.bg} ${theme.colors.text}`}>
      {/* Sidebar */}
      <aside className={`w-80 flex flex-col shrink-0 ${theme.colors.sidebar} p-6`}>
        <div className="flex items-center gap-4 mb-10 px-4">
          <div className={`w-12 h-12 ${theme.colors.primary} ${theme.styles.borderRadius} flex items-center justify-center text-white shadow-lg shadow-[#81b29a]/30`}><BookOpen size={28} /></div>
          <div><h1 className="text-xl font-bold tracking-tight">LeafLog</h1><span className="text-[10px] uppercase opacity-40 tracking-widest font-bold">Organic Output</span></div>
        </div>
        <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-30 mb-6 px-6 font-bold">Menu</p>
          {MENU_ITEMS.map(item => {
            const Icon = IconMap[item.icon];
            const isActive = activeMenu === item.id;
            return (
              <button key={item.id} onClick={() => handleMenuClick(item.id)} className={`w-full flex items-center justify-between px-6 py-4 mb-2 text-sm font-medium transition-all group ${isActive ? `${theme.colors.primary} text-white shadow-md shadow-[#81b29a]/20` : `hover:bg-white/40`} ${theme.styles.borderRadius}`}>
                <div className="flex items-center gap-4"><Icon size={20} className={isActive ? 'text-white' : 'opacity-60'} /><span>{item.name}</span></div>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </nav>
        <button onClick={() => { setIsLoggedIn(false); setView('login'); }} className="w-full flex items-center gap-4 px-6 py-4 text-sm font-bold opacity-40 hover:opacity-100 transition-opacity mt-8"><LogOut size={18} /><span>ログアウト</span></button>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-24 flex items-center justify-between px-10 shrink-0 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-10">
            <h2 className="text-2xl font-bold capitalize">{view === 'dashboard' ? 'Home' : view}</h2>
            <div className="flex items-center gap-3 px-5 py-3 bg-[#f7f3f0] rounded-full min-w-[320px]"><Search size={18} className="opacity-40" /><input type="text" placeholder="思考を検索..." className="bg-transparent border-none outline-none text-sm w-full placeholder:opacity-40" /></div>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative p-3 hover:bg-[#f7f3f0] rounded-full transition-colors"><Bell size={22} className="opacity-60" /><span className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full border-2 border-white"></span></button>
            <div className="w-px h-8 bg-[#3d405b]/10"></div>
            <button onClick={() => setView('settings')} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block"><p className="text-sm font-bold leading-none mb-1">Senior Engineer</p><p className="text-[10px] opacity-50 font-bold uppercase tracking-wider">Pro Plan</p></div>
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Profile" className={`w-12 h-12 ${theme.styles.borderRadius} bg-stone-100 p-1`} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-10 pb-10">
          <div className="max-w-6xl mx-auto py-4">
            
            {/* Dashboard */}
            {view === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <section className="mb-10">
                  <div className="bg-[#81b29a] text-white p-12 rounded-[48px] relative overflow-hidden shadow-2xl shadow-[#81b29a]/20">
                    <div className="relative z-10 max-w-lg">
                      <h3 className="text-4xl font-bold mb-6 leading-tight">素晴らしい読書体験を、<br />確かな成長へ。</h3>
                      <button onClick={() => setView('create')} className="bg-white text-[#81b29a] px-10 py-4 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg">新しい記録を始める</button>
                    </div>
                    <BookOpen size={240} className="absolute right-[-20px] bottom-[-40px] text-white/10 -rotate-12" />
                  </div>
                </section>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xl font-bold">最近の記録</h3>
                    {[1, 2].map(i => (
                      <div key={i} className="bg-white p-6 rounded-[32px] flex gap-6 hover:translate-y-[-2px] transition-all cursor-pointer shadow-sm" onClick={() => { setSelectedId(i); setView('details'); }}>
                        <img src={`https://picsum.photos/seed/b${i}/100/140`} className="w-24 h-32 object-cover rounded-2xl" />
                        <div className="flex-1"><span className="text-[10px] font-bold text-[#81b29a] uppercase tracking-widest">Engineering</span><h4 className="text-lg font-bold mb-2">Technical Insight {i}</h4><p className="text-xs opacity-60 line-clamp-2">思考の断片を記録に残しましょう...</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm">
                    <h3 className="font-bold mb-6 flex items-center gap-2"><Award size={20} className="text-orange-400" /> 今週のバッジ</h3>
                    <div className="flex flex-wrap gap-4"><div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 shadow-inner"><Zap size={24} /></div><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 shadow-inner"><BookOpen size={24} /></div></div>
                  </div>
                </div>
              </div>
            )}

            {/* Library View */}
            {view === 'library' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h3 className="text-3xl font-bold tracking-tight mb-10">あなたのライブラリ</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                    <div key={i} className="group cursor-pointer" onClick={() => { setSelectedId(i); setView('details'); }}>
                      <div className="aspect-[3/4] rounded-[32px] overflow-hidden mb-4 shadow-md group-hover:shadow-xl transition-all"><img src={`https://picsum.photos/seed/lib${i}/400/600`} className="w-full h-full object-cover" /></div>
                      <h4 className="text-sm font-bold line-clamp-1">Library Book {i}</h4>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress View */}
            {view === 'progress' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-4xl font-bold mb-12">Intellectual Growth</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="bg-white p-10 rounded-[48px] shadow-sm"><h3 className="text-xl font-bold mb-8">読書タイムライン</h3>
                    <div className="space-y-8 relative"><div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#81b29a]/20"></div>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-6 relative"><div className="w-6 h-6 rounded-full border-4 border-white bg-[#81b29a] shadow-sm z-10"></div>
                          <div><span className="text-[10px] font-bold opacity-30">11/{20+i}</span><h4 className="font-bold">Book Achievement {i}</h4></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#3d405b] text-white p-10 rounded-[48px] shadow-lg"><h3 className="text-xl font-bold mb-6">現在の目標</h3>
                    <div className="p-8 rounded-[32px] bg-white/5 border border-white/5"><div className="flex justify-between mb-4"><span className="text-sm font-bold opacity-60">年間50冊読了</span><span className="text-sm font-bold">24 / 50</span></div>
                      <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden"><div className="bg-[#81b29a] h-full w-[48%] rounded-full shadow-[0_0_15px_rgba(129,178,154,0.5)]"></div></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Statistics View (Restored!) */}
            {view === 'stats' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-12"><h2 className="text-4xl font-bold mb-2">Reading Analytics</h2><p className="opacity-60">知的好奇心の軌跡を可視化します。</p></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                  {[
                    { label: '総読了数', val: '24', icon: BookOpen, color: 'text-blue-500' },
                    { label: '総アウトプット', val: '156', icon: PenTool, color: 'text-emerald-500' },
                    { label: '継続日数', val: '42', icon: Zap, color: 'text-orange-500' },
                    { label: '今月の進捗', val: '65', icon: BarChart3, color: 'text-purple-500' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[40px] shadow-sm border border-[#3d405b]/5"><stat.icon size={20} className={`${stat.color} mb-4`} /><p className="text-xs font-bold opacity-40 uppercase mb-1">{stat.label}</p><span className="text-4xl font-bold">{stat.val}</span></div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 bg-white rounded-[48px] p-10 shadow-sm">
                    <h3 className="text-xl font-bold mb-10">月間読書ボリューム</h3>
                    <div className="h-64 flex items-end justify-between gap-4">
                      {[40, 65, 30, 85, 50, 95, 75].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-4">
                          <div className="w-full bg-[#81b29a]/20 rounded-full relative overflow-hidden h-full">
                            <div className="absolute bottom-0 w-full bg-[#81b29a] transition-all duration-1000" style={{ height: `${h}%` }}></div>
                          </div>
                          <span className="text-[10px] font-bold opacity-30 uppercase">{['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#3d405b] text-white rounded-[48px] p-10 shadow-lg">
                    <h3 className="text-xl font-bold mb-8">カテゴリー分布</h3>
                    <div className="space-y-6">
                      {[{ name: 'Engineering', p: 45 }, { name: 'Philosophy', p: 25 }, { name: 'Design', p: 20 }, { name: 'Others', p: 10 }].map((c, i) => (
                        <div key={i}><div className="flex justify-between text-xs font-bold mb-2"><span className="opacity-60">{c.name}</span><span>{c.p}%</span></div>
                          <div className="w-full bg-white/10 h-1.5 rounded-full"><div className="bg-[#81b29a] h-full rounded-full" style={{ width: `${c.p}%` }}></div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create/Edit View */}
            {(view === 'create' || view === 'edit') && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
                <div className="bg-white p-12 rounded-[48px] shadow-2xl relative overflow-hidden">
                  <div className="mb-12"><span className="text-xs font-bold uppercase tracking-[0.3em] text-[#81b29a] mb-2 block">Create Record</span><h2 className="text-4xl font-bold">{view === 'create' ? '新しい思考の記録' : '記録を再構成する'}</h2></div>
                  <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><InputField label="Book Title" placeholder="タイトルを入力..." /><InputField label="Author" placeholder="著者名..." /></div>
                    <div className="space-y-2"><label className="text-xs font-bold opacity-40 ml-4 uppercase tracking-widest">Logs</label><textarea rows={8} className="w-full px-8 py-6 bg-[#f7f3f0] rounded-[40px] outline-none text-sm resize-none"></textarea></div>
                    <div className="flex items-center justify-between pt-8 border-t border-[#3d405b]/5">
                      <button type="button" onClick={() => setView('dashboard')} className="flex items-center gap-2 text-sm font-bold opacity-40 hover:opacity-100 transition-opacity"><X size={18} /> キャンセル</button>
                      <button type="button" onClick={() => setView('dashboard')} className={`flex items-center gap-2 px-10 py-4 ${theme.colors.primary} text-white font-bold text-sm uppercase tracking-widest rounded-3xl shadow-lg shadow-[#81b29a]/30`}><Save size={16} /> 保存する</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Settings View */}
            {view === 'settings' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
                <div className="bg-white p-12 rounded-[48px] shadow-sm">
                  <div className="flex items-center gap-8 mb-12">
                     <div className="relative group"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-24 h-24 rounded-[32px] bg-stone-100 p-2" /><button className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[32px] text-white"><Camera size={24} /></button></div>
                     <div><h3 className="text-2xl font-bold">アカウント設定</h3><p className="text-sm opacity-40">プロフィールの管理</p></div>
                  </div>
                  <div className="space-y-8"><InputField label="Name" placeholder="Senior Engineer" /><InputField label="Email" placeholder="engineer@leaflog.art" />
                    <button className={`w-full py-4 ${theme.colors.primary} text-white font-bold text-sm uppercase tracking-widest rounded-3xl`}>設定を保存</button>
                  </div>
                </div>
              </div>
            )}

            {/* Details View */}
            {view === 'details' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl mx-auto">
                <button onClick={() => setView('dashboard')} className="mb-8 flex items-center gap-2 text-sm font-bold text-[#81b29a]"><ArrowLeft size={16}/> 戻る</button>
                <div className="bg-white p-12 rounded-[48px] shadow-sm">
                   <div className="flex flex-col md:flex-row gap-10">
                      <img src={`https://picsum.photos/seed/b${selectedId || 1}/300/400`} className="w-64 h-80 object-cover rounded-[32px] shadow-xl" />
                      <div>
                        <h2 className="text-4xl font-bold mb-6">Clean Code Insights</h2>
                        <p className="opacity-60 leading-relaxed text-lg mb-8">読みやすいコードは、チームの生産性を向上させます。関数のサイズを小さく保ち、名前付けにこだわり、コメントを最小限にする...</p>
                        <div className="flex gap-4">
                           <button onClick={() => setView('edit')} className="px-8 py-3 bg-[#81b29a] text-white rounded-full font-bold text-sm">編集</button>
                           <button onClick={() => setIsDeleting(true)} className="px-8 py-3 border border-red-200 text-red-500 rounded-full font-bold text-sm">削除</button>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

          </div>
        </main>

        <footer className={`h-20 shrink-0 flex items-center justify-between px-10 text-[10px] font-bold uppercase tracking-[0.3em] ${theme.colors.footer} text-white/40 transition-colors duration-500`}>
          <div>© 2024 LeafLog Organic Design</div>
          <div className="flex items-center gap-8"><a href="#" className="hover:text-white flex items-center gap-2">プライバシー <ExternalLink size={12} /></a><a href="#" className="hover:text-white flex items-center gap-2">利用規約 <ExternalLink size={12} /></a></div>
        </footer>
      </div>

      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#3d405b]/20 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white max-w-md w-full p-10 rounded-[48px] shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={36} /></div>
            <h3 className="text-2xl font-bold mb-4">記録を森に返しますか？</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => setIsDeleting(false)} className="w-full py-4 bg-red-500 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-3xl">削除を確定する</button>
              <button onClick={() => setIsDeleting(false)} className="w-full py-4 text-[#3d405b] font-bold text-xs uppercase tracking-[0.2em] opacity-40">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
