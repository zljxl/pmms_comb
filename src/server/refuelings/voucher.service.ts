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
  await prisma.$transaction([
    prisma.refueling.update({ where: { id: item.id }, data: { voucherPdf: relativeUrl } }),
    prisma.auditLog.create({
      data: {
        userId: item.userId,
        action: 'GEROU_CUPOM_ABASTECIMENTO',
        entity: 'Refueling',
        entityId: String(item.id),
        description: 'Cupom PDF gerado e vinculado ao abastecimento.',
        newData: JSON.stringify({ attachment: relativeUrl }),
      },
    }),
  ]);
  return relativeUrl;
}
