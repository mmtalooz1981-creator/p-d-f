import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FileUp,
  Layers,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParsedPageRange, ToolTab, WatermarkConfig } from '../types/pdf';
import { normalizeNumericInput, renderPdfPagePreview } from '../utils/pdfEngine';

interface PdfPreviewStageProps {
  pdfBytes: Uint8Array | null;
  fileName: string;
  totalPages: number;
  currentPage: number;
  onChangePage: (page: number) => void;
  activeTab: ToolTab;
  parsedRanges: ParsedPageRange[];
  pngScale: number;
  watermarkConfig: WatermarkConfig;
  isBusy: boolean;
  onPickFile: () => void;
  onDropFile: (file: File) => void;
  onLoadSample: () => void;
}

export function PdfPreviewStage({
  pdfBytes,
  fileName,
  totalPages,
  currentPage,
  onChangePage,
  activeTab,
  parsedRanges,
  pngScale,
  watermarkConfig,
  isBusy,
  onPickFile,
  onDropFile,
  onLoadSample,
}: PdfPreviewStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageDimsPt, setPageDimsPt] = useState<{ width: number; height: number } | null>(null);
  const [canvasCssDims, setCanvasCssDims] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!pdfBytes || !canvasRef.current || !containerRef.current || totalPages <= 0) {
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setRenderError(null);

    const availableWidth = Math.max(260, containerRef.current.clientWidth - 48);

    renderPdfPagePreview(pdfBytes, currentPage, canvasRef.current, availableWidth)
      .then((dims) => {
        if (!cancelled) {
          setPageDimsPt({ width: dims.pageWidthPt, height: dims.pageHeightPt });
          if (canvasRef.current) {
            setCanvasCssDims({
              width: Number.parseFloat(canvasRef.current.style.width) || 0,
              height: Number.parseFloat(canvasRef.current.style.height) || 0,
            });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'تعذر عرض معاينة الصفحة');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRendering(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, currentPage, totalPages]);

  // Determine if current page falls inside the watermark target range
  const isWatermarkOnCurrentPage = useMemo(() => {
    if (activeTab !== 'watermark' || !watermarkConfig.text.trim()) return false;
    const from = Number.parseInt(normalizeNumericInput(watermarkConfig.pageFrom), 10);
    const to = Number.parseInt(normalizeNumericInput(watermarkConfig.pageTo), 10);
    if (Number.isNaN(from) || Number.isNaN(to)) return true;
    return currentPage >= from && currentPage <= to;
  }, [activeTab, watermarkConfig, currentPage]);

  // Compute proportional font size for live preview overlay relative to PDF page points
  const liveWatermarkFontPx = useMemo(() => {
    if (!pageDimsPt || !canvasCssDims.width || pageDimsPt.width <= 0) {
      return watermarkConfig.fontSize;
    }
    const ratio = canvasCssDims.width / pageDimsPt.width;
    return Math.max(10, Math.round(watermarkConfig.fontSize * ratio));
  }, [pageDimsPt, canvasCssDims.width, watermarkConfig.fontSize]);

  // Find which split group(s) include the current page
  const activeSplitGroups = useMemo(() => {
    if (activeTab !== 'split' || parsedRanges.length === 0) return [];
    return parsedRanges
      .map((r, idx) => ({ ...r, partNumber: idx + 1 }))
      .filter((r) => currentPage >= r.start && currentPage <= r.end);
  }, [activeTab, parsedRanges, currentPage]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onDropFile(dropped);
    }
  };

  const contextSummary = useMemo(() => {
    if (!pdfBytes) return null;
    if (activeTab === 'split') {
      if (activeSplitGroups.length > 0) {
        const labels = activeSplitGroups
          .map((g) => `الجزء ${g.partNumber} (${g.label})`)
          .join('، ');
        return `مشمولة في التجزئة: ${labels}`;
      }
      return 'هذه الصفحة غير مشمولة في النطاقات المحددة حالياً';
    }
    if (activeTab === 'png' && pageDimsPt) {
      const outW = Math.round(pageDimsPt.width * pngScale);
      const outH = Math.round(pageDimsPt.height * pngScale);
      return `دقة التصدير المتوقعة: ${outW} × ${outH} بكسل (${pngScale}x)`;
    }
    if (activeTab === 'watermark') {
      return isWatermarkOnCurrentPage
        ? 'معاينة فورية للعلامة المائية العربية على هذه الصفحة'
        : 'هذه الصفحة خارج نطاق تطبيق العلامة المائية المحدد';
    }
    return null;
  }, [pdfBytes, activeTab, activeSplitGroups, pageDimsPt, pngScale, isWatermarkOnCurrentPage]);

  return (
    <section
      aria-label="معاينة المستند"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-white border rounded-xl flex flex-col min-h-[540px] lg:min-h-[680px] transition-colors duration-150 ${
        isDragging ? 'border-[#1565C0] bg-[#1565C0]/[0.02]' : 'border-slate-200'
      }`}
    >
      {/* Stage Top Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 truncate">
            {pdfBytes ? `معاينة: ${fileName}` : 'منطقة معاينة المستند'}
          </h2>
          {contextSummary && (
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{contextSummary}</p>
          )}
        </div>

        {pdfBytes && totalPages > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangePage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              aria-label="الصفحة السابقة"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="font-mono text-xs font-medium text-slate-700 tabular-nums px-2 whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              aria-label="الصفحة التالية"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Stage Viewport */}
      <div
        ref={containerRef}
        className="flex-1 bg-[#F8FAFC] p-5 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden rounded-b-xl"
      >
        {!pdfBytes ? (
          <div className="max-w-md w-full text-center py-8 px-4">
            <div className="w-14 h-14 mx-auto rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#1565C0] mb-5">
              <FileUp className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              اسحب ملف PDF وأفلته هنا للبدء
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              تتم معالجة جميع الملفات محلياً داخل متصفحك بسرعة وأمان دون رفع مستنداتك إلى أي خادم خارجي.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onPickFile}
                disabled={isBusy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1565C0] hover:bg-[#0D47A1] rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>اختيار ملف PDF</span>
              </button>
              <button
                type="button"
                onClick={onLoadSample}
                disabled={isBusy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1565C0]"
              >
                <Sparkles className="w-4 h-4 text-[#1565C0]" aria-hidden="true" />
                <span>تجربة بملف نموذجي (6 صفحات)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-5">
            {/* Rendered PDF Page Paper Frame */}
            <div className="relative bg-white border border-slate-200 shadow-sm overflow-hidden max-w-full">
              <canvas ref={canvasRef} className="block max-w-full h-auto" />

              {/* Live Arabic Watermark Preview Overlay */}
              {isWatermarkOnCurrentPage && canvasCssDims.width > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden select-none"
                  style={{
                    color: watermarkConfig.color,
                    opacity: watermarkConfig.opacity,
                    fontFamily: '"Cairo", "IBM Plex Sans Arabic", sans-serif',
                    fontWeight: 700,
                    fontSize: `${liveWatermarkFontPx}px`,
                    lineHeight: 1.35,
                  }}
                >
                  {watermarkConfig.position === 'diagonal' && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="-rotate-[35deg] text-center whitespace-pre-line px-4">
                        {watermarkConfig.text}
                      </div>
                    </div>
                  )}
                  {watermarkConfig.position === 'center' && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center whitespace-pre-line px-4">
                        {watermarkConfig.text}
                      </div>
                    </div>
                  )}
                  {watermarkConfig.position === 'top' && (
                    <div className="w-full pt-[6%] flex justify-center">
                      <div className="text-center whitespace-pre-line px-4">
                        {watermarkConfig.text}
                      </div>
                    </div>
                  )}
                  {watermarkConfig.position === 'bottom' && (
                    <div className="w-full h-full pb-[6%] flex items-end justify-center">
                      <div className="text-center whitespace-pre-line px-4">
                        {watermarkConfig.text}
                      </div>
                    </div>
                  )}
                  {watermarkConfig.position === 'tiled' && (
                    <div className="absolute -inset-1/3 grid grid-cols-3 gap-10 place-items-center -rotate-[30deg]">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <span key={i} className="text-center whitespace-nowrap">
                          {watermarkConfig.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isRendering && (
                <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1565C0]" aria-hidden="true" />
                    <span>جارٍ عرض الصفحة...</span>
                  </div>
                </div>
              )}

              {renderError && (
                <div className="p-6 text-center text-sm text-red-700">{renderError}</div>
              )}
            </div>

            {/* Interactive Page Switcher Strip (up to 16 pages directly clickable) */}
            {totalPages > 1 && (
              <div className="w-full max-w-[680px]">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>انتقال سريع بين الصفحات</span>
                  </span>
                  {pageDimsPt && (
                    <span className="font-mono tabular-nums">
                      {pageDimsPt.width} × {pageDimsPt.height} pt
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.from({ length: Math.min(totalPages, 24) }).map((_, idx) => {
                    const p = idx + 1;
                    const isSelected = p === currentPage;
                    const inSplit =
                      activeTab === 'split' &&
                      parsedRanges.some((r) => p >= r.start && p <= r.end);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onChangePage(p)}
                        className={`min-w-[34px] h-8 px-2 text-xs font-mono tabular-nums rounded-md border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] ${
                          isSelected
                            ? 'bg-[#1565C0] text-white border-[#1565C0] font-semibold'
                            : inSplit
                              ? 'bg-[#1565C0]/10 text-[#1565C0] border-[#1565C0]/30 hover:bg-[#1565C0]/15'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  {totalPages > 24 && (
                    <span className="text-xs text-slate-500 px-2 tabular-nums">
                      + {totalPages - 24} صفحة أخرى
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
