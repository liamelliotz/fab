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

/**
 * Avisa quando OUTRA aba do mesmo navegador grava esta chave.
 * Sem isso, cada aba ficava com a sua cópia dos dados: a aba da coordenação não via o pedido
 * novo do professor e, ao salvar qualquer coisa, apagava esse pedido.
 * `aoMudar` recebe o valor novo (ou null se a chave foi apagada: nesse caso a aba mantém o que tem,
 * para duas abas não ficarem gerando dados de exemplo diferentes e brigando entre si).
 */
export function ouvirOutrasAbas<T>(chave: string, aoMudar: (valor: T | null) => void): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (evento) => {
    if (evento.storageArea !== armazenamento() || evento.key !== chave) return;
    try {
      aoMudar(evento.newValue ? (JSON.parse(evento.newValue) as T) : null);
    } catch {
      /* valor inválido: ignora */
    }
  });
}
