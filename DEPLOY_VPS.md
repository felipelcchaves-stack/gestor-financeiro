# Prompt-modelo: deploy de um projeto novo na VPS HostGator

Use este documento como ponto de partida na próxima vez que for pedir
pra hospedar um projeto novo nesta VPS (a mesma que já roda o Ìrántí e
o Gestor Financeiro). Copie o bloco "Prompt pronto pra colar" no final,
preencha os `{...}`, e mande no início de uma sessão nova.

## Por que este documento existe

Depois de migrar o Gestor Financeiro pra essa VPS, sobraram lições que
teriam economizado tempo real se já estivessem no pedido desde o
início. Documentado aqui pra não se repetir.

## Antes de começar (pré-voo — confirme isso ANTES de abrir a sessão)

- [ ] **Qual usuário SSH tem privilégio sudo?** Não é sempre óbvio —
  pode ser `root`, seu usuário pessoal, ou um usuário dedicado que você
  já criou. Descubra e escreva no prompt; evita 2-3 tentativas às
  cegas.
- [ ] **A chave SSH da máquina de onde você vai rodar a sessão já está
  autorizada nessa VPS** (`~/.ssh/authorized_keys` do usuário acima)?
  Se não, tenha a senha em mãos — o primeiro passo vai ser você mesmo
  logar por senha no seu terminal e colar a chave pública manualmente
  (a Claude não deve nem pode saber sua senha).
- [ ] **`sudo` nessa VPS é passwordless ou pede senha?** Se pede senha
  (mais comum e mais seguro), todo comando privilegiado (Nginx,
  Certbot, criar usuário, `apt`) vai precisar que você mesmo rode no
  seu terminal — planeje pra isso, não é um bug do processo.
- [ ] **Já existe um repositório Git com commit pro projeto?** Se não,
  isso entra como primeiro passo (criar repo privado, primeiro commit,
  push).
- [ ] **O projeto guarda dado real localmente** (banco SQLite, uploads,
  arquivos de configuração) que precisa ir junto pra VPS, ou a versão
  de produção começa vazia? Decida antes — muda a ordem dos passos.
- [ ] **O projeto tem alguma autenticação/controle de acesso?** Se não,
  decida agora como proteger (Basic Auth no Nginx é o mais rápido) —
  não deixe pra descobrir isso só quando já estiver quase no ar.

## Fatos fixos da VPS (não mudam entre projetos)

- Provedor: HostGator. IP: 143.95.164.62
- SSH roda na porta **22022**, não na 22 padrão — todo comando `ssh`/
  `scp`, e qualquer GitHub Action de SSH, precisa da porta explícita.
- Nginx e Certbot já instalados globalmente — só adicionar um site novo
  em `/etc/nginx/sites-available/`, nunca reinstalar.
- Firewall (ufw) já libera 22, 80, 443 e 22022.
- Domínio base: `ifatokun.com.br`. Pra descobrir o padrão de subdomínio
  usado por projetos já hospedados, **leia o Nginx antes de perguntar**:
  `cat /etc/nginx/sites-enabled/*` revela `server_name` de tudo que já
  está no ar (foi assim que achamos `ifatokun.com.br` sem precisar
  perguntar duas vezes).
- Usuários dedicados já existentes: `iranti` (porta interna 3000),
  `gestor` (porta interna 3001) — cada usuário roda seu próprio daemon
  PM2 isolado (`~/.pm2`). Projeto novo: usar porta interna livre
  seguinte (3002, 3003...) e decidir se cria usuário novo ou reaproveita
  um existente.

## Pegadinhas reais (já nos custaram tempo de debug)

1. **Certbot trava se o bloco HTTPS do Nginx já existir antes do
   certificado.** Ordem certa: (a) sobe só bloco HTTP simples, testa,
   recarrega; (b) roda `certbot --nginx -d SUBDOMINIO`; (c) Certbot
   reescreve o arquivo sozinho com HTTPS básico, preservando as
   diretivas customizadas que já existiam (proxy_pass, headers,
   client_max_body_size) — não precisa reescrever tudo de novo depois,
   só adicionar o que faltar (ex: Basic Auth).
2. **Next.js atrás de proxy reverso**: `request.url` numa Route Handler
   sempre volta "localhost:PORTA", nunca o domínio real — ler
   `X-Forwarded-Host`/`Host` do header da requisição, não de
   `request.url`. Nginx precisa mandar `proxy_set_header Host $host;` e
   `proxy_set_header X-Forwarded-Proto $scheme;` (e idealmente também
   `X-Forwarded-Host`).
3. **GitHub Actions com SSH (`appleboy/ssh-action` ou similar) precisa
   de `port` explícito** (`${{ secrets.VPS_PORT }}`, nunca hardcoded) —
   o padrão de qualquer action é porta 22 e falha calado com "connection
   refused" sem isso.
4. **`sudo` pedindo senha quebra comandos multi-linha colados no
   terminal** — se você colar um bloco de várias linhas com `sudo ...
   <<EOF ... EOF` no meio, o prompt de senha aparece no meio do paste e
   embaralha o resto. **Solução que funcionou**: gerar o conteúdo como
   base64 e passar como comando de **uma linha só**
   (`echo "BASE64..." | base64 -d | sudo tee ARQUIVO`) — sem risco de
   quebra, não importa o tamanho do conteúdo.
5. **Prisma + SQLite: caminho `file:` no `DATABASE_URL` é relativo à
   pasta do `schema.prisma`, não ao diretório de onde você roda o
   comando.** Se o schema fica em `prisma/schema.prisma` e você quer o
   banco em `prisma/dev.db`, o valor certo é `DATABASE_URL="file:./dev.db"`
   — **não** `file:./prisma/dev.db` (isso cria um banco novo e vazio em
   `prisma/prisma/dev.db`, silenciosamente, sem apagar o real, mas
   também sem usar ele). Sinal de alerta: `prisma migrate deploy`
   dizendo "SQLite database ... created" quando você esperava que ele
   já existisse — pare e confira o caminho antes de continuar.
6. **Sempre confira integridade de dado real transferido** (banco,
   uploads) com checksum antes e depois: `md5sum arquivo` local e
   remoto, comparar. Rápido, e pega qualquer coisa que dê errado na
   transferência ou no path.
7. **Peça dado aberto (domínio exato, nome de usuário) em texto
   simples, não em pergunta de múltipla escolha "com Other"** — na
   prática o texto livre digitado via "Other" nem sempre chega, e
   arrisca 2-3 rodadas perdidas até perceber. Pergunta de múltipla
   escolha é só pra decisão entre opções de verdade (ex: "Basic Auth ou
   restringir por IP?").
8. Se o Nginx acusar `sudo: unable to resolve host` — é só cosmético
   (falta hostname no `/etc/hosts`), não impede nada.

## Estilo de trabalho que funcionou bem

- Investigar o projeto (schema do banco, variáveis de ambiente, se tem
  autenticação, se há dado real local que precisa migrar) **antes** de
  propor o roteiro — não assumir que é "só um deploy padrão".
- Rodar tudo que não precisa de sudo direto via SSH (clone, `npm ci`,
  build, PM2, testes com `curl`), mostrando a saída real de cada
  comando.
- Pra tudo que precisa de sudo: dar o comando exato (de preferência
  uma linha só, ver pegadinha 4), pedir pra rodar no terminal deles, e
  **verificar o resultado por fora** (via SSH sem sudo, ou via `curl`
  externo) em vez de confiar cegamente na palavra "feito".
- Terminar com um teste de ponta a ponta de verdade: um commit real
  disparando o deploy automático, conferindo que o app reiniciou e que
  nenhum dado real foi alterado no processo (checksum de novo).

---

## Prompt pronto pra colar (preencha os `{...}`)

```
Preciso colocar este projeto ({NOME DO PROJETO}) na mesma VPS onde já
hospedo o Ìrántí e o Gestor Financeiro, num subdomínio novo. Leia
DEPLOY_VPS.md neste repositório — tem os fatos fixos da VPS, as
pegadinhas já descobertas, e o estilo de trabalho que funciona bem.

Antes de começar, já confirmei:
- Usuário SSH com sudo: {USUARIO}
- Minha chave local {já está / NÃO está} autorizada nesse usuário
- sudo nessa VPS {é passwordless / pede senha}
- Repositório Git: {já existe em <url> / preciso que você me ajude a criar}
- Dado real local pra migrar: {sim, é <descrição> / não, começa vazio}
- Autenticação do app: {já tem login / não tem nada, preciso de proteção}

Nome de subdomínio que prefiro: {SUBDOMINIO} (confirme o domínio base
lendo os sites já configurados no Nginx, não pergunte de novo).

Me passe o roteiro completo de deploy seguindo o padrão do
DEPLOY_VPS.md — usuário → clonar → variáveis de ambiente → build → PM2
(porta interna livre, sem colidir com 3000/3001 já ocupados) → Nginx
(ordem certa do Certbot) → GitHub Actions com VPS_PORT como secret.
Um passo de cada vez, sempre com a saída real do comando antes de
seguir pro próximo.
```
