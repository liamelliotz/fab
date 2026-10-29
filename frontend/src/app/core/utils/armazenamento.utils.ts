/**
 * Acesso seguro ao localStorage para os dados da demonstração.
 * Funciona no servidor (SSR), onde não existe localStorage, e quando o navegador bloqueia o acesso:
 * nesses casos lê "nada" e ignora a gravação (os dados ficam só na memória).
 */
function armazenamento(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function lerJson<T>(chave: string): T | null {
  try {
    const texto = armazenamento()?.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : null;
  } catch {
    return null;
  }
}

export function gravarJson(chave: string, valor: unknown): void {
  try {
    armazenamento()?.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem espaço ou bloqueado: segue só na memória */
  }
}

export function removerChave(chave: string): void {
  try {
    armazenamento()?.removeItem(chave);
  } catch {
    /* ignora */
  }
}
