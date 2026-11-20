import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { OutputFile, ParsedPageRange, WatermarkPosition } from '../types/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '،': ',',
  'ـ': '-',
  '–': '-',
  '—': '-',
};

export function normalizeNumericInput(input: string): string {
  return input.replace(/[٠-٩،ـ–—]/g, (ch) => ARABIC_DIGITS_MAP[ch] ?? ch);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ك.ب`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} م.ب`;
}

function stripPdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, '').trim() || 'document';
}

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parsePageRanges(rawInput: string, totalPages: number): ParsedPageRange[] {
  if (totalPages <= 0) {
    throw new Error('لم يتم تحميل ملف PDF صالح بعد');
  }
  const normalized = normalizeNumericInput(rawInput).trim();
  if (!normalized) {
    throw new Error('يرجى إدخال نطاق صفحات صالح مثل 1-3,4-6');
  }

  const tokens = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error('يرجى إدخال نطاق صفحات صالح');
  }

  const results: ParsedPageRange[] = [];

  for (const token of tokens) {
    if (token.includes('-')) {
      const parts = token.split('-').map((s) => s.trim());
      if (parts.length !== 2) {
        throw new Error(`صيغة نطاق غير صالحة: "${token}"`);
      }
      const start = Number.parseInt(parts[0], 10);
      const end = Number.parseInt(parts[1], 10);
      if (Number.isNaN(start) || Number.isNaN(end)) {
        throw new Error(`أرقام غير صالحة في النطاق: "${token}"`);
      }
      if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
        throw new Error(`النطاق "${token}" خارج حدود الصفحات (1 إلى ${totalPages})`);
      }
      if (start > end) {
        throw new Error(`بداية النطاق أكبر من نهايته في "${token}"`);
      }
      const pages: number[] = [];
      for (let p = start; p <= end; p++) {
        pages.push(p);
      }
      results.push({ start, end, label: `${start}-${end}`, pages });
    } else {
      const page = Number.parseInt(token, 10);
      if (Number.isNaN(page)) {
        throw new Error(`رقم صفحة غير صالح: "${token}"`);
      }
      if (page < 1 || page > totalPages) {
        throw new Error(`الصفحة ${page} خارج حدود الملف (1 إلى ${totalPages})`);
      }
      results.push({ start: page, end: page, label: `${page}`, pages: [page] });
    }
  }

  return results;
}

export async function inspectPdfBytes(bytes: Uint8Array): Promise<{ pageCount: number }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = doc.getPageCount();
  if (pageCount <= 0) {
    throw new Error('ملف PDF لا يحتوي على صفحات');
  }
  return { pageCount };
}

export async function splitPdfDocument(
  bytes: Uint8Array,
  originalName: string,
  rangesInput: string,
  onProgress?: (percent: number) => void
): Promise<OutputFile[]> {
  const sourceDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = sourceDoc.getPageCount();
  const parsedRanges = parsePageRanges(rangesInput, totalPages);
  const baseName = stripPdfExtension(originalName);

  const outputs: OutputFile[] = [];

  for (let idx = 0; idx < parsedRanges.length; idx++) {
    const range = parsedRanges[idx];
    const newDoc = await PDFDocument.create();
    const zeroBasedIndices = range.pages.map((p) => p - 1);
    const copiedPages = await newDoc.copyPages(sourceDoc, zeroBasedIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    const outBytes = await newDoc.save();
    const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const fileName = `${baseName}_part${idx + 1}_p${range.label}.pdf`;

    outputs.push({
      id: makeId(),
      name: fileName,
      mimeType: 'application/pdf',
      blob,
      url: URL.createObjectURL(blob),
      size: blob.size,
      detail:
        range.pages.length === 1
          ? `صفحة ${range.start}`
          : `الصفحات ${range.start}–${range.end} (${range.pages.length} صفحات)`,
      createdAt: Date.now(),
    });

    onProgress?.(Math.round(((idx + 1) / parsedRanges.length) * 100));
  }

  return outputs;
}

export async function convertPdfToPngImages(
  bytes: Uint8Array,
  originalName: string,
  options: { scale: number; pageFrom: number; pageTo: number },
  onProgress?: (percent: number) => void
): Promise<OutputFile[]> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;

  try {
    const total = pdf.numPages;
    const from = Math.max(1, Math.min(total, options.pageFrom));
    const to = Math.max(from, Math.min(total, options.pageTo));
    const count = to - from + 1;
    const baseName = stripPdfExtension(originalName);
    const outputs: OutputFile[] = [];

    for (let pageNum = from; pageNum <= to; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: options.scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('تعذر تهيئة محرك الرسم لتحويل الصفحة إلى صورة');
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error(`تعذر تصدير الصفحة ${pageNum} بصيغة PNG`));
        }, 'image/png');
      });

      const paddedPage = String(pageNum).padStart(String(total).length, '0');
      outputs.push({
        id: makeId(),
        name: `${baseName}_page_${paddedPage}.png`,
        mimeType: 'image/png',
        blob,
        url: URL.createObjectURL(blob),
        size: blob.size,
        detail: `صفحة ${pageNum} · ${canvas.width}×${canvas.height} بكسل (${options.scale}x)`,
        createdAt: Date.now(),
      });

      page.cleanup();
      onProgress?.(Math.round(((pageNum - from + 1) / count) * 100));
    }

    return outputs;
  } finally {
    await loadingTask.destroy();
  }
}

async function renderArabicWatermarkOverlayPng(
  pageWidthPt: number,
  pageHeightPt: number,
  options: {
    text: string;
    position: WatermarkPosition;
    opacity: number;
    fontSize: number;
    color: string;
  }
): Promise<Uint8Array> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Use 2x raster resolution relative to PDF points for razor-sharp Arabic text
  const renderScale = 2;
  const maxDimension = 2400;
  const rawW = pageWidthPt * renderScale;
  const rawH = pageHeightPt * renderScale;
  const clampFactor = Math.min(1, maxDimension / Math.max(rawW, rawH));

  const width = Math.max(200, Math.round(rawW * clampFactor));
  const height = Math.max(200, Math.round(rawH * clampFactor));
  const effScale = (width / pageWidthPt);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر إنشاء طبقة العلامة المائية');
  }

  ctx.clearRect(0, 0, width, height);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = options.color;
  ctx.globalAlpha = Math.max(0.05, Math.min(1, options.opacity));

  const scaledFontPx = Math.max(12, Math.round(options.fontSize * effScale));
  ctx.font = `700 ${scaledFontPx}px "Cairo", "IBM Plex Sans Arabic", sans-serif`;

  const lines = options.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const drawLines = (cx: number, cy: number) => {
    const lineHeight = scaledFontPx * 1.35;
    const totalH = (lines.length - 1) * lineHeight;
    lines.forEach((line, idx) => {
      ctx.fillText(line, cx, cy - totalH / 2 + idx * lineHeight);
    });
  };

  if (options.position === 'diagonal') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-35 * Math.PI) / 180);
    drawLines(0, 0);
    ctx.restore();
  } else if (options.position === 'center') {
    drawLines(width / 2, height / 2);
  } else if (options.position === 'top') {
    drawLines(width / 2, Math.max(scaledFontPx * 1.4, height * 0.08));
  } else if (options.position === 'bottom') {
    drawLines(width / 2, height - Math.max(scaledFontPx * 1.4, height * 0.08));
  } else if (options.position === 'tiled') {
    const measured = Math.max(...lines.map((l) => ctx.measureText(l).width), scaledFontPx * 4);
    const stepX = Math.max(measured + scaledFontPx * 2.2, width * 0.38);
    const stepY = Math.max(scaledFontPx * 4.2, height * 0.22);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-30 * Math.PI) / 180);
    const span = Math.hypot(width, height);
    for (let y = -span / 2; y <= span / 2; y += stepY) {
      for (let x = -span / 2; x <= span / 2; x += stepX) {
        drawLines(x, y);
      }
    }
    ctx.restore();
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((res) => {
      if (res) resolve(res);
      else reject(new Error('تعذر توليد صورة العلامة المائية'));
    }, 'image/png');
  });

  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function addArabicWatermarkToPdf(
  bytes: Uint8Array,
  originalName: string,
  options: {
    text: string;
    pageFrom: number;
    pageTo: number;
    position: WatermarkPosition;
    opacity: number;
    fontSize: number;
    color: string;
  },
  onProgress?: (percent: number) => void
): Promise<OutputFile> {
  const trimmedText = options.text.trim();
  if (!trimmedText) {
    throw new Error('يرجى إدخال نص العلامة المائية أولاً');
  }

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  if (
    Number.isNaN(options.pageFrom) ||
    Number.isNaN(options.pageTo) ||
    options.pageFrom < 1 ||
    options.pageTo < 1 ||
    options.pageFrom > totalPages ||
    options.pageTo > totalPages ||
    options.pageFrom > options.pageTo
  ) {
    throw new Error(`نطاق الصفحات غير صالح (اختر بين 1 و ${totalPages})`);
  }

  const targetCount = options.pageTo - options.pageFrom + 1;
  const cachedByDimension = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();

  for (let pageNum = options.pageFrom; pageNum <= options.pageTo; pageNum++) {
    const page = pdfDoc.getPage(pageNum - 1);
    const { width, height } = page.getSize();
    const dimKey = `${Math.round(width)}x${Math.round(height)}`;

    let embeddedImg = cachedByDimension.get(dimKey);
    if (!embeddedImg) {
      const pngBytes = await renderArabicWatermarkOverlayPng(width, height, {
        text: trimmedText,
        position: options.position,
        opacity: options.opacity,
        fontSize: options.fontSize,
        color: options.color,
      });
      embeddedImg = await pdfDoc.embedPng(pngBytes);
      cachedByDimension.set(dimKey, embeddedImg);
    }

    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width,
      height,
    });

    onProgress?.(Math.round(((pageNum - options.pageFrom + 1) / targetCount) * 100));
  }

  const outBytes = await pdfDoc.save();
  const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const baseName = stripPdfExtension(originalName);

  return {
    id: makeId(),
    name: `${baseName}_watermarked.pdf`,
    mimeType: 'application/pdf',
    blob,
    url: URL.createObjectURL(blob),
    size: blob.size,
    detail: `علامة مائية على الصفحات ${options.pageFrom}–${options.pageTo}`,
    createdAt: Date.now(),
  };
}

export async function renderPdfPagePreview(
  bytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  containerWidth: number
): Promise<{ pageWidthPt: number; pageHeightPt: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;

  try {
    const safePage = Math.max(1, Math.min(pdf.numPages, pageNumber));
    const page = await pdf.getPage(safePage);
    const baseViewport = page.getViewport({ scale: 1 });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const desiredCssWidth = Math.max(260, Math.min(containerWidth, 720));
    const scale = (desiredCssWidth / baseViewport.width) * dpr;
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('تعذر تهيئة معاينة الصفحة');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    page.cleanup();
    return {
      pageWidthPt: Math.round(baseViewport.width),
      pageHeightPt: Math.round(baseViewport.height),
    };
  } finally {
    await loadingTask.destroy();
  }
}

export async function createSampleArabicPdf(): Promise<{ bytes: Uint8Array; name: string }> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const sections = [
    {
      number: '01',
      title: 'ملخص التقرير الإداري السنوي',
      subtitle: 'إدارة الوثائق والأرشفة الإلكترونية — نسخة نموذجية للاختبار',
      body: [
        'يهدف هذا المستند النموذجي المكون من ست صفحات إلى تمكينك من تجربة جميع',
        'أدوات موعد اللوز PDF PRO بشكل فوري قبل رفع ملفاتك الخاصة.',
        'يمكنك تجزئة الملف وفق نطاقات مخصصة مثل 1-3,4-6، أو تحويل صفحاته',
        'إلى صور PNG فائقة الوضوح، أو إضافة علامة مائية عربية متناسقة.',
      ],
      metric: 'إجمالي الصفحات: 6 صفحات قياسية A4',
    },
    {
      number: '02',
      title: 'معايير تنظيم وتجزئة المستندات',
      subtitle: 'تقسيم العقود والتقارير إلى ملفات مستقلة بدقة تامة',
      body: [
        'عند التعامل مع ملفات كبيرة الحجم، يتيح لك تقسيم المستند حسب النطاقات',
        'استخراج الفصول المطلوبة فقط ومشاركتها بسهولة مع فرق العمل والعملاء.',
        'تُحفظ البنية الأصلية لكل صفحة دون أي فقدان في الجودة أو الهوامش.',
      ],
      metric: 'نطاق مقترح للتجربة: 1-3,4-6',
    },
    {
      number: '03',
      title: 'جودة التصدير إلى صور PNG',
      subtitle: 'تحويل الصفحات لعروض التقديم والمراجعة البصرية',
      body: [
        'يدعم المحرك التصدير بدقات متعددة تصل إلى 3x لضمان وضوح النصوص',
        'والجداول العربية عند إدراجها في التقارير المصورة أو تطبيقات المراسلة.',
        'تتم المعالجة بالكامل محلياً داخل متصفحك للحفاظ على خصوصية مستنداتك.',
      ],
      metric: 'الدقة الافتراضية: 2x (جودة عالية)',
    },
    {
      number: '04',
      title: 'حماية الحقوق بالعلامات المائية العربية',
      subtitle: 'دعم كامل لتشكيل الحروف العربية والاتجاه من اليمين لليسار',
      body: [
        'تُصمَّم العلامة المائية عبر طبقة رسومية عالية الدقة تضمن ترابط الحروف',
        'العربية بشكل سليم تماماً دون تقطع أو انقلاب، مع تحكم كامل في الشفافية',
        'والحجم واللون والموضع القطري أو المتكرر على الصفحات المختارة.',
      ],
      metric: 'نص افتراضي: موعد اللوز العبيدي',
    },
    {
      number: '05',
      title: 'جدول المراجعة والتدقيق الداخلي',
      subtitle: 'قائمة التحقق قبل اعتماد النسخة النهائية للمستند',
      body: [
        '١. التأكد من تسلسل أرقام الصفحات في كل جزء بعد التجزئة.',
        '٢. مراجعة وضوح العلامة المائية بحيث لا تحجب النصوص الأساسية.',
        '٣. حفظ حزمة الملفات الناتجة بصيغة ZIP أو مشاركتها مباشرة.',
      ],
      metric: 'الحالة: جاهز للمعاينة والتصدير',
    },
    {
      number: '06',
      title: 'الخاتمة وبيانات الاعتماد',
      subtitle: 'موعد اللوز PDF PRO — أدوات معالجة PDF سريعة وآمنة',
      body: [
        'تم إنشاء هذه الصفحات الست برمجياً كملف PDF حقيقي قابل للطباعة',
        'والمعالجة الفورية. يمكنك في أي وقت اختيار أي ملف PDF من جهازك',
        'عبر زر "اختيار PDF" في الشريط العلوي أو بسحب الملف وإفلاته هنا.',
      ],
      metric: 'الصفحة الأخيرة · 6 / 6',
    },
  ];

  const pdfDoc = await PDFDocument.create();
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;
  const canvasW = 1190;
  const canvasH = 1684;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الملف النموذجي');

    // Paper canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subtle top accent line
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(80, 90, canvasW - 160, 6);

    // Header row
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1565C0';
    ctx.font = '700 28px "Cairo", sans-serif';
    ctx.fillText('موعد اللوز PDF PRO', canvasW - 80, 150);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText(`PAGE ${i + 1} / ${sections.length}`, 80, 150);

    // Section number & title
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.fillText(sec.number, canvasW - 80, 270);

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 54px "Cairo", sans-serif';
    ctx.fillText(sec.title, canvasW - 80, 355);

    ctx.fillStyle = '#475569';
    ctx.font = '600 30px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText(sec.subtitle, canvasW - 80, 420);

    // Hairline divider
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(80, 465, canvasW - 160, 2);

    // Body paragraphs
    ctx.fillStyle = '#1E293B';
    ctx.font = '400 32px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    sec.body.forEach((line, lineIdx) => {
      ctx.fillText(line, canvasW - 80, 560 + lineIdx * 72);
    });

    // Info block
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(80, 930, canvasW - 160, 130);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 930, canvasW - 160, 130);

    ctx.fillStyle = '#1565C0';
    ctx.font = '700 30px "Cairo", sans-serif';
    ctx.fillText(sec.metric, canvasW - 120, 1005);

    // Visual placeholder table rows (clean document lines)
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(80, 1140, canvasW - 160, 2);
    for (let r = 0; r < 4; r++) {
      const y = 1200 + r * 68;
      ctx.fillStyle = r % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      ctx.fillRect(80, y - 36, canvasW - 160, 56);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(canvasW - 460, y - 14, 340, 14);
      ctx.fillRect(120, y - 14, 180, 14);
    }

    // Footer
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(80, canvasH - 130, canvasW - 160, 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '500 24px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('مستند نموذجي للمعاينة والاختبار — موعد اللوز PDF PRO', canvasW - 80, canvasH - 80);

    ctx.textAlign = 'left';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText(`${i + 1} / ${sections.length}`, 80, canvasH - 80);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((res) => (res ? resolve(res) : reject(new Error('PNG error'))), 'image/png');
    });
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const embedded = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    page.drawImage(embedded, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
  }

  const outBytes = await pdfDoc.save();
  return {
    bytes: outBytes,
    name: 'تقرير_موعد_اللوز_النموذجي.pdf',
  };
}

export function downloadOutputFile(file: OutputFile): void {
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadOutputsAsZip(files: OutputFile[], zipName: string): Promise<void> {
  const zip = new JSZip();
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareOutputFile(file: OutputFile): Promise<'shared' | 'downloaded'> {
  try {
    const webFile = new File([file.blob], file.name, { type: file.mimeType });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [webFile] })) {
      await navigator.share({
        title: file.name,
        text: 'تمت المعالجة بواسطة موعد اللوز PDF PRO',
        files: [webFile],
      });
      return 'shared';
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'shared';
    }
  }
  downloadOutputFile(file);
  return 'downloaded';
}
