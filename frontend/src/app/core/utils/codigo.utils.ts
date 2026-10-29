/**
 * Códigos de retirada e de devolução.
 * O alfabeto não tem I, L, O, 0 e 1 (confundem na hora de ditar ou digitar).
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Gera um código aleatório que não esteja em `emUso`. Ex.: "K7M4PX". */
export function gerarCodigo(tamanho = 6, emUso: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const sorteio = new Uint32Array(tamanho);
    globalThis.crypto.getRandomValues(sorteio);
    const codigo = Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join('');
    if (!emUso.has(codigo)) return codigo;
  }
}

/**
 * Deixa o texto digitado (ou lido por um leitor de QR) só com o código, em maiúsculas.
 * Aceita "k7m-4px", " K7M4PX " e o conteúdo inteiro do QR ("FAB:R:EMP-2026-0042:K7M4PX").
 */
export function normalizarCodigo(texto: string): string {
  let bruto = texto.trim();
  if (bruto.toUpperCase().startsWith('FAB:')) {
    bruto = bruto.slice(bruto.lastIndexOf(':') + 1);
  }
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Mostra o código em dois blocos, mais fácil de ditar: "K7M4PX" vira "K7M-4PX". */
export function formatarCodigo(codigo: string): string {
  return codigo.length === 6 ? `${codigo.slice(0, 3)}-${codigo.slice(3)}` : codigo;
}

/** Conteúdo gravado no QR. R = retirada, D = devolução. */
export function montarPayloadQr(tipo: 'R' | 'D', protocolo: string, codigo: string): string {
  return `FAB:${tipo}:${protocolo}:${codigo}`;
}
