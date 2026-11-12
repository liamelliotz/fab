/**
 * DATAS DO FAB
 * ======================================================================================
 * Regra do contrato: datas de calendário são texto AAAA-MM-DD; momentos (criadoEm, eventos)
 * são ISO 8601 completo.
 *
 * "Hoje" é sempre o dia NA ESCOLA, e não o dia do servidor. Um servidor em UTC vira o dia
 * 3 horas antes de Macapá, o que marcaria atraso cedo demais. Por isso o fuso vem de
 * APP_TIMEZONE (.env), com padrão America/Belem (UTC-3, o fuso do Amapá).
 * ======================================================================================
 */
export const FUSO_PADRAO = 'America/Belem';

/** Fuso configurado no .env (APP_TIMEZONE) ou o padrão. */
export function fusoDaAplicacao(): string {
  return process.env.APP_TIMEZONE?.trim() || FUSO_PADRAO;
}

/** Converte um momento para AAAA-MM-DD no fuso da escola. */
export function paraIso(data: Date, fuso: string = fusoDaAplicacao()): string {
  // O formato 'en-CA' já devolve AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

/** O dia de hoje (AAAA-MM-DD) no fuso da escola. */
export function hojeIso(agora: Date = new Date()): string {
  return paraIso(agora);
}

/** Soma (ou subtrai) dias de uma data AAAA-MM-DD, sem depender de fuso. */
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

/** Quantos dias vão de `inicio` até `fim` (negativo se `fim` vier antes). */
export function diferencaEmDias(inicio: string, fim: string): number {
  const paraUtc = (iso: string) => {
    const [ano, mes, dia] = iso.split('-').map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((paraUtc(fim) - paraUtc(inicio)) / 86_400_000);
}

/** Confere o formato AAAA-MM-DD e se a data existe (30/02 não passa). */
export function ehDataIso(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  return somarDias(valor, 0) === valor;
}
