const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const ROWS_PER_PAGE = 22;

type PrintableTransactionRow = {
  date: string;
  category: string;
  amount: string;
  type: string;
  description: string;
};

interface BuildProPdfOptions {
  transactions: PrintableTransactionRow[];
  userName?: string;
  scopeLabel: string;
  periodLabel: string;
  generatedAt?: Date;
  stats?: {
    realExpenses: string;
    futureExpenses: string;
    difference: string;
  };
  projections?: {
    expectedEndBalance: string;
    safeSpendingMargin: string;
    negativeRisk: string;
  };
}

interface PageContext extends BuildProPdfOptions {
  rows: PrintableTransactionRow[];
  pageNumber: number;
  totalPages: number;
}

interface PdfObject {
  id: number;
  body: string;
  stream?: Buffer;
}

const sanitizeText = (value: string | undefined | null) => {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
};

const escapePdfText = (value: string) =>
  sanitizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const truncateText = (value: string, maxLength: number) => {
  const safeValue = sanitizeText(value);
  if (safeValue.length <= maxLength) {
    return safeValue;
  }
  return `${safeValue.slice(0, Math.max(0, maxLength - 3))}...`;
};

const chunkRows = <T,>(rows: T[], chunkSize: number): T[][] => {
  if (rows.length === 0) {
    return [[]];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
};

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hours}:${minutes}`;
};

const buildPageContent = (ctx: PageContext) => {
  const commands: string[] = [];
  const footerY = 70;
  const headerY = 790;
  const summaryItems: { label: string; value: string }[] = [];
  if (ctx.pageNumber === 1) {
    if (ctx.stats) {
      summaryItems.push(
        { label: "Despesas reais", value: ctx.stats.realExpenses },
        { label: "Despesas previstas", value: ctx.stats.futureExpenses },
        { label: "Diferença", value: ctx.stats.difference }
      );
    }
    if (ctx.projections) {
      summaryItems.push(
        { label: "Saldo previsto", value: ctx.projections.expectedEndBalance },
        { label: "Margem segura", value: ctx.projections.safeSpendingMargin },
        { label: "Risco negativo", value: ctx.projections.negativeRisk }
      );
    }
  }
  const hasSummary = summaryItems.length > 0;
  const summaryRows = Math.ceil(summaryItems.length / 3);
  const summaryHeight = summaryRows * 60;
  const tableHeaderBase = 700;
  const tableHeaderY = hasSummary ? tableHeaderBase - (summaryRows - 1) * 40 - 60 : tableHeaderBase;

  commands.push(`BT /F2 22 Tf 50 ${headerY} Td (FinScope) Tj ET`);
  commands.push(`BT /F1 12 Tf 50 ${headerY - 20} Td (${escapePdfText("Relatorio de Transacoes")}) Tj ET`);
  commands.push(`BT /F1 10 Tf 50 ${headerY - 36} Td (${escapePdfText(`Conta: ${ctx.scopeLabel}`)}) Tj ET`);
  commands.push(`BT /F1 10 Tf 50 ${headerY - 52} Td (${escapePdfText(`Periodo: ${ctx.periodLabel}`)}) Tj ET`);
  if (ctx.userName) {
  commands.push(`BT /F1 10 Tf 50 ${headerY - 68} Td (${escapePdfText(`Usuario: ${ctx.userName}`)}) Tj ET`);
  }
  commands.push(
    `BT /F1 10 Tf 350 ${headerY - 52} Td (${escapePdfText(`Gerado em: ${formatDateTime(ctx.generatedAt || new Date())}`)}) Tj ET`
  );

  if (hasSummary) {
    const summaryY = headerY - 140;
    const rectangleHeight = summaryHeight || 70;
    commands.push(`0.96 g 50 ${summaryY} 495 ${rectangleHeight} re f`);
    commands.push("0 g");
    summaryItems.forEach((item, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const rowTop = summaryY + rectangleHeight - row * 60;
      const currentX = 60 + column * 160;
      commands.push(`BT /F1 9 Tf ${currentX} ${rowTop - 10} Td (${escapePdfText(item.label)}) Tj ET`);
      commands.push(`BT /F2 12 Tf ${currentX} ${rowTop - 28} Td (${escapePdfText(item.value)}) Tj ET`);
    });
  }

  commands.push(`0.92 g 50 ${tableHeaderY} 495 22 re f`);
  commands.push(`0 g 1 w 50 ${tableHeaderY} 495 22 re S`);
  commands.push("0 g");

  const columns = [
    { key: "date", label: "Data", x: 60, width: 60 },
    { key: "category", label: "Categoria", x: 130, width: 120 },
    { key: "amount", label: "Valor", x: 270, width: 70 },
    { key: "type", label: "Tipo", x: 360, width: 60 },
    { key: "description", label: "Descricao", x: 430, width: 150 },
  ] as const;

  columns.forEach((column) => {
    commands.push(`BT /F2 10 Tf ${column.x} ${tableHeaderY + 6} Td (${escapePdfText(column.label)}) Tj ET`);
  });
  commands.push(`0.5 w 50 ${tableHeaderY - 4} m 545 ${tableHeaderY - 4} l S`);

  let currentY = tableHeaderY - 18;
  if (ctx.rows.length === 0) {
    commands.push(`BT /F1 10 Tf 50 ${currentY} Td (${escapePdfText("Nenhuma transacao encontrada para o periodo selecionado.")}) Tj ET`);
  } else {
    ctx.rows.forEach((row) => {
      const sanitizedRow = {
        date: truncateText(row.date, 12),
        category: truncateText(row.category, 28),
        amount: truncateText(row.amount, 18),
        type: truncateText(row.type, 12),
        description: truncateText(row.description, 42),
      };
      columns.forEach((column) => {
        const value = (sanitizedRow as any)[column.key] as string;
        commands.push(`BT /F1 10 Tf ${column.x} ${currentY} Td (${escapePdfText(value)}) Tj ET`);
      });
      currentY -= 16;
    });
  }

  commands.push(`0.5 w 50 ${footerY + 20} m 545 ${footerY + 20} l S`);
  commands.push(`BT /F1 10 Tf 50 ${footerY} Td (${escapePdfText("FinScope - Plano PRO")}) Tj ET`);
  commands.push(
    `BT /F1 10 Tf 460 ${footerY} Td (${escapePdfText(`Pagina ${ctx.pageNumber}/${ctx.totalPages}`)}) Tj ET`
  );

  return commands.join("\n") + "\n";
};

const buildPdfBuffer = (objects: PdfObject[], catalogId: number) => {
  const headerBuffer = Buffer.from("%PDF-1.4\n", "utf8");
  const buffers: Buffer[] = [headerBuffer];
  const offsets: number[] = [0];

  let currentOffset = headerBuffer.length;
  objects
    .sort((a, b) => a.id - b.id)
    .forEach((object) => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from(`${object.id} 0 obj\n${object.body}\n`, "utf8"));
      if (object.stream) {
        parts.push(Buffer.from("stream\n", "utf8"));
        parts.push(object.stream);
        parts.push(Buffer.from("\nendstream\n", "utf8"));
      }
      parts.push(Buffer.from("endobj\n", "utf8"));
      const objBuffer = Buffer.concat(parts);
      offsets.push(currentOffset);
      buffers.push(objBuffer);
      currentOffset += objBuffer.length;
    });

  const xrefStart = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) {
    xref += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  buffers.push(Buffer.from(xref, "utf8"));

  return Buffer.concat(buffers);
};

export function buildProTransactionsPdf(options: BuildProPdfOptions) {
  const chunks = chunkRows(options.transactions, ROWS_PER_PAGE);
  const totalPages = chunks.length;
  const generatedAt = options.generatedAt || new Date();
  const pageContents = chunks.map((rows, index) =>
    buildPageContent({
      ...options,
      rows,
      pageNumber: index + 1,
      totalPages,
      generatedAt,
    })
  );

  let nextId = 1;
  const fontRegularId = nextId++;
  const fontBoldId = nextId++;
  const contentObjectIds = pageContents.map(() => nextId++);
  const pageObjectIds = pageContents.map(() => nextId++);
  const pagesObjectId = nextId++;
  const catalogObjectId = nextId++;

  const objects: PdfObject[] = [
    {
      id: fontRegularId,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    },
    {
      id: fontBoldId,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    },
  ];

  pageContents.forEach((content, index) => {
    const buffer = Buffer.from(content, "utf8");
    objects.push({
      id: contentObjectIds[index],
      body: `<< /Length ${buffer.length} >>`,
      stream: buffer,
    });
  });

  pageContents.forEach((_, index) => {
    objects.push({
      id: pageObjectIds[index],
      body: `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`,
    });
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.push({
    id: pagesObjectId,
    body: `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`,
  });

  objects.push({
    id: catalogObjectId,
    body: `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`,
  });

  return buildPdfBuffer(objects, catalogObjectId);
}
