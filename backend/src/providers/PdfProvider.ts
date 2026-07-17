import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { OrganizationService } from '../modules/organization/OrganizationService';

interface PdfColumn {
  header: string;
  key: string;
  /** Largura relativa (peso). Se omitido, divide igualmente. */
  width?: number;
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  userName?: string;
  filename: string;
  /** Paisagem — útil para tabelas com muitas colunas */
  landscape?: boolean;
}

const MARGIN = 40;
const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 16;
const FONT_SIZE = 8;
const FOOTER_Y_OFFSET = 28;

export class PdfProvider {
  static async generate(res: Response, options: PdfOptions): Promise<void> {
    const org = await OrganizationService.get();
    const landscape = options.landscape ?? options.columns.length >= 6;
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      bufferPages: true,
    });
    const date = new Date().toLocaleString('pt-BR');

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - MARGIN * 2;
    const tableBottom = pageHeight - MARGIN - FOOTER_Y_OFFSET;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${options.filename}.pdf"`
    );

    doc.pipe(res);

    const drawHeaderBlock = () => {
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(org.name, MARGIN, MARGIN, { width: contentWidth, align: 'center' });

      doc.fontSize(8).font('Helvetica').fillColor('#4b5563');
      if (org.address) {
        doc.text(org.address, { width: contentWidth, align: 'center' });
      }
      if (org.cnpj) {
        doc.text(`CNPJ: ${org.cnpj}`, { width: contentWidth, align: 'center' });
      }
      if (org.phone) {
        doc.text(`Tel: ${org.phone}`, { width: contentWidth, align: 'center' });
      }

      doc.moveDown(0.4);
      const lineY = doc.y;
      doc
        .moveTo(MARGIN, lineY)
        .lineTo(pageWidth - MARGIN, lineY)
        .strokeColor('#e5e7eb')
        .stroke();
      doc.moveDown(0.6);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(options.title, { width: contentWidth });

      if (options.subtitle) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#6b7280')
          .text(options.subtitle, { width: contentWidth });
      }

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#4b5563')
        .text(`Gerado em: ${date}${options.userName ? ` · Responsável: ${options.userName}` : ''}`, {
          width: contentWidth,
        });

      doc.moveDown(0.5);
      return doc.y;
    };

    let y = drawHeaderBlock();
    const colWidths = this.resolveColumnWidths(options.columns, contentWidth);
    const colXs = this.resolveColumnX(colWidths, MARGIN);

    const drawTableHeader = (atY: number) => {
      doc.save();
      doc.rect(MARGIN, atY, contentWidth, HEADER_HEIGHT).fill('#f3f4f6');
      doc.restore();

      doc.font('Helvetica-Bold').fontSize(FONT_SIZE).fillColor('#111827');
      options.columns.forEach((col, i) => {
        doc.text(
          this.truncate(doc, col.header, colWidths[i] - 4),
          colXs[i] + 2,
          atY + 4,
          { width: colWidths[i] - 4, lineBreak: false, height: FONT_SIZE + 2 }
        );
      });

      const bottom = atY + HEADER_HEIGHT;
      doc
        .moveTo(MARGIN, bottom)
        .lineTo(pageWidth - MARGIN, bottom)
        .strokeColor('#d1d5db')
        .stroke();
      return bottom + 2;
    };

    y = drawTableHeader(y);

    doc.font('Helvetica').fontSize(FONT_SIZE);

    for (let rowIndex = 0; rowIndex < options.rows.length; rowIndex++) {
      if (y + ROW_HEIGHT > tableBottom) {
        doc.addPage();
        y = MARGIN;
        y = drawTableHeader(y);
        doc.font('Helvetica').fontSize(FONT_SIZE);
      }

      const row = options.rows[rowIndex];

      if (rowIndex % 2 === 0) {
        doc.save();
        doc.rect(MARGIN, y, contentWidth, ROW_HEIGHT).fill('#f9fafb');
        doc.restore();
      }

      doc.fillColor('#111827');
      options.columns.forEach((col, i) => {
        const value = String(row[col.key] ?? '-');
        doc.text(this.truncate(doc, value, colWidths[i] - 4), colXs[i] + 2, y + 3, {
          width: colWidths[i] - 4,
          lineBreak: false,
          height: FONT_SIZE + 2,
        });
      });

      y += ROW_HEIGHT;
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          `Página ${i + 1} de ${pages.count} | Easy Stock`,
          MARGIN,
          pageHeight - MARGIN - 10,
          { align: 'center', width: contentWidth }
        );
    }

    doc.end();
  }

  private static resolveColumnWidths(columns: PdfColumn[], contentWidth: number): number[] {
    const weights = columns.map((c) => c.width ?? 1);
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    return weights.map((w) => (w / total) * contentWidth);
  }

  private static resolveColumnX(widths: number[], startX: number): number[] {
    const xs: number[] = [];
    let x = startX;
    for (const w of widths) {
      xs.push(x);
      x += w;
    }
    return xs;
  }

  private static truncate(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '-';
    if (doc.widthOfString(clean) <= maxWidth) return clean;

    let truncated = clean;
    while (truncated.length > 1 && doc.widthOfString(`${truncated}…`) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }
}
