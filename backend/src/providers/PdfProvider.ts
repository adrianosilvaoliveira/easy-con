import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { OrganizationService } from '../modules/organization/OrganizationService';

interface PdfColumn {
  header: string;
  key: string;
  width?: number;
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  userName?: string;
  filename: string;
}

export class PdfProvider {
  static async generate(res: Response, options: PdfOptions): Promise<void> {
    const org = await OrganizationService.get();
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const date = new Date().toLocaleString('pt-BR');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${options.filename}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(org.name, { align: 'center' });
    if (org.address) {
      doc.fontSize(9).font('Helvetica').text(org.address, { align: 'center' });
    }
    if (org.cnpj) {
      doc.text(`CNPJ: ${org.cnpj}`, { align: 'center' });
    }
    if (org.phone) {
      doc.text(`Tel: ${org.phone}`, { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text(options.title);
    if (options.subtitle) {
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(options.subtitle);
      doc.fillColor('#000000');
    }
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#000000').text(`Gerado em: ${date}`);
    if (options.userName) doc.text(`Responsável: ${options.userName}`);
    doc.moveDown();

    const startX = 50;
    let y = doc.y;
    const colWidth = 495 / Math.max(options.columns.length, 1);

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
    options.columns.forEach((col, i) => {
      doc.text(col.header, startX + i * colWidth, y, { width: colWidth - 5 });
    });
    y += 15;
    doc.moveTo(50, y).lineTo(545, y).stroke('#e5e7eb');

    doc.font('Helvetica').fontSize(8);
    options.rows.forEach((row, rowIndex) => {
      y += 14;
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      if (rowIndex % 2 === 0) {
        doc.save();
        doc.rect(50, y - 2, 495, 14).fill('#f9fafb');
        doc.restore();
      }

      doc.fillColor('#000000');
      options.columns.forEach((col, i) => {
        const value = String(row[col.key] ?? '-');
        doc.text(value.substring(0, 40), startX + i * colWidth, y, {
          width: colWidth - 5,
          lineBreak: false,
        });
      });
    });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          `Página ${i + 1} de ${pages.count} | Easy Stock`,
          50,
          780,
          { align: 'center', width: 495 }
        );
    }

    doc.end();
  }
}
