#!/usr/bin/env bash
# Puxa uma cópia SOMENTE LEITURA do banco real (prisma/dev.db) da VPS pra
# análise local — nunca escreve em cima do prisma/dev.db local de teste.
#
# Por quê: local e VPS são dois arquivos SQLite físicos independentes,
# nunca sincronizados automaticamente (só houve uma cópia manual única no
# dia da migração original — ver DEPLOY_VPS.md). A VPS é a fonte única de
# dados reais; este script existe pra quando for preciso analisar esse
# dado real localmente, sem arriscar sobrescrever nada na VPS nem o banco
# de teste local.
#
# Uso: ./scripts/pull-vps-db.sh
# Confirme/ajuste as variáveis abaixo antes da primeira vez que rodar.

set -euo pipefail

VPS_HOST="143.95.164.62"
VPS_PORT="22022"
VPS_USER="gestor"
# Caminho do projeto na VPS — confirme o valor real (é o mesmo usado no
# secret VPS_PROJECT_PATH do GitHub Actions, .github/workflows/deploy.yml).
VPS_PROJECT_PATH="/home/gestor/gestor-financeiro"

DATA=$(date +%Y%m%d-%H%M%S)
DESTINO="prisma/dev.db.vps-snapshot-${DATA}"

echo "Puxando prisma/dev.db da VPS (${VPS_USER}@${VPS_HOST}:${VPS_PORT}) para ${DESTINO}..."
scp -P "${VPS_PORT}" "${VPS_USER}@${VPS_HOST}:${VPS_PROJECT_PATH}/prisma/dev.db" "${DESTINO}"

MD5_REMOTO=$(ssh -p "${VPS_PORT}" "${VPS_USER}@${VPS_HOST}" "md5sum ${VPS_PROJECT_PATH}/prisma/dev.db" | awk '{print $1}')
MD5_LOCAL=$(md5 -q "${DESTINO}" 2>/dev/null || md5sum "${DESTINO}" | awk '{print $1}')

if [ "${MD5_REMOTO}" != "${MD5_LOCAL}" ]; then
  echo "ERRO: checksum não bateu (remoto ${MD5_REMOTO} vs local ${MD5_LOCAL}). Apagando cópia corrompida."
  rm -f "${DESTINO}"
  exit 1
fi

echo "OK — checksum confere (${MD5_LOCAL})."
echo ""
echo "Snapshot salvo em: ${DESTINO} (já no .gitignore, nunca versionado)"
echo "Pra analisar com esse dado, aponte temporariamente:"
echo "  DATABASE_URL=\"file:./${DESTINO#prisma/}\""
echo "e depois volte pro .env original (banco de teste local) quando terminar."
