# Mangue Verde 3D — site estático + app desktop

Repositório com duas entregas a partir da **mesma fonte**:

| Entrega | Origem | Saída |
| --- | --- | --- |
| Site estático (Render) | `maquete_mangue_verde_takes.html` na raiz | HTML servido em produção, inalterado |
| App desktop offline | mesma HTML + `three` vendorizado | `.zip` por plataforma anexado à Release |

O HTML publicado **não é editado** pelo build desktop. `desktop/scripts/prepare.js`
apenas lê o arquivo da raiz e gera uma cópia descartável em `desktop/app/`
(gitignored) sem as URLs de CDN.

---

## Estrutura

```
maquete_mangue_verde_takes.html   # site publicado (fonte única da verdade)
render.yaml                       # deploy estático do Render
release-please-config.json        # versionamento semântico
.release-please-manifest.json     # versão canônica inicial (desktop)
.github/workflows/release.yml     # release-please + build matriz
desktop/
  package.json                    # projeto isolado (nunca na raiz)
  main.js                         # processo principal do Electron
  electron-builder.yml            # alvo zip, asar, nomes de artefato
  scripts/prepare.js              # vendoriza o CDN na cópia
  build/                          # buildResources (ícone)
  app/                            # GERADO — gitignored
  dist/                           # GERADO — gitignored
```

> O shell desktop vive em `desktop/` de propósito: um `package.json` na raiz
> poderia ser interpretado pela plataforma de deploy e quebrar o site.

---

## Rodar localmente (desktop)

```bash
cd desktop
npm install     # gera/atualiza package-lock.json — deve ser commitado
npm start       # roda prepare.js e abre o Electron
```

## Build manual

```bash
cd desktop
npm run build:win     # .zip Windows (x64)
npm run build:mac     # .zip macOS (arch do host)
npm run build:linux   # .zip Linux
npm run build         # plataforma atual
```

Artefatos em `desktop/dist/`. O `artifactName` é explícito por plataforma:
`mangue-verde-3d-v<versao>-<win|mac|linux>-<arch>.zip`.

## Como funciona o modo offline

1. `prepare.js` apaga e recria `desktop/app/`.
2. Copia o HTML publicado para `desktop/app/index.html`.
3. Copia do pacote npm `three@0.128.0` (fixado) para `app/vendor/`:
   - `build/three.min.js`
   - `examples/js/controls/OrbitControls.js`
4. Reescreve **somente na cópia** as duas URLs do jsDelivr para caminhos locais.
5. Falha o build se:
   - a versão instalada do `three` divergir da versão fixada;
   - algum arquivo vendor faltar ou for suspeito (tamanho mínimo);
   - um padrão de CDN não aparecer **exatamente 1x**;
   - sobrar `cdn.jsdelivr.net` ou qualquer `src`/`href` remoto no HTML final.

O resultado são 3 arquivos dentro do `app.asar` (`index.html` + 2 vendor), sem
`node_modules` e sem dependência de rede no primeiro start.

Validação manual do pacote final:

```bash
cd desktop
npx asar list dist/*/resources/app.asar
# não deve haver node_modules; deve listar app/index.html, app/vendor/*.js
npx asar extract-file dist/<pasta>/resources/app.asar app/index.html | grep -c 'https\?://' || true
```

---

## Versionamento (Conventional Commits + release-please)

A versão canônica fica em `desktop/package.json`. A PR de release atualiza
`desktop/package.json`, `desktop/package-lock.json` e `desktop/CHANGELOG.md`;
ao mesclar, o release-please cria a tag **`vX.Y.Z`** e a Release.

| Prefixo | Bump |
| --- | --- |
| `fix:` / `perf:` | patch |
| `feat:` | minor |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` | major |
| `docs:` `chore:` `ci:` `refactor:` `test:` | nenhum |

- Commit `chore:` → nenhuma PR/tag; o job `build` fica `skipped` (correto).
- Commit `fix:` → PR de release → merge → tag `vX.Y.(Z+1)` + Release + zips.
- **Primeiro release**: o manifesto já declara `1.0.0` sem tag existente. O
  primeiro `feat:` gera `1.1.0`; o primeiro `fix:` gera `1.0.1`. Para começar
  exatamente em `v1.0.0`, use o commit de release com `Release-As: 1.0.0` no
  corpo da mensagem (ou ajuste o manifesto antes do primeiro merge).

### Disparar o build sem release

Actions → **Release** → *Run workflow* → campo `tag` vazio.
Versão lida de `desktop/package.json`; zips ficam como artefatos do run.

Com uma tag existente (`v1.2.3`), o run também anexa os zips à Release.

### Por que o job `build` não usa `on: push: tags`

Tags/Releases criadas com o `GITHUB_TOKEN` **não disparam outros workflows**.
Por isso `build` depende de `release-please` e usa
`release_created == 'true'`. Um PAT só seria necessário se o humano exigir
disparo por evento de tag — não é o caso aqui.

---

## Baixar e executar

1. Releases → escolha a versão → baixe
   `mangue-verde-3d-v<versao>-win-x64.zip` (ou mac/linux).
2. Descompacte e execute o binário.
3. **Windows SmartScreen**: o app não é assinado digitalmente, então aparece
   “O Windows protegeu o computador” / “desenvolvedor não identificado”.
   Use *Mais informações → Executar assim mesmo*. Assinatura de código
   (certificado EV/OV) é o único jeito de remover esse aviso.

Atalhos: `F11` alterna tela cheia; `Esc` fecha o app; links externos abrem no
navegador do sistema.

---

## Configurações manuais necessárias

1. **Render — nome do serviço**: `render.yaml` usa `name: mangue-verde-3d`.
   Confirme que coincide com o serviço existente. **Renomear muda o domínio
   interno**; ajuste o `name` para o serviço real em vez de criar outro.
   Se o serviço foi criado no dashboard, vincule o Blueprint apenas depois de
   conferir o nome e o `staticPublishPath: .`.
2. **Render — filtros de build** (dashboard, não no `render.yaml`): adicione
   `ignoredPaths` para `desktop/**`, `.github/**`, `README.md`,
   `release-please-config.json`, `.release-please-manifest.json` e `.gitignore`,
   evitando deploys inúteis em commits de release. Aplicar no dashboard evita
   mudar o deploy atual.
3. **Actions — permissões**: Settings → Actions → General → *Workflow
   permissions* = *Read and write* (o workflow já declara `contents: write`
   apenas nos jobs que precisam; o token global precisa permitir).
4. **Ícone**: coloque `desktop/build/icon.png` 1024x1024 (ver
   `desktop/build/README.md`).
5. **Lockfile**: `cd desktop && npm install` e commite
   `desktop/package-lock.json` — sem ele o `npm ci` do CI falha.
6. **Primeira tag**: o manifesto começa em `1.0.0`. Se quiser a primeira tag
   exatamente `v1.0.0`, veja a seção de versionamento acima.

### Observação sobre o publish path

O serviço publica a raiz do repositório (`staticPublishPath: .`), o que mantém
a URL e os bytes atuais. Consequência: os arquivos de `desktop/` também ficam
acessíveis publicamente (código-fonte do shell, sem segredos). Se isso for
indesejado, a alternativa é mover o HTML para `public/` e apontar
`staticPublishPath: public` — mas isso **muda o deploy** e exige janela de
manutenção, portanto não foi feito automaticamente.
