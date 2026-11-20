import {
  Archive,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { OutputFile } from '../types/pdf';
import {
  downloadOutputFile,
  downloadOutputsAsZip,
  formatFileSize,
  shareOutputFile,
} from '../utils/pdfEngine';

interface OutputsPanelProps {
  outputs: OutputFile[];
  onClearOutputs: () => void;
  onNotify: (kind: 'info' | 'success' | 'error', text: string) => void;
}

export function OutputsPanel({ outputs, onClearOutputs, onNotify }: OutputsPanelProps) {
  const [previewItem, setPreviewItem] = useState<OutputFile | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const handleShare = async (file: OutputFile) => {
    const result = await shareOutputFile(file);
    if (result === 'downloaded') {
      onNotify('success', `تم تنزيل الملف مباشرة: ${file.name}`);
    } else {
      onNotify('success', `تمت مشاركة الملف: ${file.name}`);
    }
  };

  const handleDownloadAllZip = async () => {
    if (outputs.length === 0) return;
    setIsZipping(true);
    try {
      await downloadOutputsAsZip(outputs, 'MuedPdfPro_Outputs.zip');
      onNotify('success', `تم تنزيل حزمة ZIP تحتوي على ${outputs.length} ملفات`);
    } catch (err) {
      onNotify(
        'error',
        `تعذر ضغط الملفات: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`
      );
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <section
      id="outputs-section"
      aria-label="الملفات الناتجة"
      className="bg-white border border-slate-200 rounded-xl"
    >
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">الملفات الناتجة</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {outputs.length === 0
              ? 'ستظهر هنا الملفات بعد تنفيذ التجزئة أو التحويل أو إضافة العلامة المائية'
              : `${outputs.length} ${outputs.length === 1 ? 'ملف جاهز' : 'ملفات جاهزة'} للتنزيل والمشاركة`}
          </p>
        </div>

        {outputs.length > 0 && (
          <div className="flex items-center gap-2">
            {outputs.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isZipping}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1565C0] hover:bg-[#0D47A1] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
              >
                <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isZipping ? 'جارٍ الضغط...' : 'تنزيل الكل (ZIP)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClearOutputs}
              aria-label="مسح قائمة المخرجات"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>مسح القائمة</span>
            </button>
          </div>
        )}
      </div>

      {outputs.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          لم يتم إنشاء أي ملفات ناتجة في هذه الجلسة بعد.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {outputs.map((file) => {
            const isPng = file.mimeType === 'image/png';
            return (
              <li
                key={file.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {isPng ? (
                    <button
                      type="button"
                      onClick={() => setPreviewItem(file)}
                      aria-label={`معاينة ${file.name}`}
                      className="w-11 h-11 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
                    >
                      <img
                        src={file.url}
                        alt={file.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-[#1565C0] shrink-0">
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold text-slate-900 truncate"
                      dir="auto"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      <span>{isPng ? 'صورة PNG' : 'مستند PDF'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{file.detail}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {isPng && (
                    <button
                      type="button"
                      onClick={() => setPreviewItem(file)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>معاينة</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      downloadOutputFile(file);
                      onNotify('success', `بدأ تنزيل الملف: ${file.name}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1565C0] hover:bg-[#1565C0]/10 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تنزيل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare(file)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0]"
                  >
                    <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>مشاركة</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Clean Lightbox Modal for PNG Output Inspection */}
      {previewItem && previewItem.mimeType === 'image/png' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`معاينة ${previewItem.name}`}
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 bg-slate-950/75 p-4 sm:p-8 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <ImageIcon className="w-4 h-4 text-[#1565C0] shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold text-slate-900 truncate" dir="auto">
                  {previewItem.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadOutputFile(previewItem)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565C0] hover:bg-[#0D47A1] rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تنزيل PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  aria-label="إغلاق المعاينة"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              <img
                src={previewItem.url}
                alt={previewItem.name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[75vh] object-contain border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
