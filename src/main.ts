import './index.css';
import type {
  OutputFile,
  ParsedPageRange,
  StatusFeedback,
  ToolTab,
  WatermarkConfig,
  WatermarkPosition,
} from './types/pdf';
import {
  addArabicWatermarkToPdf,
  convertPdfToPngImages,
  createSampleArabicPdf,
  downloadOutputFile,
  downloadOutputsAsZip,
  formatFileSize,
  inspectPdfBytes,
  normalizeNumericInput,
  parsePageRanges,
  renderPdfPagePreview,
  shareOutputFile,
  splitPdfDocument,
} from './utils/pdfEngine';

interface AppState {
  activeTab: ToolTab;
  pdfBytes: Uint8Array | null;
  fileName: string;
  fileSize: number;
  totalPages: number;
  currentPage: number;
  pageDimsPt: { width: number; height: number } | null;
  canvasCssWidth: number;
  isBusy: boolean;
  progress: number;
  ranges: string;
  pngScale: number;
  pngPageFrom: string;
  pngPageTo: string;
  watermark: WatermarkConfig;
  outputs: OutputFile[];
  modalFile: OutputFile | null;
}

const state: AppState = {
  activeTab: 'split',
  pdfBytes: null,
  fileName: 'لم يتم اختيار ملف',
  fileSize: 0,
  totalPages: 0,
  currentPage: 1,
  pageDimsPt: null,
  canvasCssWidth: 0,
  isBusy: false,
  progress: 0,
  ranges: '1-3,4-6',
  pngScale: 2,
  pngPageFrom: '1',
  pngPageTo: '1',
  watermark: {
    text: 'موعد اللوز العبيدي',
    pageFrom: '1',
    pageTo: '1',
    position: 'diagonal',
    opacity: 0.25,
    fontSize: 42,
    color: '#1565C0',
  },
  outputs: [],
  modalFile: null,
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element #${id}`);
  return el as T;
}

const dom = {
  fileInput: byId<HTMLInputElement>('pdf-file-input'),
  headerPickBtn: byId<HTMLButtonElement>('header-pick-btn'),
  navOutputsBtn: byId<HTMLButtonElement>('nav-outputs-btn'),
  panelPickBtn: byId<HTMLButtonElement>('panel-pick-btn'),
  panelPickLabel: byId<HTMLSpanElement>('panel-pick-label'),
  panelSampleBtn: byId<HTMLButtonElement>('panel-sample-btn'),
  activeFileName: byId<HTMLParagraphElement>('active-file-name'),
  activeFileMeta: byId<HTMLParagraphElement>('active-file-meta'),
  progressWrapper: byId<HTMLDivElement>('progress-wrapper'),
  progressLabel: byId<HTMLSpanElement>('progress-label'),
  progressBar: byId<HTMLDivElement>('progress-bar'),

  panelSplit: byId<HTMLDivElement>('tool-panel-split'),
  panelPng: byId<HTMLDivElement>('tool-panel-png'),
  panelWatermark: byId<HTMLDivElement>('tool-panel-watermark'),

  splitRangesInput: byId<HTMLInputElement>('split-ranges-input'),
  splitRangesFeedback: byId<HTMLParagraphElement>('split-ranges-feedback'),
  splitPresets: byId<HTMLDivElement>('split-presets'),
  presetHalfBtn: byId<HTMLButtonElement>('preset-half-btn'),
  presetEveryBtn: byId<HTMLButtonElement>('preset-every-btn'),
  presetFirstBtn: byId<HTMLButtonElement>('preset-first-btn'),
  runSplitBtn: byId<HTMLButtonElement>('run-split-btn'),

  pngFromInput: byId<HTMLInputElement>('png-from-input'),
  pngToInput: byId<HTMLInputElement>('png-to-input'),
  runPngBtn: byId<HTMLButtonElement>('run-png-btn'),
  runPngLabel: byId<HTMLSpanElement>('run-png-label'),

  wmTextInput: byId<HTMLInputElement>('watermark-text-input'),
  wmFromInput: byId<HTMLInputElement>('wm-from-input'),
  wmToInput: byId<HTMLInputElement>('wm-to-input'),
  wmOpacity: byId<HTMLInputElement>('wm-opacity'),
  wmOpacityVal: byId<HTMLSpanElement>('wm-opacity-val'),
  wmSize: byId<HTMLInputElement>('wm-size'),
  wmSizeVal: byId<HTMLSpanElement>('wm-size-val'),
  runWatermarkBtn: byId<HTMLButtonElement>('run-watermark-btn'),

  statusBanner: byId<HTMLDivElement>('status-banner'),
  statusIcon: byId<HTMLSpanElement>('status-icon'),
  statusText: byId<HTMLSpanElement>('status-text'),

  previewDropzone: byId<HTMLElement>('preview-dropzone'),
  stageTitle: byId<HTMLHeadingElement>('stage-title'),
  stageSubtitle: byId<HTMLParagraphElement>('stage-subtitle'),
  pageNavControls: byId<HTMLDivElement>('page-nav-controls'),
  prevPageBtn: byId<HTMLButtonElement>('prev-page-btn'),
  nextPageBtn: byId<HTMLButtonElement>('next-page-btn'),
  pageCounter: byId<HTMLSpanElement>('page-counter'),
  stageContainer: byId<HTMLDivElement>('stage-container'),
  stageEmptyState: byId<HTMLDivElement>('stage-empty-state'),
  stagePickBtn: byId<HTMLButtonElement>('stage-pick-btn'),
  stageSampleBtn: byId<HTMLButtonElement>('stage-sample-btn'),
  stageCanvasView: byId<HTMLDivElement>('stage-canvas-view'),
  previewCanvas: byId<HTMLCanvasElement>('pdf-preview-canvas'),
  liveWatermarkOverlay: byId<HTMLDivElement>('live-watermark-overlay'),
  canvasLoadingOverlay: byId<HTMLDivElement>('canvas-loading-overlay'),
  quickPagesWrapper: byId<HTMLDivElement>('quick-pages-wrapper'),
  pageDimsLabel: byId<HTMLSpanElement>('page-dims-label'),
  quickPagesButtons: byId<HTMLDivElement>('quick-pages-buttons'),

  outputsSection: byId<HTMLElement>('outputs-section'),
  outputsSubtitle: byId<HTMLParagraphElement>('outputs-subtitle'),
  outputsBulkActions: byId<HTMLDivElement>('outputs-bulk-actions'),
  downloadZipBtn: byId<HTMLButtonElement>('download-zip-btn'),
  clearOutputsBtn: byId<HTMLButtonElement>('clear-outputs-btn'),
  outputsEmpty: byId<HTMLDivElement>('outputs-empty'),
  outputsList: byId<HTMLUListElement>('outputs-list'),

  pngModal: byId<HTMLDivElement>('png-modal'),
  pngModalCard: byId<HTMLDivElement>('png-modal-card'),
  pngModalTitle: byId<HTMLSpanElement>('png-modal-title'),
  pngModalImg: byId<HTMLImageElement>('png-modal-img'),
  pngModalDownload: byId<HTMLButtonElement>('png-modal-download'),
  pngModalClose: byId<HTMLButtonElement>('png-modal-close'),
};

let renderSeq = 0;

function setStatus(feedback: StatusFeedback): void {
  dom.statusText.textContent = feedback.text;
  dom.statusBanner.className =
    'px-5 py-3.5 rounded-b-xl flex items-start gap-2.5 text-sm font-semibold ' +
    (feedback.kind === 'error'
      ? 'bg-red-50/70 text-red-700'
      : feedback.kind === 'success'
        ? 'bg-emerald-50/70 text-[#15803D]'
        : 'bg-slate-50/70 text-slate-700');

  if (feedback.kind === 'error') {
    dom.statusIcon.className = 'shrink-0 mt-0.5 text-red-700';
    dom.statusIcon.innerHTML =
      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  } else if (feedback.kind === 'success') {
    dom.statusIcon.className = 'shrink-0 mt-0.5 text-[#15803D]';
    dom.statusIcon.innerHTML =
      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else {
    dom.statusIcon.className = 'shrink-0 mt-0.5 text-[#1565C0]';
    dom.statusIcon.innerHTML =
      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  }
}

function setBusy(busy: boolean, progress = 0): void {
  state.isBusy = busy;
  state.progress = progress;
  dom.progressWrapper.classList.toggle('hidden', !busy);
  dom.progressWrapper.setAttribute('aria-valuenow', String(progress));
  dom.progressLabel.textContent = `${progress}%`;
  dom.progressBar.style.width = `${Math.max(8, progress)}%`;
  syncActionButtons();
}

function updateProgress(percent: number): void {
  state.progress = percent;
  dom.progressWrapper.setAttribute('aria-valuenow', String(percent));
  dom.progressLabel.textContent = `${percent}%`;
  dom.progressBar.style.width = `${Math.max(8, percent)}%`;
}

function getParsedRangesSafe(): { parsed: ParsedPageRange[]; error: string | null } {
  if (!state.pdfBytes || state.totalPages <= 0) {
    return { parsed: [], error: null };
  }
  try {
    return { parsed: parsePageRanges(state.ranges, state.totalPages), error: null };
  } catch (err) {
    return {
      parsed: [],
      error: err instanceof Error ? err.message : 'صيغة نطاق غير صالحة',
    };
  }
}

function syncActionButtons(): void {
  const hasFile = state.pdfBytes !== null;
  const { error } = getParsedRangesSafe();

  dom.headerPickBtn.disabled = state.isBusy;
  dom.panelPickBtn.disabled = state.isBusy;
  dom.panelSampleBtn.disabled = state.isBusy;
  dom.stagePickBtn.disabled = state.isBusy;
  dom.stageSampleBtn.disabled = state.isBusy;

  dom.runSplitBtn.disabled = state.isBusy || !hasFile || Boolean(error);
  dom.runPngBtn.disabled = state.isBusy || !hasFile;
  dom.runWatermarkBtn.disabled = state.isBusy || !hasFile || !state.watermark.text.trim();
}

function syncSplitFeedback(): void {
  const hasFile = state.pdfBytes !== null;
  dom.splitPresets.classList.toggle('hidden', !hasFile);
  if (!hasFile) {
    dom.splitRangesFeedback.classList.add('hidden');
    return;
  }
  const { parsed, error } = getParsedRangesSafe();
  dom.splitRangesFeedback.classList.remove('hidden');
  if (error) {
    dom.splitRangesFeedback.className = 'text-xs text-red-700 mt-1.5 tabular-nums';
    dom.splitRangesFeedback.textContent = error;
  } else {
    dom.splitRangesFeedback.className = 'text-xs text-slate-600 mt-1.5 tabular-nums';
    const word = parsed.length === 1 ? 'ملف PDF' : 'ملفات PDF';
    dom.splitRangesFeedback.textContent = `سيتم إنشاء ${parsed.length} ${word}: ${parsed.map((r) => `[${r.label}]`).join(' · ')}`;
  }
  syncActionButtons();
}

function syncStageSubtitle(): void {
  if (!state.pdfBytes) {
    dom.stageTitle.textContent = 'منطقة معاينة المستند';
    dom.stageSubtitle.classList.add('hidden');
    return;
  }

  dom.stageTitle.textContent = `معاينة: ${state.fileName}`;
  dom.stageSubtitle.classList.remove('hidden');

  if (state.activeTab === 'split') {
    const { parsed } = getParsedRangesSafe();
    const groups = parsed
      .map((r, i) => ({ ...r, partNumber: i + 1 }))
      .filter((r) => state.currentPage >= r.start && state.currentPage <= r.end);
    dom.stageSubtitle.textContent =
      groups.length > 0
        ? `مشمولة في التجزئة: ${groups.map((g) => `الجزء ${g.partNumber} (${g.label})`).join('، ')}`
        : 'هذه الصفحة غير مشمولة في النطاقات المحددة حالياً';
  } else if (state.activeTab === 'png') {
    if (state.pageDimsPt) {
      const w = Math.round(state.pageDimsPt.width * state.pngScale);
      const h = Math.round(state.pageDimsPt.height * state.pngScale);
      dom.stageSubtitle.textContent = `دقة التصدير المتوقعة: ${w} × ${h} بكسل (${state.pngScale}x)`;
    } else {
      dom.stageSubtitle.textContent = `دقة التصدير المختارة: ${state.pngScale}x`;
    }
  } else {
    dom.stageSubtitle.textContent = isWatermarkVisibleOnCurrentPage()
      ? 'معاينة فورية للعلامة المائية العربية على هذه الصفحة'
      : 'هذه الصفحة خارج نطاق تطبيق العلامة المائية المحدد';
  }
}

function isWatermarkVisibleOnCurrentPage(): boolean {
  if (state.activeTab !== 'watermark' || !state.watermark.text.trim()) return false;
  const from = Number.parseInt(normalizeNumericInput(state.watermark.pageFrom), 10);
  const to = Number.parseInt(normalizeNumericInput(state.watermark.pageTo), 10);
  if (Number.isNaN(from) || Number.isNaN(to)) return true;
  return state.currentPage >= from && state.currentPage <= to;
}

function syncLiveWatermarkOverlay(): void {
  const overlay = dom.liveWatermarkOverlay;
  if (!state.pdfBytes || !isWatermarkVisibleOnCurrentPage() || state.canvasCssWidth <= 0) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    return;
  }

  const ratio =
    state.pageDimsPt && state.pageDimsPt.width > 0
      ? state.canvasCssWidth / state.pageDimsPt.width
      : 1;
  const fontPx = Math.max(10, Math.round(state.watermark.fontSize * ratio));

  overlay.classList.remove('hidden');
  overlay.style.color = state.watermark.color;
  overlay.style.opacity = String(state.watermark.opacity);
  overlay.style.fontFamily = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
  overlay.style.fontWeight = '700';
  overlay.style.fontSize = `${fontPx}px`;
  overlay.style.lineHeight = '1.35';
  overlay.innerHTML = '';

  const text = state.watermark.text;
  const pos = state.watermark.position;

  if (pos === 'diagonal' || pos === 'center') {
    const wrap = document.createElement('div');
    wrap.className = 'w-full h-full flex items-center justify-center';
    const inner = document.createElement('div');
    inner.className =
      (pos === 'diagonal' ? '-rotate-[35deg] ' : '') + 'text-center whitespace-pre-line px-4';
    inner.textContent = text;
    wrap.appendChild(inner);
    overlay.appendChild(wrap);
  } else if (pos === 'top' || pos === 'bottom') {
    const wrap = document.createElement('div');
    wrap.className =
      pos === 'top'
        ? 'w-full pt-[6%] flex justify-center'
        : 'w-full h-full pb-[6%] flex items-end justify-center';
    const inner = document.createElement('div');
    inner.className = 'text-center whitespace-pre-line px-4';
    inner.textContent = text;
    wrap.appendChild(inner);
    overlay.appendChild(wrap);
  } else {
    const grid = document.createElement('div');
    grid.className =
      'absolute -inset-1/3 grid grid-cols-3 gap-10 place-items-center -rotate-[30deg]';
    for (let i = 0; i < 12; i++) {
      const span = document.createElement('span');
      span.className = 'text-center whitespace-nowrap';
      span.textContent = text;
      grid.appendChild(span);
    }
    overlay.appendChild(grid);
  }
}

function renderQuickPageStrip(): void {
  if (!state.pdfBytes || state.totalPages <= 1) {
    dom.quickPagesWrapper.classList.add('hidden');
    return;
  }

  dom.quickPagesWrapper.classList.remove('hidden');
  dom.pageDimsLabel.textContent = state.pageDimsPt
    ? `${state.pageDimsPt.width} × ${state.pageDimsPt.height} pt`
    : '';

  const { parsed } = getParsedRangesSafe();
  dom.quickPagesButtons.innerHTML = '';

  const limit = Math.min(state.totalPages, 24);
  for (let p = 1; p <= limit; p++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(p);
    const isSelected = p === state.currentPage;
    const inSplit =
      state.activeTab === 'split' && parsed.some((r) => p >= r.start && p <= r.end);

    btn.className =
      'min-w-[34px] h-8 px-2 text-xs font-mono tabular-nums rounded-md border transition-colors duration-150 cursor-pointer ' +
      (isSelected
        ? 'bg-[#1565C0] text-white border-[#1565C0] font-semibold'
        : inSplit
          ? 'bg-[#1565C0]/10 text-[#1565C0] border-[#1565C0]/30 hover:bg-[#1565C0]/15'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50');

    btn.addEventListener('click', () => {
      state.currentPage = p;
      void renderCurrentPreviewPage();
    });
    dom.quickPagesButtons.appendChild(btn);
  }

  if (state.totalPages > 24) {
    const more = document.createElement('span');
    more.className = 'text-xs text-slate-500 px-2 tabular-nums';
    more.textContent = `+ ${state.totalPages - 24} صفحة أخرى`;
    dom.quickPagesButtons.appendChild(more);
  }
}

async function renderCurrentPreviewPage(): Promise<void> {
  if (!state.pdfBytes || state.totalPages <= 0) {
    dom.stageEmptyState.classList.remove('hidden');
    dom.stageCanvasView.classList.add('hidden');
    dom.pageNavControls.classList.add('hidden');
    syncStageSubtitle();
    return;
  }

  dom.stageEmptyState.classList.add('hidden');
  dom.stageCanvasView.classList.remove('hidden');
  dom.pageNavControls.classList.remove('hidden');
  dom.pageCounter.textContent = `${state.currentPage} / ${state.totalPages}`;
  dom.prevPageBtn.disabled = state.currentPage <= 1;
  dom.nextPageBtn.disabled = state.currentPage >= state.totalPages;

  const seq = ++renderSeq;
  dom.canvasLoadingOverlay.classList.remove('hidden');

  try {
    const availableWidth = Math.max(260, dom.stageContainer.clientWidth - 48);
    const dims = await renderPdfPagePreview(
      state.pdfBytes,
      state.currentPage,
      dom.previewCanvas,
      availableWidth
    );
    if (seq !== renderSeq) return;
    state.pageDimsPt = { width: dims.pageWidthPt, height: dims.pageHeightPt };
    state.canvasCssWidth = Number.parseFloat(dom.previewCanvas.style.width) || 0;
  } catch (err) {
    if (seq === renderSeq) {
      setStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'تعذر عرض معاينة الصفحة',
      });
    }
  } finally {
    if (seq === renderSeq) {
      dom.canvasLoadingOverlay.classList.add('hidden');
      syncStageSubtitle();
      syncLiveWatermarkOverlay();
      renderQuickPageStrip();
    }
  }
}

function setActiveTab(tab: ToolTab): void {
  state.activeTab = tab;

  dom.panelSplit.classList.toggle('hidden', tab !== 'split');
  dom.panelPng.classList.toggle('hidden', tab !== 'png');
  dom.panelWatermark.classList.toggle('hidden', tab !== 'watermark');

  document.querySelectorAll<HTMLButtonElement>('.nav-tab-btn').forEach((btn) => {
    const active = btn.dataset.navTab === tab;
    btn.classList.toggle('text-[#1565C0]', active);
    btn.classList.toggle('font-semibold', active);
    btn.classList.toggle('text-slate-600', !active);
    const indicator = btn.querySelector<HTMLElement>('[data-nav-indicator]');
    if (indicator) indicator.classList.toggle('hidden', !active);
  });

  document.querySelectorAll<HTMLButtonElement>('.seg-tab-btn').forEach((btn) => {
    const active = btn.dataset.segTab === tab;
    btn.setAttribute('aria-selected', String(active));
    btn.className =
      'seg-tab-btn inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565C0] ' +
      (active ? 'bg-white text-[#1565C0] shadow-xs' : 'text-slate-600 hover:text-slate-900');
  });

  document.querySelectorAll<HTMLButtonElement>('.mobile-tab-btn').forEach((btn) => {
    const active = btn.dataset.mobileTab === tab;
    btn.className =
      'mobile-tab-btn flex flex-col items-center justify-center gap-0.5 text-xs cursor-pointer ' +
      (active ? 'font-semibold text-[#1565C0]' : 'font-medium text-slate-600');
  });

  syncStageSubtitle();
  syncLiveWatermarkOverlay();
  renderQuickPageStrip();
}

function replaceOutputs(next: OutputFile[]): void {
  state.outputs.forEach((f) => URL.revokeObjectURL(f.url));
  state.outputs = next;
  renderOutputsList();
}

function openPngModal(file: OutputFile): void {
  state.modalFile = file;
  dom.pngModalTitle.textContent = file.name;
  dom.pngModalImg.src = file.url;
  dom.pngModalImg.alt = file.name;
  dom.pngModal.classList.remove('hidden');
}

function closePngModal(): void {
  state.modalFile = null;
  dom.pngModal.classList.add('hidden');
}

function renderOutputsList(): void {
  const count = state.outputs.length;
  dom.navOutputsBtn.textContent = count > 0 ? `الملفات الناتجة (${count})` : 'الملفات الناتجة';
  dom.outputsSubtitle.textContent =
    count === 0
      ? 'ستظهر هنا الملفات بعد تنفيذ التجزئة أو التحويل أو إضافة العلامة المائية'
      : `${count} ${count === 1 ? 'ملف جاهز' : 'ملفات جاهزة'} للتنزيل والمشاركة`;

  dom.outputsBulkActions.classList.toggle('hidden', count === 0);
  dom.downloadZipBtn.classList.toggle('hidden', count <= 1);
  dom.outputsEmpty.classList.toggle('hidden', count > 0);
  dom.outputsList.classList.toggle('hidden', count === 0);
  dom.outputsList.innerHTML = '';

  state.outputs.forEach((file) => {
    const isPng = file.mimeType === 'image/png';
    const li = document.createElement('li');
    li.className =
      'px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-3.5 min-w-0';

    if (isPng) {
      const thumbBtn = document.createElement('button');
      thumbBtn.type = 'button';
      thumbBtn.className =
        'w-11 h-11 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 shrink-0 cursor-pointer';
      const img = document.createElement('img');
      img.src = file.url;
      img.alt = file.name;
      img.referrerPolicy = 'no-referrer';
      img.className = 'w-full h-full object-cover';
      thumbBtn.appendChild(img);
      thumbBtn.addEventListener('click', () => openPngModal(file));
      left.appendChild(thumbBtn);
    } else {
      const iconBox = document.createElement('div');
      iconBox.className =
        'w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-[#1565C0] shrink-0 font-mono text-xs font-bold';
      iconBox.textContent = 'PDF';
      left.appendChild(iconBox);
    }

    const metaWrap = document.createElement('div');
    metaWrap.className = 'min-w-0';
    const nameEl = document.createElement('p');
    nameEl.className = 'text-sm font-semibold text-slate-900 truncate';
    nameEl.dir = 'auto';
    nameEl.title = file.name;
    nameEl.textContent = file.name;

    const infoRow = document.createElement('div');
    infoRow.className = 'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5';
    infoRow.innerHTML = `<span>${isPng ? 'صورة PNG' : 'مستند PDF'}</span><span aria-hidden="true">·</span><span class="tabular-nums">${file.detail}</span><span aria-hidden="true">·</span><span class="font-mono tabular-nums">${formatFileSize(file.size)}</span>`;

    metaWrap.appendChild(nameEl);
    metaWrap.appendChild(infoRow);
    left.appendChild(metaWrap);

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1.5 shrink-0 self-end sm:self-center';

    if (isPng) {
      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.textContent = 'معاينة';
      previewBtn.className =
        'px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer';
      previewBtn.addEventListener('click', () => openPngModal(file));
      actions.appendChild(previewBtn);
    }

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.textContent = 'تنزيل';
    dlBtn.className =
      'px-3 py-1.5 text-xs font-semibold text-[#1565C0] hover:bg-[#1565C0]/10 rounded-lg transition-colors whitespace-nowrap cursor-pointer';
    dlBtn.addEventListener('click', () => {
      downloadOutputFile(file);
      setStatus({ kind: 'success', text: `بدأ تنزيل الملف: ${file.name}` });
    });
    actions.appendChild(dlBtn);

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.textContent = 'مشاركة';
    shareBtn.className =
      'px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer';
    shareBtn.addEventListener('click', async () => {
      const res = await shareOutputFile(file);
      setStatus({
        kind: 'success',
        text:
          res === 'downloaded'
            ? `تم تنزيل الملف مباشرة: ${file.name}`
            : `تمت مشاركة الملف: ${file.name}`,
      });
    });
    actions.appendChild(shareBtn);

    li.appendChild(left);
    li.appendChild(actions);
    dom.outputsList.appendChild(li);
  });
}

async function loadPdfBytes(bytes: Uint8Array, resolvedName: string): Promise<void> {
  setBusy(true, 20);
  try {
    const { pageCount } = await inspectPdfBytes(bytes);
    state.pdfBytes = bytes;
    state.fileName = resolvedName;
    state.fileSize = bytes.byteLength;
    state.totalPages = pageCount;
    state.currentPage = 1;

    const defaultSplit =
      pageCount >= 6
        ? '1-3,4-6'
        : pageCount >= 2
          ? `1-${Math.ceil(pageCount / 2)},${Math.ceil(pageCount / 2) + 1}-${pageCount}`
          : '1';

    state.ranges = defaultSplit;
    state.pngPageFrom = '1';
    state.pngPageTo = String(pageCount);
    state.watermark.pageFrom = '1';
    state.watermark.pageTo = String(pageCount);

    dom.activeFileName.textContent = resolvedName;
    dom.activeFileName.title = resolvedName;
    dom.activeFileMeta.innerHTML = `<span class="tabular-nums">عدد الصفحات: ${pageCount}</span> <span aria-hidden="true">·</span> <span class="font-mono tabular-nums">${formatFileSize(bytes.byteLength)}</span>`;
    dom.panelPickLabel.textContent = 'تغيير الملف';
    dom.panelSampleBtn.classList.add('hidden');

    dom.splitRangesInput.value = defaultSplit;
    dom.pngFromInput.value = '1';
    dom.pngToInput.value = String(pageCount);
    dom.wmFromInput.value = '1';
    dom.wmToInput.value = String(pageCount);

    syncSplitFeedback();
    await renderCurrentPreviewPage();
    updateProgress(100);
    setStatus({ kind: 'success', text: `تم اختيار الملف بنجاح (${pageCount} صفحة)` });
  } catch (err) {
    setStatus({
      kind: 'error',
      text: `خطأ في فتح الملف: ${err instanceof Error ? err.message : 'ملف PDF غير صالح'}`,
    });
  } finally {
    setBusy(false, 0);
  }
}

async function handleSelectedFile(file: File): Promise<void> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    setStatus({ kind: 'error', text: 'يرجى اختيار ملف بصيغة PDF فقط.' });
    return;
  }
  const buffer = await file.arrayBuffer();
  await loadPdfBytes(new Uint8Array(buffer), file.name);
}

async function handleLoadSample(): Promise<void> {
  setBusy(true, 15);
  setStatus({ kind: 'info', text: 'جارٍ إنشاء ملف PDF عربي نموذجي من 6 صفحات...' });
  try {
    const sample = await createSampleArabicPdf();
    await loadPdfBytes(sample.bytes, sample.name);
  } catch (err) {
    setBusy(false, 0);
    setStatus({
      kind: 'error',
      text: `تعذر إنشاء الملف النموذجي: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
    });
  }
}

// Wire Events
const triggerPick = () => dom.fileInput.click();
dom.headerPickBtn.addEventListener('click', triggerPick);
dom.panelPickBtn.addEventListener('click', triggerPick);
dom.stagePickBtn.addEventListener('click', triggerPick);
dom.panelSampleBtn.addEventListener('click', () => void handleLoadSample());
dom.stageSampleBtn.addEventListener('click', () => void handleLoadSample());

dom.fileInput.addEventListener('change', () => {
  const picked = dom.fileInput.files?.[0];
  if (picked) void handleSelectedFile(picked);
  dom.fileInput.value = '';
});

dom.navOutputsBtn.addEventListener('click', () => {
  dom.outputsSection.scrollIntoView({ behavior: 'smooth' });
});

document.querySelectorAll<HTMLButtonElement>('[data-nav-tab]').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.navTab as ToolTab));
});
document.querySelectorAll<HTMLButtonElement>('[data-seg-tab]').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.segTab as ToolTab));
});
document.querySelectorAll<HTMLButtonElement>('[data-mobile-tab]').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.mobileTab as ToolTab));
});

// Drag and drop on preview stage
dom.previewDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dom.previewDropzone.classList.add('border-[#1565C0]', 'bg-[#1565C0]/[0.02]');
});
dom.previewDropzone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dom.previewDropzone.classList.remove('border-[#1565C0]', 'bg-[#1565C0]/[0.02]');
});
dom.previewDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dom.previewDropzone.classList.remove('border-[#1565C0]', 'bg-[#1565C0]/[0.02]');
  const dropped = e.dataTransfer?.files?.[0];
  if (dropped) void handleSelectedFile(dropped);
});

// Page navigation
dom.prevPageBtn.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    void renderCurrentPreviewPage();
  }
});
dom.nextPageBtn.addEventListener('click', () => {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    void renderCurrentPreviewPage();
  }
});

// Split inputs & presets
dom.splitRangesInput.addEventListener('input', () => {
  state.ranges = dom.splitRangesInput.value;
  syncSplitFeedback();
  syncStageSubtitle();
  renderQuickPageStrip();
});

dom.presetHalfBtn.addEventListener('click', () => {
  if (state.totalPages < 2) {
    state.ranges = '1';
  } else {
    const mid = Math.ceil(state.totalPages / 2);
    state.ranges = `1-${mid},${mid + 1}-${state.totalPages}`;
  }
  dom.splitRangesInput.value = state.ranges;
  syncSplitFeedback();
  syncStageSubtitle();
  renderQuickPageStrip();
});

dom.presetEveryBtn.addEventListener('click', () => {
  const cap = Math.min(state.totalPages, 30);
  state.ranges = Array.from({ length: cap }, (_, i) => i + 1).join(',');
  dom.splitRangesInput.value = state.ranges;
  syncSplitFeedback();
  syncStageSubtitle();
  renderQuickPageStrip();
});

dom.presetFirstBtn.addEventListener('click', () => {
  state.ranges = '1';
  dom.splitRangesInput.value = '1';
  syncSplitFeedback();
  syncStageSubtitle();
  renderQuickPageStrip();
});

dom.runSplitBtn.addEventListener('click', async () => {
  if (!state.pdfBytes) return;
  setBusy(true, 10);
  try {
    const files = await splitPdfDocument(
      state.pdfBytes,
      state.fileName,
      state.ranges,
      updateProgress
    );
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
    setBusy(false, 0);
  }
});

// PNG options
document.querySelectorAll<HTMLButtonElement>('.png-scale-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const scale = Number.parseInt(btn.dataset.pngScale || '2', 10);
    state.pngScale = scale;
    dom.runPngLabel.textContent = `تحويل إلى PNG بدقة ${scale}x`;
    document.querySelectorAll<HTMLButtonElement>('.png-scale-btn').forEach((b) => {
      const active = Number.parseInt(b.dataset.pngScale || '2', 10) === scale;
      b.className =
        'png-scale-btn py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ' +
        (active
          ? 'border-[#1565C0] bg-[#1565C0]/10 text-[#1565C0]'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50');
    });
    syncStageSubtitle();
  });
});

dom.pngFromInput.addEventListener('input', () => {
  state.pngPageFrom = dom.pngFromInput.value;
});
dom.pngToInput.addEventListener('input', () => {
  state.pngPageTo = dom.pngToInput.value;
});

dom.runPngBtn.addEventListener('click', async () => {
  if (!state.pdfBytes) return;
  const from = Number.parseInt(normalizeNumericInput(state.pngPageFrom), 10);
  const to = Number.parseInt(normalizeNumericInput(state.pngPageTo), 10);
  if (
    Number.isNaN(from) ||
    Number.isNaN(to) ||
    from < 1 ||
    to < 1 ||
    from > state.totalPages ||
    to > state.totalPages ||
    from > to
  ) {
    setStatus({
      kind: 'error',
      text: `نطاق صفحات التحويل غير صالح (اختر بين 1 و ${state.totalPages})`,
    });
    return;
  }

  setBusy(true, 5);
  try {
    const imgs = await convertPdfToPngImages(
      state.pdfBytes,
      state.fileName,
      { scale: state.pngScale, pageFrom: from, pageTo: to },
      updateProgress
    );
    replaceOutputs(imgs);
    setStatus({
      kind: 'success',
      text: `تم تحويل ${imgs.length} صفحة إلى صور PNG بدقة ${state.pngScale}x بنجاح`,
    });
  } catch (err) {
    setStatus({
      kind: 'error',
      text: `خطأ في التحويل: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
    });
  } finally {
    setBusy(false, 0);
  }
});

// Watermark options
dom.wmTextInput.addEventListener('input', () => {
  state.watermark.text = dom.wmTextInput.value;
  syncActionButtons();
  syncStageSubtitle();
  syncLiveWatermarkOverlay();
});
dom.wmFromInput.addEventListener('input', () => {
  state.watermark.pageFrom = dom.wmFromInput.value;
  syncStageSubtitle();
  syncLiveWatermarkOverlay();
});
dom.wmToInput.addEventListener('input', () => {
  state.watermark.pageTo = dom.wmToInput.value;
  syncStageSubtitle();
  syncLiveWatermarkOverlay();
});
dom.wmOpacity.addEventListener('input', () => {
  state.watermark.opacity = Number.parseFloat(dom.wmOpacity.value);
  dom.wmOpacityVal.textContent = `${Math.round(state.watermark.opacity * 100)}%`;
  syncLiveWatermarkOverlay();
});
dom.wmSize.addEventListener('input', () => {
  state.watermark.fontSize = Number.parseInt(dom.wmSize.value, 10);
  dom.wmSizeVal.textContent = `${state.watermark.fontSize} pt`;
  syncLiveWatermarkOverlay();
});

document.querySelectorAll<HTMLButtonElement>('.wm-pos-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const pos = btn.dataset.wmPos as WatermarkPosition;
    state.watermark.position = pos;
    document.querySelectorAll<HTMLButtonElement>('.wm-pos-btn').forEach((b) => {
      const active = b.dataset.wmPos === pos;
      b.className =
        'wm-pos-btn py-1.5 px-1 text-xs font-semibold rounded-md border whitespace-nowrap cursor-pointer ' +
        (active
          ? 'border-[#1565C0] bg-[#1565C0]/10 text-[#1565C0]'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50');
    });
    syncLiveWatermarkOverlay();
  });
});

document.querySelectorAll<HTMLButtonElement>('.wm-color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const hex = btn.dataset.wmColor || '#1565C0';
    state.watermark.color = hex;
    document.querySelectorAll<HTMLButtonElement>('.wm-color-btn').forEach((b) => {
      const active = b.dataset.wmColor === hex;
      b.className =
        'wm-color-btn w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ' +
        (active ? 'border-slate-900 scale-110' : 'border-white ring-1 ring-slate-300');
    });
    syncLiveWatermarkOverlay();
  });
});

dom.runWatermarkBtn.addEventListener('click', async () => {
  if (!state.pdfBytes) return;
  const from = Number.parseInt(normalizeNumericInput(state.watermark.pageFrom), 10);
  const to = Number.parseInt(normalizeNumericInput(state.watermark.pageTo), 10);
  setBusy(true, 10);
  try {
    const output = await addArabicWatermarkToPdf(
      state.pdfBytes,
      state.fileName,
      {
        text: state.watermark.text,
        pageFrom: from,
        pageTo: to,
        position: state.watermark.position,
        opacity: state.watermark.opacity,
        fontSize: state.watermark.fontSize,
        color: state.watermark.color,
      },
      updateProgress
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
    setBusy(false, 0);
  }
});

// Outputs bulk actions & modal
dom.downloadZipBtn.addEventListener('click', async () => {
  if (state.outputs.length === 0) return;
  dom.downloadZipBtn.disabled = true;
  dom.downloadZipBtn.textContent = 'جارٍ الضغط...';
  try {
    await downloadOutputsAsZip(state.outputs, 'MuedPdfPro_Outputs.zip');
    setStatus({
      kind: 'success',
      text: `تم تنزيل حزمة ZIP تحتوي على ${state.outputs.length} ملفات`,
    });
  } catch (err) {
    setStatus({
      kind: 'error',
      text: `تعذر ضغط الملفات: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
    });
  } finally {
    dom.downloadZipBtn.disabled = false;
    dom.downloadZipBtn.textContent = 'تنزيل الكل (ZIP)';
  }
});

dom.clearOutputsBtn.addEventListener('click', () => {
  replaceOutputs([]);
  setStatus({ kind: 'info', text: 'تم مسح قائمة الملفات الناتجة' });
});

dom.pngModal.addEventListener('click', closePngModal);
dom.pngModalCard.addEventListener('click', (e) => e.stopPropagation());
dom.pngModalClose.addEventListener('click', closePngModal);
dom.pngModalDownload.addEventListener('click', () => {
  if (state.modalFile) downloadOutputFile(state.modalFile);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.modalFile) closePngModal();
});
window.addEventListener('beforeunload', () => {
  state.outputs.forEach((f) => URL.revokeObjectURL(f.url));
});

syncActionButtons();
