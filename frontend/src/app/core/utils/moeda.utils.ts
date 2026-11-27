/** Valores em reais (R$). O FAB guarda número com até 2 casas; a tela mostra no formato brasileiro. */

/** Teto de segurança para um único bem (evita erro de digitação como 289900000). */
export const VALOR_MAXIMO_ITEM = 1_000_000;

/** 2899.5 → "R$ 2.899,50" */
export function formatarMoeda(valor: number | undefined | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** 2899.5 → "2.899,50" (para preencher um campo de texto ao editar) */
export function moedaParaCampo(valor: number | undefined | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(valor)) return '';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Lê o que a pessoa digitou: "2.899,50", "2899,5", "R$ 2.899" ou "2899.50".
 * Devolve null se não for um valor válido (vazio, letras, negativo, mais de 2 casas).
 */
export function lerMoeda(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto >= 0 ? Math.round(texto * 100) / 100 : null;
  let t = (texto ?? '').replace(/R\$|\s/g, '').trim();
  if (!t || /[^\d.,]/.test(t)) return null;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.'); // formato brasileiro
  } else if ((t.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(t)) {
    t = t.replace(/\./g, ''); // "2.899" ou "1.234.567" = milhar
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Mensagem de erro de um valor obrigatório, ou null se estiver ok. */
export function validarValorItem(valor: number | null): string | null {
  if (valor === null) return 'Informe o valor no formato 2.899,00.';
  if (valor <= 0) return 'O valor deve ser maior que zero.';
  if (valor > VALOR_MAXIMO_ITEM) return 'Valor acima do limite de R$ 1.000.000,00 por item. Confira a digitação.';
  return null;
}
