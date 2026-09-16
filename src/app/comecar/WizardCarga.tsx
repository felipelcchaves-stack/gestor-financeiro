"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Landmark, TrendingDown, PiggyBank, Target, Wallet, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContaForm } from "@/app/contas/ContaForm";
import { criarContaSemRedirecionar } from "@/app/contas/actions";
import { PassivoForm } from "@/app/passivos/PassivoForm";
import { criarPassivoSemRedirecionar } from "@/app/passivos/actions";
import { AtivoForm } from "@/app/ativos/AtivoForm";
import { criarAtivoSemRedirecionar } from "@/app/ativos/actions";
import { MetaForm } from "@/app/metas/MetaForm";
import { criarMetaSemRedirecionar } from "@/app/metas/actions";
import { definirAporteMensal } from "@/app/(mapa)/actions";
import { formatarBRL, parseNumeroBR } from "@/lib/money";

type Etapa = "boasVindas" | "conta" | "passivo" | "ativo" | "meta" | "aporte" | "resumo";

const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "boasVindas", label: "Início" },
  { id: "conta", label: "Conta" },
  { id: "passivo", label: "Dívidas" },
  { id: "ativo", label: "Bens" },
  { id: "meta", label: "Meta" },
  { id: "aporte", label: "Aporte" },
  { id: "resumo", label: "Pronto" },
];

type ItemCriado = { id: string; nome: string };

export function WizardCarga({ passivosIniciais }: { passivosIniciais: ItemCriado[] }) {
  const [etapa, setEtapa] = useState<Etapa>("boasVindas");
  const [contas, setContas] = useState<ItemCriado[]>([]);
  const [passivos, setPassivos] = useState<ItemCriado[]>([]);
  const [ativos, setAtivos] = useState<ItemCriado[]>([]);
  const [meta, setMeta] = useState<ItemCriado | null>(null);
  const [aporteReais, setAporteReais] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const indiceAtual = ETAPAS.findIndex((e) => e.id === etapa);

  async function handleCriarConta(formData: FormData) {
    setErro(null);
    try {
      const conta = await criarContaSemRedirecionar(formData);
      setContas((prev) => [...prev, { id: conta.id, nome: conta.nome }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar a conta.");
    }
  }

  async function handleCriarPassivo(formData: FormData) {
    setErro(null);
    try {
      const passivo = await criarPassivoSemRedirecionar(formData);
      setPassivos((prev) => [...prev, { id: passivo.id, nome: passivo.nome }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cadastrar a dívida.");
    }
  }

  async function handleCriarAtivo(formData: FormData) {
    setErro(null);
    try {
      const ativo = await criarAtivoSemRedirecionar(formData);
      setAtivos((prev) => [...prev, { id: ativo.id, nome: ativo.nome }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cadastrar o ativo.");
    }
  }

  async function handleCriarMeta(formData: FormData) {
    setErro(null);
    try {
      const novaMeta = await criarMetaSemRedirecionar(formData);
      setMeta({ id: novaMeta.id, nome: novaMeta.nome });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar a meta.");
    }
  }

  async function handleDefinirAporte(formData: FormData) {
    setErro(null);
    try {
      await definirAporteMensal(formData);
      setAporteReais(String(formData.get("aporte")));
      setEtapa("resumo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o aporte.");
    }
  }

  const passivosParaMeta = [...passivosIniciais, ...passivos.filter((p) => !passivosIniciais.some((pi) => pi.id === p.id))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1">
        {ETAPAS.map((e, i) => (
          <div key={e.id} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full ${i <= indiceAtual ? "bg-primary" : "bg-muted"}`}
            />
            <span className={`text-[10px] ${i === indiceAtual ? "font-semibold text-foreground" : "text-muted-foreground/70"}`}>
              {e.label}
            </span>
          </div>
        ))}
      </div>

      {erro && <p className="text-sm text-debt">{erro}</p>}

      {etapa === "boasVindas" && (
        <div className="flex flex-col items-center gap-4 glass-card rounded-2xl p-8 text-center">
          <Compass className="size-10 text-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Vamos montar seu Mapa de Saída</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Em poucos passos você cadastra suas contas, dívidas, bens e uma meta — o suficiente
            pra sistema calcular sua rota de saída. Pode pular qualquer etapa e voltar depois pelo
            menu, em &ldquo;Assistente de configuração&rdquo;.
          </p>
          <Button onClick={() => setEtapa("conta")}>Começar</Button>
        </div>
      )}

      {etapa === "conta" && (
        <EtapaWizard
          icon={<Landmark className="size-5" />}
          titulo="Suas contas"
          descricao="Onde seu dinheiro entra e sai — conta corrente, PJ, cheque especial."
          itensCriados={contas}
          onProximo={() => setEtapa("passivo")}
          onPular={() => setEtapa("passivo")}
          obrigatorio={false}
        >
          <ContaForm action={handleCriarConta} key={contas.length} />
        </EtapaWizard>
      )}

      {etapa === "passivo" && (
        <EtapaWizard
          icon={<TrendingDown className="size-5" />}
          titulo="Suas dívidas"
          descricao="Cartão, empréstimo, financiamento, até dívida informal — é daqui que sai a rota de saída."
          itensCriados={passivos}
          onProximo={() => setEtapa("ativo")}
          onPular={() => setEtapa("ativo")}
          obrigatorio={false}
        >
          <PassivoForm action={handleCriarPassivo} key={passivos.length} />
        </EtapaWizard>
      )}

      {etapa === "ativo" && (
        <EtapaWizard
          icon={<PiggyBank className="size-5" />}
          titulo="Seus bens"
          descricao="CDB, investimento, reserva — opcional, ajuda a calcular seu patrimônio real."
          itensCriados={ativos}
          onProximo={() => setEtapa("meta")}
          onPular={() => setEtapa("meta")}
          obrigatorio={false}
        >
          <AtivoForm action={handleCriarAtivo} key={ativos.length} />
        </EtapaWizard>
      )}

      {etapa === "meta" && (
        <EtapaWizard
          icon={<Target className="size-5" />}
          titulo="Sua primeira meta"
          descricao="Um objetivo tipo 'zerar tal dívida até tal data'. Pode criar mais depois."
          itensCriados={meta ? [meta] : []}
          onProximo={() => setEtapa("aporte")}
          onPular={() => setEtapa("aporte")}
          obrigatorio={false}
          esconderFormularioAposCriar
        >
          <MetaForm action={handleCriarMeta} passivosDisponiveis={passivosParaMeta} key={meta?.id ?? "nova"} />
        </EtapaWizard>
      )}

      {etapa === "aporte" && (
        <div className="flex flex-col gap-4 glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-foreground" />
            <h2 className="text-base font-medium text-foreground">Quanto você consegue direcionar por mês?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Além dos pagamentos mínimos que já saem — esse número destrava a trilha completa e as
            datas estimadas de quitação no seu Mapa.
          </p>
          <form action={handleDefinirAporte} className="flex items-center gap-2">
            <input
              name="aporte"
              type="text"
              inputMode="decimal"
              placeholder="ex: 10000"
              required
              className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
            />
            <Button type="submit">Salvar e continuar</Button>
            <button type="button" onClick={() => setEtapa("resumo")} className="text-sm text-muted-foreground underline">
              pular por agora
            </button>
          </form>
        </div>
      )}

      {etapa === "resumo" && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-liquidity/25 bg-liquidity/[0.06] p-8 text-center">
          <PartyPopper className="size-10 text-liquidity" />
          <h1 className="text-xl font-semibold text-liquidity">Pronto pra ver seu Mapa</h1>
          <ul className="text-sm text-liquidity">
            <li>{contas.length} conta(s) cadastrada(s)</li>
            <li>{passivos.length} dívida(s) cadastrada(s)</li>
            <li>{ativos.length} bem(ns) cadastrado(s)</li>
            <li>{meta ? `Meta: ${meta.nome}` : "nenhuma meta ainda"}</li>
            <li>
              {aporteReais && parseNumeroBR(aporteReais) != null
                ? `Aporte mensal: ${formatarBRL(Math.round(parseNumeroBR(aporteReais)! * 100))}`
                : "aporte não definido"}
            </li>
          </ul>
          <Button nativeButton={false} render={<Link href="/" />}>Ver meu Mapa</Button>
        </div>
      )}
    </div>
  );
}

function EtapaWizard({
  icon,
  titulo,
  descricao,
  itensCriados,
  onProximo,
  onPular,
  obrigatorio,
  esconderFormularioAposCriar,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  itensCriados: ItemCriado[];
  onProximo: () => void;
  onPular: () => void;
  obrigatorio: boolean;
  esconderFormularioAposCriar?: boolean;
  children: React.ReactNode;
}) {
  const mostrarFormulario = !esconderFormularioAposCriar || itensCriados.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-medium text-foreground">{titulo}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>

      {itensCriados.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-liquidity">
          {itensCriados.map((item) => (
            <li key={item.id}>✓ {item.nome}</li>
          ))}
        </ul>
      )}

      {mostrarFormulario && children}

      <div className="flex items-center gap-3">
        <Button onClick={onProximo}>
          {itensCriados.length > 0 ? "Continuar" : "Continuar sem adicionar"}
        </Button>
        {!obrigatorio && itensCriados.length === 0 && (
          <button type="button" onClick={onPular} className="text-sm text-muted-foreground underline">
            pular esta etapa
          </button>
        )}
      </div>
    </div>
  );
}
