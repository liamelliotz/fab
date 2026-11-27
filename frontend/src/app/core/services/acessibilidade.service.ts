import { Injectable, effect, signal } from '@angular/core';
import { gravarJson, lerJson } from '../utils/armazenamento.utils';

/** Preferências de leitura. Ficam salvas neste navegador e valem também na tela de login. */
export interface PreferenciasAcessibilidade {
  /** Tamanho do texto, em %. */
  tamanho: 100 | 115 | 130;
  /** Reforça o contraste de textos, bordas e ícones. */
  contraste: boolean;
  /** Mais espaço entre linhas, letras e palavras (WCAG 1.4.12). */
  espacamento: boolean;
  /** Links sempre sublinhados. */
  sublinharLinks: boolean;
  /** Desliga animações e transições. */
  semAnimacao: boolean;
  /** Contorno de foco mais grosso e amarelo para quem navega pelo teclado. */
  focoReforcado: boolean;
}

export const PREFERENCIAS_PADRAO: PreferenciasAcessibilidade = {
  tamanho: 100,
  contraste: false,
  espacamento: false,
  sublinharLinks: false,
  semAnimacao: false,
  focoReforcado: false,
};

const CHAVE = 'fab_acessibilidade';

/**
 * ACESSIBILIDADE: aplica as preferências como classes no <html>; o CSS global (styles.css)
 * faz o resto. Nada depende de servidor e funciona em todas as telas.
 */
@Injectable({ providedIn: 'root' })
export class AcessibilidadeService {
  readonly preferencias = signal<PreferenciasAcessibilidade>({
    ...PREFERENCIAS_PADRAO,
    ...lerJson<Partial<PreferenciasAcessibilidade>>(CHAVE),
  });

  constructor() {
    effect(() => {
      const p = this.preferencias();
      gravarJson(CHAVE, p);
      if (typeof document === 'undefined') return;
      const raiz = document.documentElement.classList;
      raiz.toggle('a11y-texto-115', p.tamanho === 115);
      raiz.toggle('a11y-texto-130', p.tamanho === 130);
      raiz.toggle('a11y-contraste', p.contraste);
      raiz.toggle('a11y-espacamento', p.espacamento);
      raiz.toggle('a11y-links', p.sublinharLinks);
      raiz.toggle('a11y-sem-animacao', p.semAnimacao);
      raiz.toggle('a11y-foco', p.focoReforcado);
    });
  }

  /** Quantas opções estão diferentes do padrão (mostrado no botão). */
  ativas(): number {
    const p = this.preferencias();
    return (Object.keys(PREFERENCIAS_PADRAO) as (keyof PreferenciasAcessibilidade)[]).filter(
      (k) => p[k] !== PREFERENCIAS_PADRAO[k],
    ).length;
  }

  mudar<K extends keyof PreferenciasAcessibilidade>(chave: K, valor: PreferenciasAcessibilidade[K]): void {
    this.preferencias.update((p) => ({ ...p, [chave]: valor }));
  }

  restaurar(): void {
    this.preferencias.set({ ...PREFERENCIAS_PADRAO });
  }
}
