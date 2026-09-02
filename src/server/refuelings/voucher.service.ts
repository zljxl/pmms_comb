import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '../database/prisma';
import { uploadObject } from '../storage/r2';

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const decimal = (value: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export async function generateRefuelingVoucher(refuelingId: number) {
  const item = await prisma.refueling.findUnique({
    where: { id: refuelingId },
    include: {
      user: { select: { nome: true, matricula: true } },
      vehicle: true,
      secretaria: true,
      station: true,
    },
  });
  if (!item) throw new Error('Abastecimento não encontrado para geração do comprovante.');

  const document = await PDFDocument.create();
  const page = document.addPage([280, 650]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const crestBytes = await readFile(
    path.join(process.cwd(), 'public', 'branding', 'municipal-crest.png'),
  );
  const crest = await document.embedPng(crestBytes);
  const navy = rgb(0.06, 0.16, 0.25);
  const muted = rgb(0.36, 0.41, 0.48);
  const lineColor = rgb(0.84, 0.86, 0.89);
  const left = 24;
  const right = 256;
  let y = 626;

  const center = (text: string, size: number, font = regular, color = navy) => {
    page.drawText(text, {
      x: (280 - font.widthOfTextAtSize(text, size)) / 2,
      y,
      size,
      font,
      color,
    });
    y -= size + 5;
  };
  const divider = () => {
    y -= 5;
    page.drawLine({
      start: { x: left, y },
      end: { x: right, y },
      thickness: 0.7,
      color: lineColor,
    });
    y -= 15;
  };
  const row = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: left, y, size: 7.5, font: bold, color: muted });
    const safeValue = value.length > 40 ? `${value.slice(0, 39)}...` : value;
    page.drawText(safeValue, {
      x: right - regular.widthOfTextAtSize(safeValue, 9),
      y: y - 1,
      size: 9,
      font: regular,
      color: navy,
    });
    y -= 20;
  };

  const logoSize = 58;
  page.drawImage(crest, {
    x: (280 - logoSize) / 2,
    y: y - logoSize,
    width: logoSize,
    height: logoSize * (crest.height / crest.width),
  });
  y -= 70;
  center('PREFEITURA MUNICIPAL', 10, bold);
  center('Sistema de Gestao de Frota', 8, regular, muted);
  divider();
  center('COMPROVANTE DE ABASTECIMENTO', 11, bold);
  center(item.externalCode || `ABAST-${item.id}`, 9, bold, rgb(0.08, 0.35, 0.65));
  divider();
  row('Data e hora', item.createdAt.toLocaleString('pt-BR'));
  row('Motorista', item.user.nome);
  row('Matricula', item.user.matricula);
  row(
    'Secretaria',
    `${item.secretaria.nome}${item.secretaria.sigla ? ` (${item.secretaria.sigla})` : ''}`,
  );
  row('Veiculo', `${item.vehicle.marca} ${item.vehicle.modelo}`);
  row('Placa', item.vehicle.placa);
  row('Hodometro', `${decimal(item.km, 0)} km`);
  divider();
  row('Posto', item.station?.name || item.fuelStation || 'Nao informado');
  row('Combustivel', item.fuelType);
  row('Quantidade', `${decimal(item.liters)} litros`);
  row('Preco por litro', currency(item.pricePerLiter));
  y -= 2;
  page.drawText('VALOR TOTAL', { x: left + 10, y: y - 17, size: 9, font: bold, color: navy });
  const total = currency(item.totalAmount);
  page.drawText(total, {
    x: right - 10 - bold.widthOfTextAtSize(total, 15),
    y: y - 20,
    size: 15,
    font: bold,
    color: navy,
  });
  y -= 54;
  center('Documento gerado eletronicamente', 7.5, regular, muted);
  center('Consulte a tramitacao no Sistema Municipal de Frota', 6.5, regular, muted);

  const period = item.createdAt.toISOString().slice(0, 7);
  const filename = `${item.externalCode || `abastecimento-${item.id}`}.pdf`;
  const key = `comprovantes/${period}/${filename}`;
  const relativeUrl = await uploadObject({
    key,
    body: await document.save(),
    contentType: 'application/pdf',
    contentDisposition: `inline; filename="${filename}"`,
  });

  const a4Document = await PDFDocument.create();
  const a4Page = a4Document.addPage([595.28, 841.89]);
  const a4Regular = await a4Document.embedFont(StandardFonts.Helvetica);
  const a4Bold = await a4Document.embedFont(StandardFonts.HelveticaBold);
  const pageLeft = 50;
  const pageRight = 545;
  let a4Y = 778;

  a4Page.drawImage(await a4Document.embedPng(crestBytes), {
    x: pageLeft,
    y: a4Y - 42,
    width: 42,
    height: 42 * (crest.height / crest.width),
  });
  a4Page.drawText('PREFEITURA MUNICIPAL', {
    x: 108,
    y: a4Y - 5,
    size: 15,
    font: a4Bold,
    color: navy,
  });
  a4Page.drawText('Sistema Municipal de Controle de Combustiveis', {
    x: 108,
    y: a4Y - 23,
    size: 9,
    font: a4Regular,
    color: muted,
  });
  a4Page.drawText('VIA PARA ARQUIVO', {
    x: pageRight - a4Bold.widthOfTextAtSize('VIA PARA ARQUIVO', 9),
    y: a4Y - 15,
    size: 9,
    font: a4Bold,
    color: rgb(0.08, 0.35, 0.65),
  });
  a4Y -= 62;
  a4Page.drawLine({
    start: { x: pageLeft, y: a4Y },
    end: { x: pageRight, y: a4Y },
    thickness: 1.2,
    color: navy,
  });
  a4Y -= 32;
  a4Page.drawText('COMPROVANTE DE ABASTECIMENTO', {
    x: pageLeft,
    y: a4Y,
    size: 16,
    font: a4Bold,
    color: navy,
  });
  const documentCode = item.externalCode || `ABAST-${item.id}`;
  a4Page.drawText(documentCode, {
    x: pageRight - a4Bold.widthOfTextAtSize(documentCode, 12),
    y: a4Y + 2,
    size: 12,
    font: a4Bold,
    color: rgb(0.08, 0.35, 0.65),
  });
  a4Y -= 36;

  const a4Section = (title: string) => {
    a4Page.drawRectangle({
      x: pageLeft,
      y: a4Y - 5,
      width: pageRight - pageLeft,
      height: 24,
      color: rgb(0.94, 0.96, 0.98),
    });
    a4Page.drawText(title, { x: pageLeft + 9, y: a4Y + 3, size: 9, font: a4Bold, color: navy });
    a4Y -= 31;
  };
  const a4Row = (label: string, value: string, x = pageLeft, width = pageRight - pageLeft) => {
    a4Page.drawText(label.toUpperCase(), { x, y: a4Y, size: 7, font: a4Bold, color: muted });
    const safeValue = value.length > 68 ? `${value.slice(0, 67)}...` : value;
    a4Page.drawText(safeValue, { x, y: a4Y - 14, size: 10, font: a4Regular, color: navy });
    a4Page.drawLine({
      start: { x, y: a4Y - 22 },
      end: { x: x + width - 12, y: a4Y - 22 },
      thickness: 0.5,
      color: lineColor,
    });
  };

  a4Section('IDENTIFICACAO DO ABASTECIMENTO');
  a4Row('Data e hora', item.createdAt.toLocaleString('pt-BR'), pageLeft, 245);
  a4Row('Situacao', item.status.replaceAll('_', ' '), 310, 235);
  a4Y -= 44;
  a4Row(
    'Secretaria',
    `${item.secretaria.nome}${item.secretaria.sigla ? ` (${item.secretaria.sigla})` : ''}`,
  );
  a4Y -= 44;
  a4Row('Motorista', item.user.nome, pageLeft, 330);
  a4Row('Matricula', item.user.matricula, 380, 165);
  a4Y -= 58;

  a4Section('VEICULO E FORNECEDOR');
  a4Row('Veiculo', `${item.vehicle.marca} ${item.vehicle.modelo}`, pageLeft, 270);
  a4Row('Placa', item.vehicle.placa, 320, 110);
  a4Row('Hodometro', `${decimal(item.km, 0)} km`, 440, 105);
  a4Y -= 44;
  a4Row('Posto', item.station?.name || item.fuelStation || 'Nao informado');
  a4Y -= 58;

  a4Section('DADOS FINANCEIROS E DE CONSUMO');
  a4Row('Combustivel', item.fuelType, pageLeft, 170);
  a4Row('Quantidade', `${decimal(item.liters)} litros`, 220, 135);
  a4Row('Preco por litro', currency(item.pricePerLiter), 365, 180);
  a4Y -= 54;
  a4Page.drawRectangle({
    x: pageLeft,
    y: a4Y - 18,
    width: pageRight - pageLeft,
    height: 46,
    color: rgb(0.06, 0.16, 0.25),
  });
  a4Page.drawText('VALOR TOTAL DO ABASTECIMENTO', {
    x: pageLeft + 14,
    y: a4Y,
    size: 10,
    font: a4Bold,
    color: rgb(1, 1, 1),
  });
  const a4Total = currency(item.totalAmount);
  a4Page.drawText(a4Total, {
    x: pageRight - 14 - a4Bold.widthOfTextAtSize(a4Total, 18),
    y: a4Y - 3,
    size: 18,
    font: a4Bold,
    color: rgb(1, 1, 1),
  });
  a4Y -= 82;

  a4Section('CONTROLE DO ARQUIVO');
  a4Page.drawText(
    'Documento gerado eletronicamente pelo Sistema Municipal de Controle de Combustiveis.',
    {
      x: pageLeft,
      y: a4Y,
      size: 9,
      font: a4Regular,
      color: muted,
    },
  );
  a4Page.drawText(`Codigo de verificacao: ${item.uid || documentCode}`, {
    x: pageLeft,
    y: a4Y - 18,
    size: 9,
    font: a4Regular,
    color: muted,
  });
  a4Page.drawLine({
    start: { x: pageLeft, y: 105 },
    end: { x: 260, y: 105 },
    thickness: 0.7,
    color: muted,
  });
  a4Page.drawLine({
    start: { x: 335, y: 105 },
    end: { x: pageRight, y: 105 },
    thickness: 0.7,
    color: muted,
  });
  a4Page.drawText('Responsavel pelo arquivamento', {
    x: 82,
    y: 89,
    size: 8,
    font: a4Regular,
    color: muted,
  });
  a4Page.drawText('Data de recebimento', {
    x: 390,
    y: 89,
    size: 8,
    font: a4Regular,
    color: muted,
  });

  const a4Filename = `${item.externalCode || `abastecimento-${item.id}`}-A4.pdf`;
  const a4Url = await uploadObject({
    key: `comprovantes/${period}/${a4Filename}`,
    body: await a4Document.save(),
    contentType: 'application/pdf',
    contentDisposition: `inline; filename="${a4Filename}"`,
  });
  const printFormat = process.env.REFUELING_VOUCHER_PRINT_FORMAT?.trim().toUpperCase();
  const printUrl = printFormat === 'A4' ? a4Url : relativeUrl;

  await prisma.$transaction([
    prisma.refueling.update({
      where: { id: item.id },
      data: { voucherPdf: relativeUrl, voucherA4Pdf: a4Url },
    }),
    prisma.auditLog.create({
      data: {
        userId: item.userId,
        action: 'GEROU_CUPOM_ABASTECIMENTO',
        entity: 'Refueling',
        entityId: String(item.id),
        description: 'Cupom PDF gerado e vinculado ao abastecimento.',
        newData: JSON.stringify({
          attachment: printUrl,
          receiptAttachment: relativeUrl,
          archiveAttachment: a4Url,
          printFormat: printFormat === 'A4' ? 'A4' : 'RECEIPT',
        }),
      },
    }),
  ]);
  return { receiptUrl: relativeUrl, a4Url, printUrl };
}
