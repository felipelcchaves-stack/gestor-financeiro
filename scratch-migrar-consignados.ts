// Migração de dados REAL (não descartável): substitui o Passivo combinado
// "6 consignados Itaú (garantia CDB)" por 6 Passivos individuais, um por
// contrato real do Itaú (dados extraídos dos "Documento Descritivo de
// Crédito" enviados pelo Felipe em 12/09/2026). Ver plano em
// /Users/felipelcchaves/.claude/plans/entendi-a-proposta-do-sorted-lemur.md
//
// Roda uma vez. Não tem cleanup — o objetivo é deixar os 6 registros
// permanentemente no banco real.

import { randomUUID } from "crypto";
import { mkdir, copyFile } from "fs/promises";
import path from "path";
import { prisma } from "./src/lib/prisma";

const STORAGE_DIR = path.join(process.cwd(), "storage", "documentos");
const PASSIVO_ANTIGO_ID = "cmtu83yt9001etht74djpmxwy";
const ATIVO_CDB_ID = "cmtu83ytm001ptht7l3p293ps";

type Contrato = {
  numero: string;
  arquivoOrigem: string;
  saldoQuitacaoCentavos: number;
  custoMensalCentavos: number;
  taxaJurosPct: number;
  parcelaAtual: number;
  totalParcelas: number;
};

const CONTRATOS: Contrato[] = [
  {
    numero: "3264142369",
    arquivoOrigem: "/Users/felipelcchaves/Downloads/Documento.pdf",
    saldoQuitacaoCentavos: 7_938_677,
    custoMensalCentavos: 225_551,
    taxaJurosPct: 2.26,
    parcelaAtual: 1,
    totalParcelas: 72,
  },
  {
    numero: "2728846334",
    arquivoOrigem: "/Users/felipelcchaves/Downloads/Documento 2.pdf",
    saldoQuitacaoCentavos: 6_976_809,
    custoMensalCentavos: 208_507,
    taxaJurosPct: 2.26,
    parcelaAtual: 8,
    totalParcelas: 72,
  },
  {
    numero: "3006951390",
    arquivoOrigem: "/Users/felipelcchaves/Downloads/Documento 3.pdf",
    saldoQuitacaoCentavos: 15_345_088,
    custoMensalCentavos: 437_764,
    taxaJurosPct: 2.26,
    parcelaAtual: 0,
    totalParcelas: 72,
  },
  {
    numero: "3118485766",
    arquivoOrigem: "/Users/felipelcchaves/Downloads/Documento 4.pdf",
    saldoQuitacaoCentavos: 4_028_351,
    custoMensalCentavos: 114_712,
    taxaJurosPct: 2.05,
    parcelaAtual: 0,
    totalParcelas: 72,
  },
  {
    numero: "2869222998",
    arquivoOrigem: "/Users/felipelcchaves/Downloads/Documento 5 (recebido agora).pdf",
    saldoQuitacaoCentavos: 7_515_249,
    custoMensalCentavos: 214_658,
    taxaJurosPct: 2.26,
    parcelaAtual: 3,
    totalParcelas: 72,
  },
  {
    numero: "2861406995",
    arquivoOrigem: "/Users/felipelcchaves/Downloads/Documento 6 (recebido agora).pdf",
    saldoQuitacaoCentavos: 4_746_358,
    custoMensalCentavos: 148_771,
    taxaJurosPct: 2.66,
    parcelaAtual: 3,
    totalParcelas: 72,
  },
];

async function main() {
  const passivoAntigo = await prisma.passivo.findUniqueOrThrow({ where: { id: PASSIVO_ANTIGO_ID } });
  const ativoCdb = await prisma.ativo.findUniqueOrThrow({ where: { id: ATIVO_CDB_ID } });
  console.log(`Passivo antigo: ${passivoAntigo.nome} — saldo R$${(passivoAntigo.valorQuitacaoCentavos ?? 0) / 100}`);
  console.log(`Ativo CDB: ${ativoCdb.nome} — valor R$${ativoCdb.valorCentavos / 100}`);

  const somaSaldo = CONTRATOS.reduce((s, c) => s + c.saldoQuitacaoCentavos, 0);
  const somaParcela = CONTRATOS.reduce((s, c) => s + c.custoMensalCentavos, 0);
  console.log(`Soma dos 6 contratos: saldo R$${somaSaldo / 100} | parcela R$${somaParcela / 100}`);

  await mkdir(STORAGE_DIR, { recursive: true });

  await prisma.$transaction(async (tx) => {
    for (const contrato of CONTRATOS) {
      const extensao = path.extname(contrato.arquivoOrigem) || ".pdf";
      const nomeArmazenado = `${randomUUID()}${extensao}`;
      await copyFile(contrato.arquivoOrigem, path.join(STORAGE_DIR, nomeArmazenado));

      const documento = await tx.documento.create({
        data: {
          nomeArquivo: `Documento Descritivo de Crédito - Contrato ${contrato.numero}.pdf`,
          tipo: "contrato",
          caminhoArquivo: path.join("storage", "documentos", nomeArmazenado),
        },
      });

      const passivo = await tx.passivo.create({
        data: {
          nome: `Consignado Itaú ${contrato.numero}`,
          tipo: "consignado",
          estrutura: "AMORTIZA_NORMAL",
          valorQuitacaoCentavos: contrato.saldoQuitacaoCentavos,
          custoMensalCentavos: contrato.custoMensalCentavos,
          custoMensalVariavel: false,
          taxaJurosPct: contrato.taxaJurosPct,
          parcelaAtual: contrato.parcelaAtual,
          totalParcelas: contrato.totalParcelas,
          observacao: `Contrato ${contrato.numero}, sistema Price, débito em conta. Saldo devedor conforme documento Itaú de 12/09/2026. Parte do lastro em garantia do CDB "${ativoCdb.nome}" — substituiu o registro combinado "${passivoAntigo.nome}" em 14/09/2026.`,
          documentoFonteId: documento.id,
        },
      });

      await tx.ativoPassivoVinculo.create({
        data: {
          ativoId: ATIVO_CDB_ID,
          passivoId: passivo.id,
          tipoVinculo: "GARANTIA",
          valorGarantidoCentavos: contrato.saldoQuitacaoCentavos,
          observacao: `Garantia do contrato ${contrato.numero}.`,
        },
      });

      console.log(`Criado: ${passivo.nome} (${passivo.id}), documento ${documento.id}`);
    }

    // As 4 transações "INT RESGATE PRIVILEGE" são movimentação do próprio
    // CDB (juros/resgate), não desembolso de empréstimo — hoje presas ao
    // passivo combinado por engano. Reaponta pro ativo.
    const transacoesRealocadas = await tx.transacao.updateMany({
      where: { passivoId: PASSIVO_ANTIGO_ID },
      data: { passivoId: null, ativoId: ATIVO_CDB_ID },
    });
    console.log(`Transações realocadas do passivo pro ativo CDB: ${transacoesRealocadas.count}`);

    // Remove o vínculo antigo (GARANTIA do combinado com o CDB) e marca o
    // passivo combinado como quitado — substituído pelos 6 novos, mantendo
    // rastro histórico em vez de apagar.
    await tx.ativoPassivoVinculo.deleteMany({ where: { passivoId: PASSIVO_ANTIGO_ID } });
    await tx.passivo.update({
      where: { id: PASSIVO_ANTIGO_ID },
      data: {
        status: "QUITADO",
        observacao: `Substituído em 14/09/2026 por 6 passivos individuais (um por contrato real do Itaú, ver "Consignado Itaú <número>") — ver contratos anexados a cada um. Saldo e parcela combinados aqui deixam de ser atualizados.`,
      },
    });
  });

  console.log("Migração concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
