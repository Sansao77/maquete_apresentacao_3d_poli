'use strict';

/**
 * Gera `desktop/app/` — o pacote offline do site — a partir do HTML publicado.
 *
 * Regra de ouro: este script NUNCA escreve no fonte publicado. Ele apenas lê
 * `maquete_mangue_verde_takes.html`, copia para `desktop/app/index.html` e
 * troca, somente na cópia, as URLs de CDN pelos arquivos vendorizados do
 * pacote `three` instalado em `desktop/node_modules`.
 */

const fs = require('node:fs');
const path = require('node:path');

const DESKTOP_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(DESKTOP_DIR, '..');
const SOURCE_HTML = path.join(REPO_DIR, 'maquete_mangue_verde_takes.html');
const APP_DIR = path.join(DESKTOP_DIR, 'app');
const VENDOR_DIR = path.join(APP_DIR, 'vendor');

/** Versão única de referência: deve casar com a do package.json e com a do HTML. */
const THREE_VERSION = '0.128.0';

/** Arquivos copiados do pacote npm `three` para `app/vendor/`. */
const VENDOR_ASSETS = [
  { from: 'build/three.min.js', to: 'three.min.js', minBytes: 500_000 },
  { from: 'examples/js/controls/OrbitControls.js', to: 'OrbitControls.js', minBytes: 10_000 },
];

/** URLs exatas que existem no HTML publicado e seu destino local na cópia. */
const CDN_REWRITES = [
  {
    pattern: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.min.js`,
    local: 'vendor/three.min.js',
  },
  {
    pattern: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/js/controls/OrbitControls.js`,
    local: 'vendor/OrbitControls.js',
  },
];

/**
 * Aborta o build com mensagem acionável.
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`\n[prepare] ERRO: ${message}\n`);
  process.exit(1);
}

/**
 * Conta ocorrências literais de um padrão.
 * @param {string} haystack
 * @param {string} needle
 * @returns {number}
 */
function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * Localiza o pacote `three` instalado no subprojeto desktop.
 * @returns {string} diretório raiz do pacote
 */
function resolveThreeDir() {
  try {
    return path.dirname(require.resolve('three/package.json', { paths: [DESKTOP_DIR] }));
  } catch {
    return fail(
      'pacote "three" não encontrado em desktop/node_modules.\n' +
        '  Rode: cd desktop && npm ci   (ou npm install)',
    );
  }
}

/**
 * Copia um asset vendorizado validando existência e tamanho mínimo.
 * @param {string} from
 * @param {string} to
 * @param {number} minBytes
 */
function copyVendorAsset(from, to, minBytes) {
  if (!fs.existsSync(from)) {
    fail(
      `arquivo vendor ausente: ${from}\n` +
        `  A versão fixada (${THREE_VERSION}) do pacote "three" não publica esse caminho.\n` +
        '  Ajuste THREE_VERSION/VENDOR_ASSETS em desktop/scripts/prepare.js.',
    );
  }

  const stats = fs.statSync(from);
  if (stats.size < minBytes) {
    fail(`arquivo vendor suspeito: ${from} tem ${stats.size} bytes (mínimo ${minBytes}).`);
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/** Executa a preparação completa do pacote offline. */
function main() {
  if (!fs.existsSync(SOURCE_HTML)) {
    fail(`HTML publicado não encontrado: ${SOURCE_HTML}`);
  }

  const threeDir = resolveThreeDir();
  const installedVersion = JSON.parse(
    fs.readFileSync(path.join(threeDir, 'package.json'), 'utf8'),
  ).version;

  if (installedVersion !== THREE_VERSION) {
    fail(
      `versão do "three" instalada (${installedVersion}) diverge da versão fixada ` +
        `e referenciada no HTML (${THREE_VERSION}).\n` +
        '  Alinhe desktop/package.json e prepare.js antes de gerar o executável.',
    );
  }

  let html = fs.readFileSync(SOURCE_HTML, 'utf8');

  fs.rmSync(APP_DIR, { recursive: true, force: true });
  fs.mkdirSync(VENDOR_DIR, { recursive: true });

  for (const asset of VENDOR_ASSETS) {
    copyVendorAsset(
      path.join(threeDir, asset.from),
      path.join(VENDOR_DIR, asset.to),
      asset.minBytes,
    );
  }

  for (const { pattern, local } of CDN_REWRITES) {
    const occurrences = countOccurrences(html, pattern);
    if (occurrences !== 1) {
      fail(
        `o padrão de CDN deveria aparecer exatamente 1x, mas apareceu ${occurrences}x:\n` +
          `  ${pattern}\n` +
          '  O HTML publicado mudou? Atualize CDN_REWRITES em desktop/scripts/prepare.js.',
      );
    }
    html = html.split(pattern).join(local);
  }

  if (html.includes('cdn.jsdelivr.net')) {
    fail('o HTML final ainda contém referências a cdn.jsdelivr.net.');
  }

  const remoteAsset = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+["']/i);
  if (remoteAsset) {
    fail(
      `recurso remoto restante no HTML final: ${remoteAsset[0]}\n` +
        '  O executável precisa funcionar 100% offline; vendorize esse recurso.',
    );
  }

  fs.writeFileSync(path.join(APP_DIR, 'index.html'), html, 'utf8');

  const generated = [
    'index.html',
    ...VENDOR_ASSETS.map((asset) => path.posix.join('vendor', asset.to)),
  ];

  console.log('[prepare] pacote offline gerado em desktop/app/');
  for (const relativePath of generated) {
    const absolutePath = path.join(APP_DIR, ...relativePath.split('/'));
    const size = fs.statSync(absolutePath).size;
    console.log(`  - app/${relativePath} (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log(`[prepare] three@${installedVersion} vendorizado; nenhuma URL de CDN restante.`);
}

main();
