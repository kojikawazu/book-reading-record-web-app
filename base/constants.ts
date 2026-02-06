
import { ThemeConfig } from './types';

export const ORGANIC_CRAFT_THEME: ThemeConfig = {
  id: 'organic-craft',
  name: 'Organic Craft',
  description: '自然との調和。アースカラーと柔らかな曲線が織りなす心地よさ。',
  fontFamily: 'font-sans',
  colors: {
    bg: 'bg-[#f7f3f0]',
    sidebar: 'bg-[#eae3db]',
    header: 'bg-white',
    footer: 'bg-[#3d405b]',
    primary: 'bg-[#81b29a]',
    text: 'text-[#3d405b]',
    card: 'bg-white shadow-xl shadow-[#3d405b]/5'
  },
  styles: {
    borderRadius: 'rounded-[40px]',
    borderWidth: 'border-none',
    shadow: 'shadow-md',
    spacing: 'p-8'
  }
};

export const MENU_ITEMS = [
  { id: 'home', name: 'ホーム', icon: 'Home' },
  { id: 'logs', name: '読書記録', icon: 'PenTool' },
  { id: 'library', name: 'ライブラリ', icon: 'BookOpen' },
  { id: 'stats', name: '統計レポート', icon: 'BarChart3' },
  { id: 'goals', name: '読書目標', icon: 'Target' },
  { id: 'bookmarks', name: 'ブックマーク', icon: 'Bookmark' },
  { id: 'community', name: 'コミュニティ', icon: 'Users' },
  { id: 'discover', name: '新しい本を探す', icon: 'Search' },
  { id: 'settings', name: '基本設定', icon: 'Settings' },
  { id: 'help', name: 'ヘルプ・FAQ', icon: 'Info' }
];
