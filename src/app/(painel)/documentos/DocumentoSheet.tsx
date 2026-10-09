"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { excluirDocumento } from "./actions";

type DocumentoDetalhe = {
  id: string;
  nomeArquivo: string;
  tipo: string;
  tipoLabel: string;
  extensao: string;
  createdAt: string;
  vinculos: string[];
};

const EXTENSOES_IMAGEM = [".png", ".jpg", ".jpeg", ".webp"];

export function DocumentoSheet({ documento }: { documento: DocumentoDetalhe }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const url = `/api/documentos/${documento.id}`;
  const isImagem = EXTENSOES_IMAGEM.includes(documento.extensao.toLowerCase());

  async function handleExcluir() {
    const aviso =
      documento.vinculos.length > 0
        ? `Excluir "${documento.nomeArquivo}"? Isso vai apagar também: ${documento.vinculos.join(
            ", "
          )}. Essa ação não pode ser desfeita.`
        : `Excluir "${documento.nomeArquivo}"? Essa ação não pode ser desfeita.`;
    if (!window.confirm(aviso)) return;

    setErro(null);
    setExcluindo(true);
    try {
      await excluirDocumento(documento.id);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao excluir o documento.");
      setExcluindo(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Eye className="size-3.5" /> ver
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{documento.nomeArquivo}</SheetTitle>
          <SheetDescription>
            {documento.tipoLabel} · importado em{" "}
            {new Date(documento.createdAt).toLocaleDateString("pt-BR")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {erro && <p className="text-sm text-debt">{erro}</p>}

          {isImagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={documento.nomeArquivo} className="w-full rounded-lg border border-border" />
          ) : (
            <iframe src={url} className="h-[60vh] w-full rounded-lg border border-border" title={documento.nomeArquivo} />
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vínculos</p>
            {documento.vinculos.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1 text-sm text-foreground">
                {documento.vinculos.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nenhum vínculo registrado.</p>
            )}
          </div>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gold underline underline-offset-4"
          >
            abrir em nova aba
          </a>

          <Button variant="destructive" size="sm" className="w-fit" onClick={handleExcluir} disabled={excluindo}>
            {excluindo ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
