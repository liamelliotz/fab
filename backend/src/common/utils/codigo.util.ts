import { randomInt } from 'node:crypto';

/**
 * Códigos de retirada e de devolução (os mesmos do QR Code).
 * 6 caracteres, sem I, L, O, 0 e 1 (confundem na leitura). Igual ao front (core/utils/codigo.utils.ts).
 */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_CODIGO = 6;

/** Gera um código novo que não esteja em `emUso`. */
export function gerarCodigo(emUso: ReadonlySet<string> = new Set()): string {
  for (;;) {
    let codigo = '';
    for (let i = 0; i < TAMANHO_CODIGO; i++) {
      codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
    }
    if (!emUso.has(codigo)) return codigo;
  }
}

/**
 * Limpa o que foi digitado ou lido no balcão: aceita "h3q-8zw", "H3Q8ZW" ou o conteúdo do
 * QR ("FAB:R:EMP-2026-0040:H3Q8ZW") e devolve só o código, em maiúsculas.
 */
export function normalizarCodigo(texto: string): string {
  let bruto = texto.trim();
  if (bruto.toUpperCase().startsWith('FAB:')) {
    bruto = bruto.slice(bruto.lastIndexOf(':') + 1);
  }
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Conteúdo do QR: FAB:R:<protocolo>:<codigo> (retirada) ou FAB:D:... (devolução). */
export function montarPayloadQr(
  tipo: 'R' | 'D',
  protocolo: string,
  codigo: string,
): string {
  return `FAB:${tipo}:${protocolo}:${codigo}`;
}
