import { layoutCueMarkers, type PlotMarker } from './markers';
import type { LoudnessPlot, SpectrogramData, WaveformData } from './plots';
import { colorMap } from './plots';

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

function canvas2d(width: number, height: number): { canvas: CanvasLike; ctx: CanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is unavailable');
    return { canvas, ctx: ctx as unknown as CanvasRenderingContext2D };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  return { canvas, ctx };
}

function paintFrame(ctx: CanvasRenderingContext2D, width: number, height: number, title: string): void {
  ctx.fillStyle = '#12141a';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '16px Segoe UI, sans-serif';
  ctx.fillText(title, 16, 28);
}

export function drawSpectrogram(canvas: CanvasLike | null, data: SpectrogramData, title: string, markers?: PlotMarker[]): CanvasLike {
  const width = 1200;
  const height = 500;
  const made = canvas ? null : canvas2d(width, height);
  const target = canvas ?? made!.canvas;
  const ctx = (canvas ? (canvas.getContext('2d') as CanvasRenderingContext2D | null) : made!.ctx);
  if (!ctx) throw new Error('2D canvas is unavailable');
  if ('width' in target) {
    target.width = width;
    target.height = height;
  }
  paintFrame(ctx, width, height, title);
  const left = 70;
  const top = 48;
  const plotW = 980;
  const plotH = 400;
  let min = Infinity;
  let max = -Infinity;
  for (const row of data.db) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || max <= min) {
    min = -100;
    max = 0;
  }
  const cellW = plotW / data.cols;
  const cellH = plotH / data.rows;
  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      const t = (data.db[r][c] - min) / (max - min);
      const [red, g, b] = colorMap(t);
      ctx.fillStyle = `rgb(${red},${g},${b})`;
      const y = top + plotH - (r + 1) * cellH;
      ctx.fillRect(left + c * cellW, y, Math.ceil(cellW), Math.ceil(cellH));
    }
  }
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '14px Segoe UI, sans-serif';
  ctx.fillText('Hz', 16, top + 14);
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const row = Math.round(frac * (data.rows - 1));
    const y = top + plotH - frac * plotH;
    ctx.fillText(`${Math.round(data.freqs[row])} Hz`, 8, y);
  }
  const lastT = data.times[data.times.length - 1] ?? 0;
  ctx.fillText('0 s', left, top + plotH + 22);
  ctx.fillText(`${lastT.toFixed(1)} s`, left + plotW - 48, top + plotH + 22);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const [r, g, b] = colorMap(t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(1080, top + i * 28, 28, 20);
    ctx.fillStyle = '#e8eaf0';
    ctx.fillText(`${Math.round(min + (max - min) * (1 - t))} dB`, 1116, top + i * 28 + 16);
  }
  drawMarkers(ctx, markers, data.times[data.times.length - 1] ?? 1, left, top, plotW, plotH);
  return target;
}

export function drawLoudness(canvas: CanvasLike | null, data: LoudnessPlot, title: string, markers?: PlotMarker[]): CanvasLike {
  const width = 1200;
  const height = 300;
  const made = canvas ? null : canvas2d(width, height);
  const target = canvas ?? made!.canvas;
  const ctx = canvas ? (canvas.getContext('2d') as CanvasRenderingContext2D | null) : made!.ctx;
  if (!ctx) throw new Error('2D canvas is unavailable');
  if ('width' in target) {
    target.width = width;
    target.height = height;
  }
  paintFrame(ctx, width, height, title);
  const left = 70;
  const top = 48;
  const plotW = 1080;
  const plotH = 210;
  const values = data.series.map((p) => p.lufs).filter((v) => Number.isFinite(v));
  const min = Math.min(data.targetLufs, ...(values.length ? values : [-40])) - 2;
  const max = Math.max(data.targetLufs, ...(values.length ? values : [-8])) + 2;
  const xOf = (t: number) => {
    const end = data.series[data.series.length - 1]?.t ?? 1;
    return left + (end <= 0 ? 0 : t / end) * plotW;
  };
  const yOf = (lufs: number) => top + ((max - lufs) / (max - min)) * plotH;
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.series.forEach((p, i) => {
    const x = xOf(p.t);
    const y = yOf(p.lufs);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#f0b429';
  ctx.beginPath();
  ctx.moveTo(left, yOf(data.targetLufs));
  ctx.lineTo(left + plotW, yOf(data.targetLufs));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '14px Segoe UI, sans-serif';
  ctx.fillText(`${max.toFixed(0)} LUFS`, 8, top + 14);
  ctx.fillText(`${min.toFixed(0)} LUFS`, 8, top + plotH);
  ctx.fillText(`target ${data.targetLufs.toFixed(1)} LUFS`, left + plotW - 180, 28);
  if (values.length) {
    ctx.fillText(`min ${Math.min(...values).toFixed(1)}`, left, top + plotH + 22);
    ctx.fillText(`max ${Math.max(...values).toFixed(1)}`, left + 140, top + plotH + 22);
  }
  ctx.fillText('seconds', left + plotW - 70, top + plotH + 22);
  const end = data.series[data.series.length - 1]?.t ?? 1;
  drawMarkers(ctx, markers, end, left, top, plotW, plotH);
  return target;
}

export function drawWaveform(
  canvas: CanvasLike | null,
  data: WaveformData,
  title: string,
  seconds: number,
  markers?: PlotMarker[],
): CanvasLike {
  const width = 1200;
  const height = 300;
  const made = canvas ? null : canvas2d(width, height);
  const target = canvas ?? made!.canvas;
  const ctx = canvas ? (canvas.getContext('2d') as CanvasRenderingContext2D | null) : made!.ctx;
  if (!ctx) throw new Error('2D canvas is unavailable');
  if ('width' in target) {
    target.width = width;
    target.height = height;
  }
  paintFrame(ctx, width, height, title);
  const left = 70;
  const top = 48;
  const plotW = 1080;
  const half = 100;
  const draw = (min: number[], max: number[], y0: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < data.columns; i++) {
      const x = left + (i / Math.max(1, data.columns - 1)) * plotW;
      const y1 = y0 + half / 2 - max[i] * (half / 2);
      const y2 = y0 + half / 2 - min[i] * (half / 2);
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  };
  draw(data.leftMin, data.leftMax, top, '#67e8f9');
  draw(data.rightMin, data.rightMax, top + half + 8, '#f0b429');
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '14px Segoe UI, sans-serif';
  ctx.fillText('L  0 dBFS', 8, top + 16);
  ctx.fillText('R  0 dBFS', 8, top + half + 24);
  ctx.strokeStyle = '#343a52';
  data.barTimes.forEach((t, index) => {
    if (seconds <= 0) return;
    const x = left + (t / seconds) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + half * 2 + 8);
    ctx.stroke();
    ctx.fillText(String(index + 1), x + 2, top + half * 2 + 24);
  });
  drawMarkers(ctx, markers, seconds, left, top, plotW, half * 2 + 8);
  return target;
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  markers: PlotMarker[] | undefined,
  duration: number,
  plotLeft: number,
  top: number,
  plotW: number,
  plotH: number,
): void {
  if (!markers || markers.length === 0) return;
  const laid = layoutCueMarkers(markers, duration, plotLeft, plotW);
  ctx.save();
  ctx.font = '14px Segoe UI, sans-serif';
  laid.forEach((marker, index) => {
    ctx.strokeStyle = marker.type === 'talking' ? '#86efac' : '#f0b429';
    ctx.beginPath();
    ctx.moveTo(marker.x, top);
    ctx.lineTo(marker.x, top + plotH);
    ctx.stroke();
    ctx.fillStyle = '#e8eaf0';
    ctx.fillText(marker.label, marker.x + 4, top + 18 + (index % 4) * 16);
  });
  ctx.restore();
}

export async function canvasToPngBytes(canvas: CanvasLike): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
  }
  const node = canvas as HTMLCanvasElement;
  const blob = await new Promise<Blob>((resolve, reject) => {
    node.toBlob((out) => (out ? resolve(out) : reject(new Error('PNG encode failed'))), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}
