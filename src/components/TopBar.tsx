import { Upload } from 'lucide-react';
import type { ToolTab } from '../types/pdf';

interface TopBarProps {
  activeTab: ToolTab;
  onSelectTab: (tab: ToolTab) => void;
  onPickFile: () => void;
  onScrollToOutputs: () => void;
  outputCount: number;
  isBusy: boolean;
}

export function TopBar({
  activeTab,
  onSelectTab,
  onPickFile,
  onScrollToOutputs,
  outputCount,
  isBusy,
}: TopBarProps) {
  const navItems: Array<{ id: ToolTab; label: string }> = [
    { id: 'split', label: 'تجزئة الملف' },
    { id: 'png', label: 'صور PNG' },
    { id: 'watermark', label: 'علامة مائية' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 md:sticky md:top-0 z-30">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#workspace"
          className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#1565C0] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] rounded"
        >
          موعد اللوز PDF PRO
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="أدوات المعالجة"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] rounded-sm ${
                  isActive
                    ? 'text-[#1565C0] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1565C0]"
                  />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onScrollToOutputs}
            className="relative py-5 text-slate-600 hover:text-slate-900 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] rounded-sm"
          >
            الملفات الناتجة{outputCount > 0 ? ` (${outputCount})` : ''}
          </button>
        </nav>

        {/* Zone 3: Single primary action CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPickFile}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1565C0] hover:bg-[#0D47A1] disabled:opacity-50 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>اختيار PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
