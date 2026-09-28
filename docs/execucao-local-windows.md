# Execução local automática no Windows

Guia pra deixar o LocObra (Postgres + API + Frontend) subindo sozinho
junto com o Windows, num notebook do cliente — sem ele precisar rodar
nenhum comando, nunca.

Scripts relevantes: `scripts/start-windows.ps1` e `scripts/stop-windows.ps1`
(neste repositório, backend).

> ⚠️ Estes scripts foram escritos e revisados com cuidado, mas **não há
> como testá-los num Windows real a partir deste ambiente de
> desenvolvimento** (que é Linux). Faça um primeiro teste supervisionado
> antes de confiar neles pra atender o cliente — veja "Troubleshooting"
> abaixo caso algo não bata.

---

## 1. Pré-requisitos (uma vez, manualmente)

No notebook do cliente:

- **Node.js LTS** (20+) — [nodejs.org](https://nodejs.org)
- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop)
- **Git** (ou copiar as pastas dos projetos de outra forma)

Esses três precisam ficar disponíveis no PATH do Windows (a instalação
padrão de cada um já faz isso).

## 2. Layout de pastas esperado

`start-windows.ps1` assume que backend e frontend são **pastas irmãs**:

```
C:\LocObra\
  backend_alb\     <- este repositório
  frontend_alb\    <- o repositório do frontend
```

Se os nomes ou o layout forem diferentes, ajuste `$FrontendPath` no topo
de `scripts\start-windows.ps1`.

```powershell
git clone https://github.com/renatoclx/backend_alb.git C:\LocObra\backend_alb
git clone https://github.com/renatoclx/frontend_alb.git C:\LocObra\frontend_alb
```

## 3. Primeira execução (supervisionada)

Abra o PowerShell na pasta do backend e rode manualmente uma vez, pra
acompanhar a saída (a primeira vez instala dependências e compila os dois
projetos — demora mais que as seguintes):

```powershell
cd C:\LocObra\backend_alb
powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1
```

Se tudo der certo, o navegador abre sozinho em `http://localhost:3000` e
dá pra logar com o usuário padrão do sistema (criado pelo seed do
backend — ver `README.md` > "Primeiro acesso").

O script é **idempotente**: rodar de novo não duplica nada nem quebra o
que já está no ar.

## 4. Deixando o Windows subir isso sozinho

O script sobe tudo, mas ainda precisa ser **disparado** em algum momento.
Duas formas (escolha uma):

### Opção A — Atalho na pasta "Inicializar" (mais simples)

1. Clique com o botão direito na Área de Trabalho → **Novo → Atalho**.
2. Em "Local do item", cole exatamente:
   ```
   powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\LocObra\backend_alb\scripts\start-windows.ps1"
   ```
   (ajuste o caminho se o clone estiver em outro lugar)
3. Dê um nome ao atalho (ex.: "LocObra") e finalize.
4. Aperte `Win + R`, digite `shell:startup` e Enter — isso abre a pasta
   de inicialização do usuário.
5. Mova (ou copie) o atalho criado pra dentro dessa pasta.

A partir daí, todo login no Windows já sobe o Postgres, a API e o
frontend sozinhos, sem janela nenhuma aparecendo (`-WindowStyle Hidden`),
e abre o navegador no fim.

### Opção B — Agendador de Tarefas (mais robusto)

Mais indicado se o notebook reinicia sozinho ou se o cliente não faz
login imediatamente: cria uma tarefa que roda "ao iniciar o sistema" em
vez de "ao logar".

1. Abra o **Agendador de Tarefas** (Task Scheduler).
2. **Criar Tarefa** (não "Tarefa Básica", pra ter mais opções).
3. Geral: marque "Executar estando o usuário conectado ou não" (se
   disponível) e "Executar com os privilégios mais altos".
4. Gatilhos: **Novo** → "Ao iniciar o sistema" (ou "Ao fazer logon").
5. Ações: **Novo** → Programa/script: `powershell.exe` — Argumentos:
   ```
   -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\LocObra\backend_alb\scripts\start-windows.ps1"
   ```
6. Salve.

## 5. Parar / reiniciar

```powershell
cd C:\LocObra\backend_alb
powershell -ExecutionPolicy Bypass -File scripts\stop-windows.ps1
# ou, também derrubando o Postgres:
powershell -ExecutionPolicy Bypass -File scripts\stop-windows.ps1 -StopDatabase
```

Pra reiniciar, rode `start-windows.ps1` de novo (manualmente ou reiniciando o Windows).

## 6. Logs

Cada execução grava logs com timestamp em `backend_alb\logs\` — inclui a
saída do Docker, das migrations/seeds, e a saída (stdout/stderr) da API e
do frontend. É o primeiro lugar a olhar se algo não subir.

## 7. Atualizando o sistema depois de uma mudança de código

O script só instala/compila automaticamente **se `node_modules`/`dist`/`.next`
ainda não existirem** — depois da primeira vez, ele não recompila sozinho
a cada boot (é rápido de propósito). Pra aplicar uma atualização:

```powershell
cd C:\LocObra\backend_alb  ; git pull ; npm run setup
cd C:\LocObra\frontend_alb ; git pull ; npm run setup ; npm run build
powershell -ExecutionPolicy Bypass -File C:\LocObra\backend_alb\scripts\stop-windows.ps1
```

Na próxima subida (reinício do Windows, ou rodando `start-windows.ps1` de
novo), já sobe a versão nova.

## 8. Troubleshooting

- **PowerShell recusa rodar o script** ("não é possível carregar... está
  desabilitado neste sistema"): é a Execution Policy padrão do Windows.
  O `-ExecutionPolicy Bypass` no atalho já contorna isso; se mesmo assim
  der erro, confirme que o texto do atalho foi colado exatamente como no
  passo 4.
- **Nada abre no navegador**: confira `logs\start_*.log` (o script loga
  cada etapa) e os `*.err.log` de backend/frontend.
- **Docker Desktop demora ou não inicia**: em algumas instalações o
  caminho do executável é diferente do assumido no script
  (`Program Files\Docker\Docker\Docker Desktop.exe`); abra o Docker
  Desktop manualmente uma vez e rode o script de novo.
- **Porta já em uso**: rode `stop-windows.ps1` antes de tentar de novo —
  ele encerra o que estiver ouvindo nas portas 3000/3333.

## 9. Sobre resiliência (fora do escopo por ora)

Esse modelo (atalho/tarefa agendada) sobe os processos e não os
supervisiona depois — se a API ou o frontend crasharem no meio do dia,
só voltam no próximo boot/execução manual do script. Se isso virar um
problema real de uso, a evolução natural é registrar backend e frontend
como **Serviços do Windows** (ex.: via [NSSM](https://nssm.cc)), que
reinicia sozinho em caso de falha — não implementado aqui porque foge do
modelo "atalho simples" pedido inicialmente.
