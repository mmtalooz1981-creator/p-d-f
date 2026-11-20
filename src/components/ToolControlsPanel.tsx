import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Info,
  PenLine,
  Scissors,
  Sparkles,
  Upload,
} from 'lucide-react';
import type {
  ParsedPageRange,
  StatusFeedback,
  ToolTab,
  WatermarkConfig,
  WatermarkPosition,
} from '../types/pdf';
import { formatFileSize } from '../utils/pdfEngine';

interface ToolControlsPanelProps {
  activeTab: ToolTab;
  onSelectTab: (tab: ToolTab) => void;
  fileName: string;
  fileSize: number;
  totalPages: number;
  hasFile: boolean;
  isBusy: boolean;
  progress: number;
  status: StatusFeedback;

  // Split state
  ranges: string;
  onChangeRanges: (val: string) => void;
  parsedRanges: ParsedPageRange[];
  rangesError: string | null;
  onRunSplit: () => void;

  // PNG state
  pngScale: number;
  onChangePngScale: (scale: number) => void;
  pngPageFrom: string;
  pngPageTo: string;
  onChangePngPageFrom: (val: string) => void;
  onChangePngPageTo: (val: string) => void;
  onRunPngConvert: () => void;

  // Watermark state
  watermarkConfig: WatermarkConfig;
  onChangeWatermark: (next: Partial<WatermarkConfig>) => void;
  onRunWatermark: () => void;

  // File actions
  onPickFile: () => void;
  onLoadSample: () => void;
}

const WATERMARK_POSITIONS: Array<{ id: WatermarkPosition; label: string }> = [
  { id: 'diagonal', label: 'قطري' },
  { id: 'tiled', label: 'متكرر' },
  { id: 'center', label: 'المنتصف' },
  { id: 'top', label: 'ترويسة' },
  { id: 'bottom', label: 'تذييل' },
];

const WATERMARK_COLORS: Array<{ hex: string; label: string }> = [
  { hex: '#1565C0', label: 'أزرق رسمي' },
  { hex: '#0F172A', label: 'أسود داكن' },
  { hex: '#64748B', label: 'رمادي هادئ' },
  { hex: '#DC2626', label: 'أحمر ختم' },
  { hex: '#15803D', label: 'أخضر اعتماد' },
];

export function ToolControlsPanel({
  activeTab,
  onSelectTab,
  fileName,
  fileSize,
  totalPages,
  hasFile,
  isBusy,
  progress,
  status,
  ranges,
  onChangeRanges,
  parsedRanges,
  rangesError,
  onRunSplit,
  pngScale,
  onChangePngScale,
  pngPageFrom,
  pngPageTo,
  onChangePngPageFrom,
  onChangePngPageTo,
  onRunPngConvert,
  watermarkConfig,
  onChangeWatermark,
  onRunWatermark,
  onPickFile,
  onLoadSample,
}: ToolControlsPanelProps) {
  const applyHalfPreset = () => {
    if (totalPages < 2) {
      onChangeRanges('1');
      return;
    }
    const mid = Math.ceil(totalPages / 2);
    onChangeRanges(`1-${mid},${mid + 1}-${totalPages}`);
  };

  const applyEveryPagePreset = () => {
    if (totalPages <= 0) return;
    const cap = Math.min(totalPages, 30);
    onChangeRanges(Array.from({ length: cap }, (_, i) => i + 1).join(','));
  };

  const applyFirstPagePreset = () => {
    onChangeRanges('1');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
      {/* Section 1: Active File Summary */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-center text-[#1565C0] shrink-0 mt-0.5">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">الملف النشط</p>
              <p
                className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5"
                dir="auto"
                title={fileName}
              >
                {fileName}
              </p>
              {hasFile ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 mt-1">
                  <span className="tabular-nums">عدد الصفحات: {totalPages}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{formatFileSize(fileSize)}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  اختر ملف PDF من جهازك أو جرّب الملف النموذجي
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onPickFile}
            disabled={isBusy}
            className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1565C0] hover:bg-[#0D47A1] disabled:opacity-50 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{hasFile ? 'تغيير الملف' : 'اختيار ملف PDF'}</span>
          </button>

          {!hasFile && (
            <button
              type="button"
              onClick={onLoadSample}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
            >
              <Sparkles className="w-4 h-4 text-[#1565C0]" aria-hidden="true" />
              <span>ملف نموذجي</span>
            </button>
          )}
        </div>

        {/* Progress indicator matching LinearProgressIndicator */}
        {isBusy && (
          <div className="mt-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span>جارٍ المعالجة...</span>
              <span className="font-mono tabular-nums font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1565C0] transition-all duration-150"
                style={{ width: `${Math.max(8, progress)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Segmented Tool Selector */}
      <div className="p-4 sm:px-6 bg-[#F8FAFC]/60">
        <div
          role="tablist"
          aria-label="اختيار الأداة"
          className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'split', label: 'تجزئة', icon: Scissors },
              { id: 'png', label: 'صور PNG', icon: ImageIcon },
              { id: 'watermark', label: 'علامة مائية', icon: PenLine },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => onSelectTab(tab.id)}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] ${
                  selected
                    ? 'bg-white text-[#1565C0] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Active Tool Form */}
      <div className="p-5 sm:p-6">
        {activeTab === 'split' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">تجزئة ملف PDF</h1>
              <p className="text-sm text-slate-600 mt-1">
                أدخل نطاقات الصفحات مفصولة بفاصلة لإنشاء ملف PDF مستقل لكل نطاق.
              </p>
            </div>

            <div>
              <label
                htmlFor="split-ranges-input"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                نطاقات الصفحات
              </label>
              <input
                id="split-ranges-input"
                type="text"
                dir="ltr"
                value={ranges}
                onChange={(e) => onChangeRanges(e.target.value)}
                placeholder="1-3,4-6,7-10"
                className="w-full px-3.5 py-2.5 text-sm font-mono text-left bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"
              />
              {hasFile && rangesError && (
                <p className="text-xs text-red-700 mt-1.5">{rangesError}</p>
              )}
              {hasFile && !rangesError && parsedRanges.length > 0 && (
                <p className="text-xs text-slate-600 mt-1.5 tabular-nums">
                  سيتم إنشاء {parsedRanges.length}{' '}
                  {parsedRanges.length === 1 ? 'ملف PDF' : 'ملفات PDF'}:{' '}
                  {parsedRanges.map((r) => `[${r.label}]`).join(' · ')}
                </p>
              )}
            </div>

            {hasFile && totalPages > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyHalfPreset}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  تقسيم إلى نصفين
                </button>
                <button
                  type="button"
                  onClick={applyEveryPagePreset}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  كل صفحة في ملف
                </button>
                <button
                  type="button"
                  onClick={applyFirstPagePreset}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  الصفحة الأولى فقط
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={isBusy || !hasFile || Boolean(rangesError)}
              onClick={onRunSplit}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#1565C0] hover:bg-[#0D47A1] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
            >
              <Scissors className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تنفيذ التجزئة</span>
            </button>
          </div>
        )}

        {activeTab === 'png' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">تحويل PDF إلى صور PNG</h1>
              <p className="text-sm text-slate-600 mt-1">
                تصدير صفحات المستند إلى صور PNG عالية الوضوح مع إمكانية تنزيلها فردياً أو كملف ZIP.
              </p>
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-800 mb-2">
                دقة التصدير
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { scale: 1, label: '1x قياسي' },
                  { scale: 2, label: '2x عالي' },
                  { scale: 3, label: '3x فائق' },
                ].map((opt) => (
                  <button
                    key={opt.scale}
                    type="button"
                    onClick={() => onChangePngScale(opt.scale)}
                    className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] ${
                      pngScale === opt.scale
                        ? 'bg-[#1565C0]/10 border-[#1565C0] text-[#1565C0]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="png-from-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  من الصفحة
                </label>
                <input
                  id="png-from-input"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={pngPageFrom}
                  onChange={(e) => onChangePngPageFrom(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono text-center bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="png-to-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  إلى الصفحة
                </label>
                <input
                  id="png-to-input"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={pngPageTo}
                  onChange={(e) => onChangePngPageTo(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono text-center bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isBusy || !hasFile}
              onClick={onRunPngConvert}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#1565C0] hover:bg-[#0D47A1] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
            >
              <ImageIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تحويل إلى PNG بدقة {pngScale}x</span>
            </button>
          </div>
        )}

        {activeTab === 'watermark' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">إضافة نص أو علامة مائية عربية</h1>
              <p className="text-sm text-slate-600 mt-1">
                تضمين نص عربي مترابط بدقة عالية مع معاينة فورية قبل الحفظ.
              </p>
            </div>

            <div>
              <label
                htmlFor="watermark-text-input"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                النص المراد إضافته
              </label>
              <input
                id="watermark-text-input"
                type="text"
                value={watermarkConfig.text}
                onChange={(e) => onChangeWatermark({ text: e.target.value })}
                placeholder="موعد اللوز العبيدي"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="wm-from-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  من الصفحة
                </label>
                <input
                  id="wm-from-input"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={watermarkConfig.pageFrom}
                  onChange={(e) => onChangeWatermark({ pageFrom: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono text-center bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="wm-to-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  إلى الصفحة
                </label>
                <input
                  id="wm-to-input"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={watermarkConfig.pageTo}
                  onChange={(e) => onChangeWatermark({ pageTo: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono text-center bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                موضع العلامة المائية
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {WATERMARK_POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => onChangeWatermark({ position: pos.id })}
                    className={`py-1.5 px-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] ${
                      watermarkConfig.position === pos.id
                        ? 'bg-[#1565C0]/10 border-[#1565C0] text-[#1565C0]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="wm-opacity" className="font-semibold text-slate-700">
                    الشفافية
                  </label>
                  <span className="font-mono tabular-nums text-slate-600">
                    {Math.round(watermarkConfig.opacity * 100)}%
                  </span>
                </div>
                <input
                  id="wm-opacity"
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={watermarkConfig.opacity}
                  onChange={(e) =>
                    onChangeWatermark({ opacity: Number.parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#1565C0] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="wm-size" className="font-semibold text-slate-700">
                    حجم الخط
                  </label>
                  <span className="font-mono tabular-nums text-slate-600">
                    {watermarkConfig.fontSize} pt
                  </span>
                </div>
                <input
                  id="wm-size"
                  type="range"
                  min={18}
                  max={72}
                  step={2}
                  value={watermarkConfig.fontSize}
                  onChange={(e) =>
                    onChangeWatermark({ fontSize: Number.parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-[#1565C0] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">لون النص</span>
              <div className="flex items-center gap-2">
                {WATERMARK_COLORS.map((swatch) => {
                  const active = watermarkConfig.color === swatch.hex;
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      aria-label={swatch.label}
                      title={swatch.label}
                      onClick={() => onChangeWatermark({ color: swatch.hex })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#1565C0] ${
                        active ? 'border-slate-900 scale-110' : 'border-white ring-1 ring-slate-300'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={isBusy || !hasFile || !watermarkConfig.text.trim()}
              onClick={onRunWatermark}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#1565C0] hover:bg-[#0D47A1] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
            >
              <PenLine className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إضافة النص إلى الملف</span>
            </button>
          </div>
        )}
      </div>

      {/* Section 4: Accessible Status Feedback (Icon + Text, never hue-only) */}
      <div
        role="status"
        aria-live="polite"
        className={`px-5 py-3.5 rounded-b-xl flex items-start gap-2.5 text-sm font-semibold ${
          status.kind === 'error'
            ? 'bg-red-50/70 text-red-700'
            : status.kind === 'success'
              ? 'bg-emerald-50/70 text-[#15803D]'
              : 'bg-slate-50/70 text-slate-700'
        }`}
      >
        {status.kind === 'error' ? (
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        ) : status.kind === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#1565C0]" aria-hidden="true" />
        )}
        <span className="leading-snug">{status.text}</span>
      </div>
    </div>
  );
}
