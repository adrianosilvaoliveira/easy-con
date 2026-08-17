/**
 * Imprime etiquetas com código de barras via janela do navegador.
 * Gera SVG Code128 localmente (sem chunk/CDN) para evitar falha de import no Vercel.
 */
export type KitContentLine = {
  name: string;
  quantity: number;
  internalCode?: string;
};

export type LabelItem = {
  name: string;
  barcode: string;
  internalCode?: string;
  isKit?: boolean;
  /** ID do produto/kit — usado para carregar o conteúdo na impressão. */
  productId?: string;
  /** Relação de produtos do kit (nome + quantidade). */
  kitContents?: KitContentLine[];
  /** Quantidade de cópias da etiqueta (padrão 1). */
  quantity?: number;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Padrões Code 128 (B) — 106 símbolos + stop. Valores = larguras 1/2/3/4. */
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

function code128Values(text: string): number[] {
  const values = [START_B];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) {
      throw new Error(`Caractere inválido no código de barras: ${text[i]}`);
    }
    values.push(code - 32);
  }
  let checksum = START_B;
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  values.push(checksum % 103);
  values.push(STOP);
  return values;
}

/** SVG Code128 (barras pretas) a partir de texto ASCII. */
export function code128Svg(text: string, barWidth = 1.5, height = 40): string {
  const values = code128Values(text);
  let x = 0;
  const rects: string[] = [];
  for (const value of values) {
    const pattern = CODE128_PATTERNS[value];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * barWidth;
      if (i % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`);
      }
      x += w;
    }
  }
  const width = x;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(text)}">${rects.join('')}</svg>`;
}

function formatLabelName(name: string) {
  return escapeHtml(name.trim().toLocaleUpperCase('pt-BR'));
}

function kitContentsHtml(contents: KitContentLine[] | undefined) {
  if (!contents?.length) return '';
  const rows = contents
    .map((line) => {
      const qty = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1;
      return `<li><span class="qty">${qty}×</span><span class="item-name">${formatLabelName(line.name)}</span></li>`;
    })
    .join('');
  return `<div class="contents">
    <div class="contents-title">Conteúdo do kit</div>
    <ul>${rows}</ul>
  </div>`;
}

export function printBarcodeLabels(items: LabelItem[], targetWindow?: Window) {
  const valid = items.filter((i) => i.barcode?.trim());
  if (!valid.length) {
    targetWindow?.close();
    throw new Error('Nenhum item com código de barras para imprimir');
  }

  const copies = valid.flatMap((item) => {
    const qty = Math.min(500, Math.max(1, Math.floor(item.quantity ?? 1)));
    return Array.from({ length: qty }, () => item);
  });

  // Abrir no mesmo tick do clique (sem await / import dinâmico), salvo janela já aberta.
  const win = targetWindow ?? window.open('', '_blank', 'width=800,height=600');
  if (!win) {
    throw new Error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
  }

  const labelsHtml = copies
    .map((item) => {
      let barcodeSvg: string;
      try {
        barcodeSvg = code128Svg(item.barcode.trim());
      } catch {
        barcodeSvg = `<div class="barcode-error">Código inválido</div>`;
      }
      const isKit = Boolean(item.isKit);
      const hasContents = isKit && Boolean(item.kitContents?.length);
      return `
      <div class="label${isKit ? ' label-kit' : ''}${hasContents ? ' label-kit-contents' : ''}">
        <div class="name">${formatLabelName(item.name)}${isKit ? ' <span class="kit">KIT</span>' : ''}</div>
        ${item.internalCode ? `<div class="code">${escapeHtml(item.internalCode)}</div>` : ''}
        <div class="barcode">${barcodeSvg}</div>
        <div class="barcode-text">${escapeHtml(item.barcode)}</div>
        ${kitContentsHtml(item.kitContents)}
      </div>`;
    })
    .join('');

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8mm;
      font-family: system-ui, sans-serif;
      color: #0f172a;
    }
    .sheet {
      display: flex;
      flex-wrap: wrap;
      gap: 6mm;
      align-content: flex-start;
    }
    .label {
      width: 60mm;
      min-height: 35mm;
      border: 1px dashed #cbd5e1;
      padding: 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-inside: avoid;
    }
    .label-kit-contents {
      width: 90mm;
      align-items: stretch;
      justify-content: flex-start;
    }
    .name {
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      line-height: 1.25;
      max-width: 100%;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .label-kit-contents .name {
      text-align: left;
      -webkit-line-clamp: 3;
    }
    .kit { color: #0f766e; font-size: 9px; }
    .code {
      font-size: 9px;
      color: #64748b;
      margin-top: 1mm;
      font-family: ui-monospace, monospace;
    }
    .label-kit-contents .code { text-align: left; }
    .contents {
      margin-top: 2.5mm;
      width: 100%;
      border-top: 0.4pt solid #cbd5e1;
      padding-top: 1.5mm;
      text-align: left;
    }
    .contents-title {
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      margin-bottom: 1mm;
    }
    .contents ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .contents li {
      font-size: 8px;
      line-height: 1.35;
      display: flex;
      gap: 1.5mm;
      break-inside: avoid;
    }
    .contents .qty {
      font-weight: 700;
      font-family: ui-monospace, monospace;
      flex-shrink: 0;
      min-width: 7mm;
    }
    .contents .item-name { min-width: 0; }
    .barcode {
      margin-top: 2mm;
      max-width: 100%;
      overflow: hidden;
      display: flex;
      justify-content: center;
    }
    .label-kit-contents .barcode { justify-content: flex-start; }
    .barcode svg { max-width: 100%; height: auto; }
    .barcode-text {
      font-size: 11px;
      letter-spacing: 0.05em;
      font-family: ui-monospace, monospace;
      margin-top: 1mm;
    }
    .label-kit-contents .barcode-text { text-align: left; }
    .barcode-error { color: #b91c1c; font-size: 10px; }
    @media print {
      body { padding: 0; }
      .label { border: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">${labelsHtml}</div>
</body>
</html>`);
  win.document.close();

  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      // janela pode ter sido fechada
    }
  }, 100);
}
