/**
 * Gerador de QR Code (modo byte, correção de erro M, versões 1 a 6, até 106 bytes).
 * Existe para a demonstração funcionar sem instalar biblioteca. Quando o projeto aceitar
 * dependências novas, dá para trocar por uma biblioteca (ex.: "qrcode") sem mudar quem chama:
 * basta devolver o mesmo `{ lado, caminho }`.
 */

export interface QrDesenho {
  /** Lado do desenho em módulos, já com a margem branca. Use como viewBox="0 0 lado lado". */
  lado: number;
  /** Atributo `d` de um <path>: um quadradinho por módulo escuro. */
  caminho: string;
}

interface Versao {
  /** Palavras de dados no total. */
  dados: number;
  /** Palavras de correção de erro por bloco. */
  ecPorBloco: number;
  /** Quantidade de blocos. */
  blocos: number;
  /** Centros dos padrões de alinhamento (vazio na versão 1). */
  alinhamento: number[];
}

// Tabelas do padrão ISO 18004, nível M.
const VERSOES: Versao[] = [
  { dados: 16, ecPorBloco: 10, blocos: 1, alinhamento: [] },
  { dados: 28, ecPorBloco: 16, blocos: 1, alinhamento: [6, 18] },
  { dados: 44, ecPorBloco: 26, blocos: 1, alinhamento: [6, 22] },
  { dados: 64, ecPorBloco: 18, blocos: 2, alinhamento: [6, 26] },
  { dados: 86, ecPorBloco: 24, blocos: 2, alinhamento: [6, 30] },
  { dados: 108, ecPorBloco: 16, blocos: 4, alinhamento: [6, 34] },
];

// ---------- Aritmética em GF(256) (Reed-Solomon) ----------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const multiplicar = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

function divisorReedSolomon(grau: number): number[] {
  const divisor = new Array<number>(grau).fill(0);
  divisor[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < grau; j++) {
      divisor[j] = multiplicar(divisor[j], raiz);
      if (j + 1 < grau) divisor[j] ^= divisor[j + 1];
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return divisor;
}

function restoReedSolomon(dados: number[], divisor: number[]): number[] {
  const resto = new Array<number>(divisor.length).fill(0);
  for (const byte of dados) {
    const fator = byte ^ (resto.shift() as number);
    resto.push(0);
    divisor.forEach((coef, i) => {
      resto[i] ^= multiplicar(coef, fator);
    });
  }
  return resto;
}

// ---------- Montagem dos dados ----------
function codificarTexto(texto: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(texto));
  const indice = VERSOES.findIndex((v) => bytes.length <= v.dados - 2);
  if (indice < 0) throw new Error('Texto grande demais para o QR (máximo 106 bytes).');
  const versao = VERSOES[indice];

  const bits: number[] = [];
  const colocar = (valor: number, qtd: number) => {
    for (let i = qtd - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  colocar(0b0100, 4); // modo byte
  colocar(bytes.length, 8); // quantidade de caracteres (8 bits nas versões 1 a 9)
  bytes.forEach((b) => colocar(b, 8));

  const capacidade = versao.dados * 8;
  colocar(0, Math.min(4, capacidade - bits.length)); // terminador
  while (bits.length % 8 !== 0) bits.push(0);

  const palavras: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    palavras.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  }
  for (let pad = 0xec; palavras.length < versao.dados; pad ^= 0xec ^ 0x11) palavras.push(pad);

  // Divide em blocos, calcula a correção de erro e intercala as palavras.
  const tamanhoBloco = versao.dados / versao.blocos;
  const divisor = divisorReedSolomon(versao.ecPorBloco);
  const blocosDados: number[][] = [];
  const blocosEc: number[][] = [];
  for (let b = 0; b < versao.blocos; b++) {
    const parte = palavras.slice(b * tamanhoBloco, (b + 1) * tamanhoBloco);
    blocosDados.push(parte);
    blocosEc.push(restoReedSolomon(parte, divisor));
  }
  const resultado: number[] = [];
  for (let i = 0; i < tamanhoBloco; i++) blocosDados.forEach((blk) => resultado.push(blk[i]));
  for (let i = 0; i < versao.ecPorBloco; i++) blocosEc.forEach((blk) => resultado.push(blk[i]));
  return resultado;
}

// ---------- Matriz ----------
type Matriz = boolean[][];

function criarMatriz(lado: number): Matriz {
  return Array.from({ length: lado }, () => new Array<boolean>(lado).fill(false));
}

function bit(valor: number, i: number): boolean {
  return ((valor >>> i) & 1) !== 0;
}

class Desenho {
  readonly modulos: Matriz;
  readonly funcao: Matriz;

  constructor(
    readonly lado: number,
    private readonly versao: Versao,
  ) {
    this.modulos = criarMatriz(lado);
    this.funcao = criarMatriz(lado);
    this.padroesFixos();
  }

  private definir(x: number, y: number, escuro: boolean): void {
    this.modulos[y][x] = escuro;
    this.funcao[y][x] = true;
  }

  private padroesFixos(): void {
    const n = this.lado;
    // Linhas de sincronismo
    for (let i = 0; i < n; i++) {
      this.definir(6, i, i % 2 === 0);
      this.definir(i, 6, i % 2 === 0);
    }
    // Três marcadores de canto (com a borda branca)
    this.marcador(3, 3);
    this.marcador(n - 4, 3);
    this.marcador(3, n - 4);
    // Alinhamento
    const pos = this.versao.alinhamento;
    pos.forEach((cy, i) =>
      pos.forEach((cx, j) => {
        const sobreMarcador =
          (i === 0 && j === 0) ||
          (i === 0 && j === pos.length - 1) ||
          (i === pos.length - 1 && j === 0);
        if (!sobreMarcador) this.alinhar(cx, cy);
      }),
    );
    // Reserva a área do formato (preenchida depois) e o módulo escuro fixo
    this.formato(0);
  }

  private marcador(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.lado && y >= 0 && y < this.lado) {
          this.definir(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private alinhar(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.definir(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  /** Grava os 15 bits de formato (nível M + máscara), nas duas cópias. */
  formato(mascara: number): void {
    const n = this.lado;
    const dados = (0b00 << 3) | mascara; // 00 = nível M
    let resto = dados;
    for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
    const bits = ((dados << 10) | resto) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.definir(8, i, bit(bits, i));
    this.definir(8, 7, bit(bits, 6));
    this.definir(8, 8, bit(bits, 7));
    this.definir(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.definir(14 - i, 8, bit(bits, i));

    for (let i = 0; i < 8; i++) this.definir(n - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.definir(8, n - 15 + i, bit(bits, i));
    this.definir(8, n - 8, true); // módulo escuro fixo
  }

  colocarDados(palavras: number[]): void {
    const n = this.lado;
    let i = 0;
    for (let direita = n - 1; direita >= 1; direita -= 2) {
      if (direita === 6) direita = 5; // pula a coluna de sincronismo
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = direita - j;
          const subindo = ((direita + 1) & 2) === 0;
          const y = subindo ? n - 1 - vert : vert;
          if (!this.funcao[y][x] && i < palavras.length * 8) {
            this.modulos[y][x] = bit(palavras[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  aplicarMascara(mascara: number): void {
    for (let y = 0; y < this.lado; y++) {
      for (let x = 0; x < this.lado; x++) {
        if (!this.funcao[y][x] && mascaraInverte(mascara, x, y)) {
          this.modulos[y][x] = !this.modulos[y][x];
        }
      }
    }
  }
}

function mascaraInverte(mascara: number, x: number, y: number): boolean {
  switch (mascara) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
    default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
  }
}

/** Nota de "feiura" da matriz (regras do padrão): quanto menor, mais fácil de ler. */
function penalidade(m: Matriz): number {
  const n = m.length;
  let total = 0;

  // Regra 1: sequências de 5 ou mais módulos iguais, em linhas e colunas
  for (let a = 0; a < n; a++) {
    for (const horizontal of [true, false]) {
      let corrida = 1;
      for (let b = 1; b < n; b++) {
        const atual = horizontal ? m[a][b] : m[b][a];
        const anterior = horizontal ? m[a][b - 1] : m[b - 1][a];
        if (atual === anterior) {
          corrida++;
          if (corrida === 5) total += 3;
          else if (corrida > 5) total += 1;
        } else {
          corrida = 1;
        }
      }
    }
  }

  // Regra 2: blocos 2x2 da mesma cor
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) total += 3;
    }
  }

  // Regra 3: padrão parecido com o marcador de canto (1:1:3:1:1)
  const padrao = [true, false, true, true, true, false, true, false, false, false, false];
  const inverso = [...padrao].reverse();
  for (let a = 0; a < n; a++) {
    for (let b = 0; b <= n - 11; b++) {
      for (const horizontal of [true, false]) {
        const casaPadrao = (p: boolean[]) =>
          p.every((v, k) => (horizontal ? m[a][b + k] : m[b + k][a]) === v);
        if (casaPadrao(padrao)) total += 40;
        if (casaPadrao(inverso)) total += 40;
      }
    }
  }

  // Regra 4: equilíbrio entre módulos escuros e claros
  const escuros = m.reduce((soma, linha) => soma + linha.filter(Boolean).length, 0);
  const percentual = (escuros * 100) / (n * n);
  total += Math.floor(Math.abs(percentual - 50) / 5) * 10;

  return total;
}

/** Gera a matriz do QR (true = módulo escuro), sem margem. */
export function gerarMatrizQr(texto: string): boolean[][] {
  const palavras = codificarTexto(texto);
  const indice = VERSOES.findIndex((v) => palavras.length === v.dados + v.ecPorBloco * v.blocos);
  const versao = VERSOES[indice];
  const lado = 17 + 4 * (indice + 1);

  let melhor: Desenho | null = null;
  let melhorNota = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    const desenho = new Desenho(lado, versao);
    desenho.colocarDados(palavras);
    desenho.aplicarMascara(mascara);
    desenho.formato(mascara);
    const nota = penalidade(desenho.modulos);
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = desenho;
    }
  }
  return (melhor as Desenho).modulos;
}

/** Gera o desenho vetorial do QR, pronto para um <svg>. A margem branca é de 4 módulos (o mínimo do padrão). */
export function gerarDesenhoQr(texto: string): QrDesenho {
  const matriz = gerarMatrizQr(texto);
  const margem = 4;
  const partes: string[] = [];
  matriz.forEach((linha, y) =>
    linha.forEach((escuro, x) => {
      if (escuro) partes.push(`M${x + margem} ${y + margem}h1v1h-1z`);
    }),
  );
  return { lado: matriz.length + margem * 2, caminho: partes.join('') };
}
