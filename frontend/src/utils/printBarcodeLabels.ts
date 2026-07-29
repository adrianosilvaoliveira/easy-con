/**
 * Imprime etiquetas com código de barras (Code128 / EAN) via janela de impressão do navegador.
 */
export type LabelItem = {
  name: string;
  barcode: string;
  internalCode?: string;
  isKit?: boolean;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function printBarcodeLabels(items: LabelItem[]) {
  const valid = items.filter((i) => i.barcode?.trim());
  if (!valid.length) {
    throw new Error('Nenhum item com código de barras para imprimir');
  }

  const JsBarcode = (await import('jsbarcode')).default;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=600');
  if (!win) {
    throw new Error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
  }

  const labelsHtml = valid
    .map((item, index) => {
      const svgId = `barcode-${index}`;
      return `
      <div class="label">
        <div class="name">${escapeHtml(item.name)}${item.isKit ? ' <span class="kit">KIT</span>' : ''}</div>
        ${item.internalCode ? `<div class="code">${escapeHtml(item.internalCode)}</div>` : ''}
        <svg id="${svgId}"></svg>
        <div class="barcode-text">${escapeHtml(item.barcode)}</div>
      </div>`;
    })
    .join('');

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
    .kit {
      color: #0f766e;
      font-size: 9px;
    }
    .code {
      font-size: 9px;
      color: #64748b;
      margin-top: 1mm;
      font-family: ui-monospace, monospace;
    }
    .barcode-text {
      font-size: 11px;
      letter-spacing: 0.05em;
      font-family: ui-monospace, monospace;
      margin-top: 1mm;
    }
    svg { max-width: 100%; height: auto; }
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

  await new Promise((r) => setTimeout(r, 50));

  valid.forEach((item, index) => {
    const el = win.document.getElementById(`barcode-${index}`);
    if (!el) return;
    try {
      JsBarcode(el, item.barcode, {
        format: /^\d{13}$/.test(item.barcode) ? 'EAN13' : 'CODE128',
        width: 1.4,
        height: 40,
        displayValue: false,
        margin: 0,
      });
    } catch {
      JsBarcode(el, item.barcode, {
        format: 'CODE128',
        width: 1.4,
        height: 40,
        displayValue: false,
        margin: 0,
      });
    }
  });

  win.focus();
  win.print();
}
