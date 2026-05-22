/**
 * Extrai produtos do PDF Contrato.pdf → scripts/data/contrato-products.json
 * Uso: npx tsx scripts/parse-contrato-pdf.ts [caminho-do-pdf]
 */
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

export interface ContratoProductRow {
  code: string;
  name: string;
  brand: string;
  stock: number;
}

const HEADER_FRAG =
  /34\.515\.073\/0001-38|CNPJ\/CPF:|CENTRO DE DIAGNOSTICO|OFTALMOLOGICO MONTICUCO[^:]*:\s*|Inscrição Estadual|Preço Venda|Cód\. Produto|Código de Barras|Preço Fábrica|Preço Compra|Relatório de Produtos|Empresa:/gi;

function skipLine(line: string): boolean {
  return (
    /^(Página|--|\d{2}\/\d{2}\/\d{4})$/.test(line) ||
    /^(Descrição|Referência|Estoque|Custo|Preço|U\.M\.|Seção|Grupo|Marca|Tipo)$/.test(line) ||
    line === 'null' ||
    line === '14'
  );
}

function cleanName(name: string, brand: string): string {
  let n = name.replace(HEADER_FRAG, ' ').replace(/\s+/g, ' ').trim();
  if (brand) {
    const b = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    n = n.replace(new RegExp(`\\s*${b}\\s*$`, 'i'), '').trim();
  }
  return n;
}

export async function parseContratoPdf(pdfPath: string): Promise<ContratoProductRow[]> {
  const buf = fs.readFileSync(pdfPath);
  const { text } = await pdf(buf);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const products: ContratoProductRow[] = [];
  let nameParts: string[] = [];
  let stock = 0;
  let brand = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^1\d{3}$/.test(line)) {
      const name = cleanName(nameParts.join(' '), brand);
      if (name.length >= 2) {
        products.push({ code: line, name, brand, stock });
      }
      nameParts = [];
      stock = 0;
      brand = '';
      continue;
    }

    if (/^UND/.test(line)) {
      const inline = line.replace(/^UND\s*/, '').trim();
      if (inline) {
        brand = inline;
      } else {
        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j];
          if (/^1\d{3}$/.test(next) || next.startsWith('R$')) break;
          if (/^(\d{1,3}(?:\.\d{3})*|\d+),(\d{3})$/.test(next)) break;
          if (skipLine(next) || /^UND/.test(next)) break;
          brand = next.trim();
          i = j;
          break;
        }
      }
      continue;
    }

    if (/^UN$/.test(line)) continue;

    const stockMatch = line.match(/^(\d{1,3}(?:\.\d{3})*|\d+),(\d{3})$/);
    if (stockMatch) {
      stock = parseInt(stockMatch[1].replace(/\./g, ''), 10);
      continue;
    }

    if (line.startsWith('R$') || skipLine(line) || /^34\.515/.test(line)) {
      if (/^34\.515|Relatório|CENTRO DE/.test(line)) {
        nameParts = [];
      }
      continue;
    }

    nameParts.push(line);
  }

  const byCode = new Map<string, ContratoProductRow>();
  for (const p of products) {
    byCode.set(p.code, p);
  }
  return [...byCode.values()].sort((a, b) => Number(a.code) - Number(b.code));
}

async function main() {
  const pdfPath =
    process.argv[2] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'Contrato.pdf');
  const outPath = path.join(__dirname, 'data', 'contrato-products.json');
  const products = await parseContratoPdf(pdfPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2));
  console.log(`✅ ${products.length} produtos → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
