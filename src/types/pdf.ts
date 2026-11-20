export type ToolTab = 'split' | 'png' | 'watermark';

export type WatermarkPosition = 'diagonal' | 'tiled' | 'center' | 'top' | 'bottom';

export interface WatermarkConfig {
  text: string;
  pageFrom: string;
  pageTo: string;
  position: WatermarkPosition;
  opacity: number;
  fontSize: number;
  color: string;
}

export interface ParsedPageRange {
  start: number;
  end: number;
  label: string;
  pages: number[];
}

export interface OutputFile {
  id: string;
  name: string;
  mimeType: 'application/pdf' | 'image/png';
  blob: Blob;
  url: string;
  size: number;
  detail: string;
  createdAt: number;
}

export interface StatusFeedback {
  kind: 'info' | 'success' | 'error';
  text: string;
}
