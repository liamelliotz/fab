/** Data de hoje no formato YYYY-MM-DD (fuso local). */
export function hojeISO(): string {
  return paraISO(new Date());
}

/** Momento atual em ISO 8601 completo (usado nos registros da linha do tempo). */
export function agoraISO(): string {
  return new Date().toISOString();
}

/** Converte YYYY-MM-DD (ou ISO completo) para DD/MM/AAAA. */
export function formatarData(iso: string | undefined | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Converte um ISO completo para "DD/MM/AAAA às HH:MM" (fuso local). */
export function formatarDataHora(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hora = String(d.getHours()).padStart(2, '0');
  const minuto = String(d.getMinutes()).padStart(2, '0');
  return `${formatarData(paraISO(d))} às ${hora}:${minuto}`;
}

/** Soma (ou subtrai, com número negativo) dias a uma data YYYY-MM-DD. */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return paraISO(new Date(ano, mes - 1, dia + dias));
}

/** Quantos dias há de `de` até `ate` (positivo quando `ate` é depois de `de`). */
export function diferencaEmDias(de: string, ate: string): number {
  const [a1, m1, d1] = de.slice(0, 10).split('-').map(Number);
  const [a2, m2, d2] = ate.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/** Momento daqui a `horas` (negativo = no passado), em ISO completo. */
export function horasDepoisISO(horas: number): string {
  return new Date(Date.now() + horas * 3_600_000).toISOString();
}

function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
