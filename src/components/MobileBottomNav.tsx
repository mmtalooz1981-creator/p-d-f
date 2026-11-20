import { Image as ImageIcon, PenLine, Scissors } from 'lucide-react';
import type { ToolTab } from '../types/pdf';

interface MobileBottomNavProps {
  activeTab: ToolTab;
  onSelectTab: (tab: ToolTab) => void;
}

export function MobileBottomNav({ activeTab, onSelectTab }: MobileBottomNavProps) {
  const items: Array<{ id: ToolTab; label: string; icon: typeof Scissors }> = [
    { id: 'split', label: 'تجزئة', icon: Scissors },
    { id: 'png', label: 'صور PNG', icon: ImageIcon },
    { id: 'watermark', label: 'علامة مائية', icon: PenLine },
  ];

  return (
    <nav
      aria-label="شريط التنقل السفلي"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 h-14 px-2 grid grid-cols-3"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1565C0] ${
              isSelected ? 'text-[#1565C0] font-semibold' : 'text-slate-600'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
