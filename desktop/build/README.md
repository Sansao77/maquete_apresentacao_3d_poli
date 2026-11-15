# Recursos de build (ícone)

Este diretório é `directories.buildResources` do electron-builder.

Para gerar ícones nativos:

1. Coloque um `icon.png` quadrado de **1024x1024** aqui (`desktop/build/icon.png`).
2. Rode o build normalmente (`npm run build:win`, `build:mac`, `build:linux`).

O electron-builder converte esse PNG em `.ico` (Windows) e `.icns` (macOS)
automaticamente. Nenhum campo `icon` foi fixado em `electron-builder.yml`
justamente para que o build continue funcionando com o ícone padrão do Electron
enquanto `icon.png` não existir.

Requisitos da imagem:

- PNG com transparência, fundo transparente;
- resolução mínima 512x512 (recomendado 1024x1024);
- motivo legível em 16x16 (evite detalhes finos e texto pequeno).
