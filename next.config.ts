import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs-dist precisa inicializar um worker em runtime; sem isso
  // o Next.js empacota a lib no bundle de servidor e quebra a resolução do
  // arquivo pdf.worker.mjs ("Setting up fake worker failed").
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // Padrão do Next é 1MB no corpo de uma Server Action — pensado pra
  // formulário comum, não pra upload de PDF. Extrato de vários meses (mais
  // páginas/lançamentos) passa disso fácil; 20mb dá folga confortável pra
  // extrato/fatura/imagem sem risco real pro servidor local.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
