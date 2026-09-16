"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EstruturaPassivo, StatusPassivo, Confiabilidade } from "@/generated/prisma";
import { centavosDoForm, textoDoForm, intDoForm, floatDoForm } from "@/lib/form-helpers";
import { proximaParcela, calcularEstimativaCronograma } from "@/lib/cronogramaAmortizacao";

const STORAGE_DIR = path.join(process.cwd(), "storage", "documentos");

async function salvarDocumentoAnexado(formData: FormData): Promise<string | null> {
  const arquivo = formData.get("documentoFonte");
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  await mkdir(STORAGE_DIR, { recursive: true });
  const extensao = path.extname(arquivo.name) || ".pdf";
  const nomeArmazenado = `${randomUUID()}${extensao}`;
  await writeFile(path.join(STORAGE_DIR, nomeArmazenado), buffer);

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo: "contrato",
      caminhoArquivo: path.join("storage", "documentos", nomeArmazenado),
    },
  });

  return documento.id;
}

function camposComuns(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const tipo = textoDoForm(formData, "tipo");
  const estrutura = formData.get("estrutura") as EstruturaPassivo;

  if (!nome || !tipo || !estrutura) {
    throw new Error("Preencha nome, tipo e estrutura.");
  }

  return {
    nome,
    tipo,
    estrutura,
    valorQuitacaoCentavos: centavosDoForm(formData, "valorQuitacao"),
    custoMensalCentavos: centavosDoForm(formData, "custoMensal"),
    custoMensalVariavel: formData.get("custoMensalVariavel") === "on",
    substituido: formData.get("substituido") === "on",
    taxaJurosPct: floatDoForm(formData, "taxaJurosPct"),
    parcelaAtual: intDoForm(formData, "parcelaAtual"),
    totalParcelas: intDoForm(formData, "totalParcelas"),
    observacao: textoDoForm(formData, "observacao"),
  };
}

export async function criarPassivo(formData: FormData) {
  const dados = camposComuns(formData);
  const documentoFonteId = await salvarDocumentoAnexado(formData);
  await prisma.passivo.create({ data: { ...dados, documentoFonteId } });
  revalidatePath("/passivos");
  redirect("/passivos");
}

// Mesma criação, sem redirect — usado pelo wizard de primeira carga
// (`/comecar`), que precisa ficar na mesma página entre os passos.
export async function criarPassivoSemRedirecionar(formData: FormData) {
  const dados = camposComuns(formData);
  const documentoFonteId = await salvarDocumentoAnexado(formData);
  const passivo = await prisma.passivo.create({ data: { ...dados, documentoFonteId } });
  revalidatePath("/passivos");
  return passivo;
}

export async function atualizarPassivo(id: string, formData: FormData) {
  const dados = camposComuns(formData);
  const motivo = textoDoForm(formData, "motivo");
  const novoDocumentoFonteId = await salvarDocumentoAnexado(formData);
  const atual = await prisma.passivo.findUniqueOrThrow({ where: { id } });

  const historicos: {
    passivoId: string;
    campo: string;
    valorAnterior: string | null;
    valorNovo: string;
    motivo: string | null;
  }[] = [];

  if (atual.valorQuitacaoCentavos !== dados.valorQuitacaoCentavos) {
    historicos.push({
      passivoId: id,
      campo: "valorQuitacaoCentavos",
      valorAnterior: atual.valorQuitacaoCentavos?.toString() ?? null,
      valorNovo: dados.valorQuitacaoCentavos?.toString() ?? "não documentado",
      motivo,
    });
  }
  if (atual.custoMensalCentavos !== dados.custoMensalCentavos) {
    historicos.push({
      passivoId: id,
      campo: "custoMensalCentavos",
      valorAnterior: atual.custoMensalCentavos?.toString() ?? null,
      valorNovo: dados.custoMensalCentavos?.toString() ?? "não documentado",
      motivo,
    });
  }
  if (atual.parcelaAtual !== dados.parcelaAtual) {
    historicos.push({
      passivoId: id,
      campo: "parcelaAtual",
      valorAnterior: atual.parcelaAtual?.toString() ?? null,
      valorNovo: dados.parcelaAtual?.toString() ?? "não documentado",
      motivo,
    });
  }
  if (atual.totalParcelas !== dados.totalParcelas) {
    historicos.push({
      passivoId: id,
      campo: "totalParcelas",
      valorAnterior: atual.totalParcelas?.toString() ?? null,
      valorNovo: dados.totalParcelas?.toString() ?? "não documentado",
      motivo,
    });
  }
  if (atual.substituido !== dados.substituido) {
    historicos.push({
      passivoId: id,
      campo: "substituido",
      valorAnterior: String(atual.substituido),
      valorNovo: String(dados.substituido),
      motivo,
    });
  }

  await prisma.$transaction([
    prisma.passivo.update({
      where: { id },
      data: { ...dados, ...(novoDocumentoFonteId ? { documentoFonteId: novoDocumentoFonteId } : {}) },
    }),
    ...(historicos.length > 0 ? [prisma.passivoHistorico.createMany({ data: historicos })] : []),
  ]);

  revalidatePath("/passivos");
  revalidatePath(`/passivos/${id}`);
  redirect(`/passivos/${id}`);
}

export async function marcarPassivoQuitado(id: string) {
  await prisma.passivo.update({ where: { id }, data: { status: StatusPassivo.QUITADO } });
  revalidatePath("/passivos");
  revalidatePath(`/passivos/${id}`);
}

export async function reabrirPassivo(id: string) {
  await prisma.passivo.update({ where: { id }, data: { status: StatusPassivo.ATIVO } });
  revalidatePath("/passivos");
  revalidatePath(`/passivos/${id}`);
}

// Quitar ou amortizar sempre exigindo uma transação real já importada —
// nunca cria uma transação do zero. Se o valor pago cobre o saldo
// inteiro, é quitação total; senão, e havendo cronograma real do
// contrato (ver PassivoParcelaCronograma), abate exatamente o Principal
// da próxima parcela documentada — nunca o valor pago inteiro (que
// incluiria juro). Sem cronograma, mantém o comportamento simples de
// sempre (abate o valor pago inteiro), sem regressão.
export async function confirmarPagamentoPassivo(passivoId: string, formData: FormData) {
  const transacaoId = textoDoForm(formData, "transacaoId");
  if (!transacaoId) throw new Error("Selecione uma transação vinculada ao pagamento.");

  const [passivo, transacao, cronograma] = await Promise.all([
    prisma.passivo.findUniqueOrThrow({ where: { id: passivoId } }),
    prisma.transacao.findUniqueOrThrow({ where: { id: transacaoId } }),
    prisma.passivoParcelaCronograma.findMany({ where: { passivoId }, orderBy: { numeroParcela: "asc" } }),
  ]);

  const saldoAtual = passivo.valorQuitacaoCentavos ?? 0;
  const quitacaoTotal = saldoAtual > 0 && transacao.valorCentavos >= saldoAtual;

  let novoSaldo: number;
  let novaParcelaAtual = passivo.parcelaAtual;
  let detalhe: string;

  if (quitacaoTotal) {
    novoSaldo = 0;
    if (passivo.totalParcelas != null) novaParcelaAtual = passivo.totalParcelas;
    detalhe = "quitação total";
  } else if (cronograma.length > 0) {
    const parcela = proximaParcela(cronograma, passivo.parcelaAtual ?? 0);
    if (!parcela) throw new Error("Não há mais parcelas no cronograma documentado pra confirmar.");
    novoSaldo = Math.max(0, saldoAtual - parcela.principalCentavos);
    novaParcelaAtual = parcela.numeroParcela;
    detalhe = `amortização da parcela ${parcela.numeroParcela}/${passivo.totalParcelas ?? cronograma.length} do contrato — dessa parcela, ${formatarBRLCentavos(parcela.principalCentavos)} abateram o principal e ${formatarBRLCentavos(parcela.jurosCentavos)} foram juro`;
  } else {
    novoSaldo = Math.max(0, saldoAtual - transacao.valorCentavos);
    if (novaParcelaAtual != null) novaParcelaAtual += 1;
    detalhe = "abatimento integral do valor pago (sem cronograma documentado pra separar juro do principal)";
  }

  await prisma.$transaction([
    prisma.transacao.update({ where: { id: transacaoId }, data: { passivoId, ativoId: null } }),
    prisma.passivo.update({
      where: { id: passivoId },
      data: {
        valorQuitacaoCentavos: novoSaldo,
        parcelaAtual: novaParcelaAtual,
        status: novoSaldo === 0 ? StatusPassivo.QUITADO : passivo.status,
      },
    }),
    prisma.passivoHistorico.create({
      data: {
        passivoId,
        campo: "valorQuitacaoCentavos",
        valorAnterior: saldoAtual.toString(),
        valorNovo: novoSaldo.toString(),
        motivo: `Pagamento real vinculado (${transacao.descricao}, ${transacao.data.toLocaleDateString("pt-BR")}) — ${detalhe}.`,
      },
    }),
  ]);

  revalidatePath("/passivos");
  revalidatePath(`/passivos/${passivoId}`);
}

// Só disponível quando há cronograma real do contrato. Nunca inventa
// número: abate exatamente o Principal documentado das parcelas já
// vencidas e ainda não confirmadas — marca a atualização como ESTIMADO
// (não confirmada por pagamento real nem por um contrato atualizado),
// distinguindo de uma confirmação de verdade no histórico.
export async function aceitarEstimativaCronograma(passivoId: string) {
  const [passivo, cronograma] = await Promise.all([
    prisma.passivo.findUniqueOrThrow({ where: { id: passivoId } }),
    prisma.passivoParcelaCronograma.findMany({ where: { passivoId }, orderBy: { numeroParcela: "asc" } }),
  ]);

  const saldoAtual = passivo.valorQuitacaoCentavos ?? 0;
  const estimativa = calcularEstimativaCronograma(cronograma, passivo.parcelaAtual ?? 0, saldoAtual, new Date());
  if (!estimativa) throw new Error("Não há parcela vencida pendente pra estimar.");

  const ultimaVencida = estimativa.parcelasPendentes[estimativa.parcelasPendentes.length - 1];
  const numerosParcelas = estimativa.parcelasPendentes.map((p) => p.numeroParcela).join(", ");

  await prisma.$transaction([
    prisma.passivo.update({
      where: { id: passivoId },
      data: { valorQuitacaoCentavos: estimativa.saldoEstimadoCentavos, parcelaAtual: estimativa.novaParcelaAtual },
    }),
    prisma.passivoHistorico.create({
      data: {
        passivoId,
        campo: "valorQuitacaoCentavos",
        valorAnterior: saldoAtual.toString(),
        valorNovo: estimativa.saldoEstimadoCentavos.toString(),
        motivo: `Estimativa aceita a partir do cronograma do contrato — parcela(s) ${numerosParcelas}, vencidas até ${ultimaVencida.vencimento.toLocaleDateString("pt-BR")}. Não confirmado por pagamento real nem por contrato atualizado.`,
        confiabilidade: Confiabilidade.ESTIMADO,
      },
    }),
  ]);

  revalidatePath("/passivos");
  revalidatePath(`/passivos/${passivoId}`);
}

function formatarBRLCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function registrarCicloFatura(passivoId: string, formData: FormData) {
  const referencia = textoDoForm(formData, "referencia");
  const valorCentavos = centavosDoForm(formData, "valor");
  const valorMinimoCentavos = centavosDoForm(formData, "valorMinimo");
  const vencimentoRaw = textoDoForm(formData, "vencimento");
  const documentoId = textoDoForm(formData, "documentoId");

  if (!referencia || valorCentavos == null) {
    throw new Error("Preencha a referência (ex: 2026-09) e o valor da fatura.");
  }

  await prisma.cicloFaturaPassivo.upsert({
    where: { passivoId_referencia: { passivoId, referencia } },
    create: {
      passivoId,
      referencia,
      valorCentavos,
      valorMinimoCentavos,
      vencimento: vencimentoRaw ? new Date(vencimentoRaw) : null,
      documentoId,
    },
    update: {
      valorCentavos,
      valorMinimoCentavos,
      vencimento: vencimentoRaw ? new Date(vencimentoRaw) : null,
      documentoId,
    },
  });

  revalidatePath(`/passivos/${passivoId}`);
}
