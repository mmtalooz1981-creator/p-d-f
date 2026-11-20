import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OutputsPanel } from './components/OutputsPanel';
import { PdfPreviewStage } from './components/PdfPreviewStage';
import { ToolControlsPanel } from './components/ToolControlsPanel';
import { TopBar } from './components/TopBar';
import type {
  OutputFile,
  ParsedPageRange,
  StatusFeedback,
  ToolTab,
  WatermarkConfig,
} from './types/pdf';
import {
  addArabicWatermarkToPdf,
  convertPdfToPngImages,
  createSampleArabicPdf,
  inspectPdfBytes,
  normalizeNumericInput,
  parsePageRanges,
  splitPdfDocument,
} from './utils/pdfEngine';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ToolTab>('split');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('لم يتم اختيار ملف');
  const [fileSize, setFileSize] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<StatusFeedback>({
    kind: 'info',
    text: 'مرحباً بك في موعد اللوز PDF PRO',
  });

  // Tool states matching MuedPdfProApp defaults
  const [ranges, setRanges] = useState<string>('1-3,4-6');
  const [pngScale, setPngScale] = useState<number>(2);
  const [pngPageFrom, setPngPageFrom] = useState<string>('1');
  const [pngPageTo, setPngPageTo] = useState<string>('1');

  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    text: 'موعد اللوز العبيدي',
    pageFrom: '1',
    pageTo: '1',
    position: 'diagonal',
    opacity: 0.25,
    fontSize: 42,
    color: '#1565C0',
  });

  const [lastOutputs, setLastOutputs] = useState<OutputFile[]>([]);

  // Revoke object URLs on unmount to avoid memory leaks
  const outputsRef = useRef<OutputFile[]>([]);
  outputsRef.current = lastOutputs;
  useEffect(() => {
    return () => {
      outputsRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    };
  }, []);

  const replaceOutputs = useCallback((next: OutputFile[]) => {
    setLastOutputs((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url));
      return next;
    });
  }, []);

  const loadBytesIntoWorkspace = useCallback(async (bytes: Uint8Array, resolvedName: string) => {
    setIsBusy(true);
    setProgress(20);
    try {
      const { pageCount } = await inspectPdfBytes(bytes);
      setPdfBytes(bytes);
      setFileName(resolvedName);
      setFileSize(bytes.byteLength);
      setTotalPages(pageCount);
      setCurrentPage(1);

      // Update default page bounds cleanly
      const defaultSplit =
        pageCount >= 6
          ? '1-3,4-6'
          : pageCount >= 2
            ? `1-${Math.ceil(pageCount / 2)},${Math.ceil(pageCount / 2) + 1}-${pageCount}`
            : '1';
      setRanges(defaultSplit);
      setPngPageFrom('1');
      setPngPageTo(String(pageCount));
      setWatermarkConfig((prev) => ({
        ...prev,
        pageFrom: '1',
        pageTo: String(pageCount),
      }));

      setProgress(100);
      setStatus({
        kind: 'success',
        text: `تم اختيار الملف بنجاح (${pageCount} صفحة)`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: `خطأ في فتح الملف: ${err instanceof Error ? err.message : 'ملف PDF غير صالح'}`,
      });
    } finally {
      setIsBusy(false);
    }
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setStatus({
          kind: 'error',
          text: 'يرجى اختيار ملف بصيغة PDF فقط.',
        });
        return;
      }
      const buffer = await file.arrayBuffer();
      await loadBytesIntoWorkspace(new Uint8Array(buffer), file.name);
    },
    [loadBytesIntoWorkspace]
  );

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLoadSample = useCallback(async () => {
    setIsBusy(true);
    setProgress(15);
    setStatus({ kind: 'info', text: 'جارٍ إنشاء ملف PDF عربي نموذجي من 6 صفحات...' });
    try {
      const sample = await createSampleArabicPdf();
      await loadBytesIntoWorkspace(sample.bytes, sample.name);
    } catch (err) {
      setIsBusy(false);
      setStatus({
        kind: 'error',
        text: `تعذر إنشاء الملف النموذجي: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
      });
    }
  }, [loadBytesIntoWorkspace]);

  // Live range parsing & validation
  const { parsedRanges, rangesError } = useMemo<{
    parsedRanges: ParsedPageRange[];
    rangesError: string | null;
  }>(() => {
    if (!pdfBytes || totalPages <= 0) {
      return { parsedRanges: [], rangesError: null };
    }
    try {
      return {
        parsedRanges: parsePageRanges(ranges, totalPages),
        rangesError: null,
      };
    } catch (err) {
      return {
        parsedRanges: [],
        rangesError: err instanceof Error ? err.message : 'صيغة نطاق غير صالحة',
      };
    }
  }, [pdfBytes, totalPages, ranges]);

  const handleRunSplit = async () => {
    if (!pdfBytes) return;
    setIsBusy(true);
    setProgress(10);
    try {
      const files = await splitPdfDocument(pdfBytes, fileName, ranges, setProgress);
      replaceOutputs(files);
      setStatus({
        kind: 'success',
        text: `تم إنشاء ${files.length} ${files.length === 1 ? 'ملف' : 'ملفات'} بنجاح وأصبحت جاهزة للتنزيل والمشاركة`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: `تعذر التجزئة: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunPngConvert = async () => {
    if (!pdfBytes) return;
    const from = Number.parseInt(normalizeNumericInput(pngPageFrom), 10);
    const to = Number.parseInt(normalizeNumericInput(pngPageTo), 10);
    if (
      Number.isNaN(from) ||
      Number.isNaN(to) ||
      from < 1 ||
      to < 1 ||
      from > totalPages ||
      to > totalPages ||
      from > to
    ) {
      setStatus({
        kind: 'error',
        text: `نطاق صفحات التحويل غير صالح (اختر بين 1 و ${totalPages})`,
      });
      return;
    }

    setIsBusy(true);
    setProgress(5);
    try {
      const imgs = await convertPdfToPngImages(
        pdfBytes,
        fileName,
        { scale: pngScale, pageFrom: from, pageTo: to },
        setProgress
      );
      replaceOutputs(imgs);
      setStatus({
        kind: 'success',
        text: `تم تحويل ${imgs.length} صفحة إلى صور PNG بدقة ${pngScale}x بنجاح`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: `خطأ في التحويل: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunWatermark = async () => {
    if (!pdfBytes) return;
    const from = Number.parseInt(normalizeNumericInput(watermarkConfig.pageFrom), 10);
    const to = Number.parseInt(normalizeNumericInput(watermarkConfig.pageTo), 10);

    setIsBusy(true);
    setProgress(10);
    try {
      const output = await addArabicWatermarkToPdf(
        pdfBytes,
        fileName,
        {
          text: watermarkConfig.text,
          pageFrom: from,
          pageTo: to,
          position: watermarkConfig.position,
          opacity: watermarkConfig.opacity,
          fontSize: watermarkConfig.fontSize,
          color: watermarkConfig.color,
        },
        setProgress
      );
      replaceOutputs([output]);
      setStatus({
        kind: 'success',
        text: `تم تحرير الملف وإضافة العلامة المائية بنجاح: ${output.name}`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: `خطأ: ${err instanceof Error ? err.message : 'تعذر إضافة العلامة المائية'}`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleScrollToOutputs = () => {
    document.getElementById('outputs-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUpdateWatermark = useCallback((next: Partial<WatermarkConfig>) => {
    setWatermarkConfig((prev) => ({ ...prev, ...next }));
  }, []);

  const handleNotify = useCallback((kind: 'info' | 'success' | 'error', text: string) => {
    setStatus({ kind, text });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 pb-16 md:pb-0">
      {/* Hidden native PDF file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) {
            void handleFileSelected(picked);
          }
          e.target.value = '';
        }}
      />

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPickFile={handlePickFile}
        onScrollToOutputs={handleScrollToOutputs}
        outputCount={lastOutputs.length}
        isBusy={isBusy}
      />

      <main
        id="workspace"
        className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            <ToolControlsPanel
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              fileName={fileName}
              fileSize={fileSize}
              totalPages={totalPages}
              hasFile={pdfBytes !== null}
              isBusy={isBusy}
              progress={progress}
              status={status}
              ranges={ranges}
              onChangeRanges={setRanges}
              parsedRanges={parsedRanges}
              rangesError={rangesError}
              onRunSplit={handleRunSplit}
              pngScale={pngScale}
              onChangePngScale={setPngScale}
              pngPageFrom={pngPageFrom}
              pngPageTo={pngPageTo}
              onChangePngPageFrom={setPngPageFrom}
              onChangePngPageTo={setPngPageTo}
              onRunPngConvert={handleRunPngConvert}
              watermarkConfig={watermarkConfig}
              onChangeWatermark={handleUpdateWatermark}
              onRunWatermark={handleRunWatermark}
              onPickFile={handlePickFile}
              onLoadSample={handleLoadSample}
            />
          </div>

          {/* Live Document Preview Stage */}
          <div className="lg:col-span-7">
            <PdfPreviewStage
              pdfBytes={pdfBytes}
              fileName={fileName}
              totalPages={totalPages}
              currentPage={currentPage}
              onChangePage={setCurrentPage}
              activeTab={activeTab}
              parsedRanges={parsedRanges}
              pngScale={pngScale}
              watermarkConfig={watermarkConfig}
              isBusy={isBusy}
              onPickFile={handlePickFile}
              onDropFile={(file) => void handleFileSelected(file)}
              onLoadSample={() => void handleLoadSample()}
            />
          </div>
        </div>

        {/* Full-Width Outputs Panel */}
        <OutputsPanel
          outputs={lastOutputs}
          onClearOutputs={() => {
            replaceOutputs([]);
            setStatus({ kind: 'info', text: 'تم مسح قائمة الملفات الناتجة' });
          }}
          onNotify={handleNotify}
        />
      </main>

      <footer className="hidden md:block border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1360px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>موعد اللوز PDF PRO</span>
          <span>معالجة محلية كاملة داخل المتصفح للحفاظ على خصوصية مستنداتك</span>
        </div>
      </footer>

      <MobileBottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}
