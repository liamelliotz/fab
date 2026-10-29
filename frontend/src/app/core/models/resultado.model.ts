/**
 * Resultado de uma operação que pode falhar com uma mensagem para o usuário.
 * Use `if (!r.ok) { mostrar(r.erro); return; }` e depois `r.valor`.
 */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export const sucesso = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
export const falha = <T = never>(erro: string): Resultado<T> => ({ ok: false, erro });
