import { Injectable, computed, effect, signal } from '@angular/core';
import { gravarJson, lerJson } from '../utils/armazenamento.utils';

/** `sistema` segue a configuração do computador ou celular (claro de dia, escuro à noite etc.). */
export type TemaVisual = 'claro' | 'escuro' | 'sistema';

/** Preferências de leitura. Ficam salvas neste navegador e valem também na tela de login. */
export interface PreferenciasAcessibilidade {
  /** Tamanho do texto, em %. */
  tamanho: 100 | 115 | 130;
  /** Claro, escuro ou igual ao do sistema. */
  tema: TemaVisual;
  /** Fonte Atkinson Hyperlegible (letras fáceis de distinguir), embutida no app. */
  fonteLegivel: boolean;
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
  /** Tradutor de Libras do governo federal (VLibras), com o avatar 3D no canto da tela. */
  libras: boolean;
}

export const PREFERENCIAS_PADRAO: PreferenciasAcessibilidade = {
  tamanho: 100,
  tema: 'claro',
  fonteLegivel: false,
  contraste: false,
  espacamento: false,
  sublinharLinks: false,
  semAnimacao: false,
  focoReforcado: false,
  libras: true,
};

/** Widget oficial do VLibras (Governo Federal). Carregado só quando a opção está ligada. */
export const VLIBRAS_APP = 'https://vlibras.gov.br/app';
const VLIBRAS_SCRIPT = `${VLIBRAS_APP}/vlibras-plugin.js`;

interface JanelaComVLibras extends Window {
  VLibras?: { Widget: new (url: string) => unknown };
}

/** A mesma chave é lida pelo script do index.html, para o tema já abrir certo (sem piscar). */
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

  /** O sistema operacional está no modo escuro? (vale quando o tema é "sistema") */
  private readonly sistemaEscuro = signal(false);

  /** Tema que está valendo agora (resolve o "sistema"). */
  readonly temaAtual = computed<'claro' | 'escuro'>(() => {
    const t = this.preferencias().tema;
    return t === 'sistema' ? (this.sistemaEscuro() ? 'escuro' : 'claro') : t;
  });

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const consulta = window.matchMedia('(prefers-color-scheme: dark)');
      this.sistemaEscuro.set(consulta.matches);
      consulta.addEventListener?.('change', (e) => this.sistemaEscuro.set(e.matches));
    }
    effect(() => {
      const p = this.preferencias();
      const escuro = this.temaAtual() === 'escuro';
      gravarJson(CHAVE, p);
      if (typeof document === 'undefined') return;
      const raiz = document.documentElement.classList;
      raiz.toggle('tema-escuro', escuro);
      raiz.toggle('a11y-fonte-legivel', p.fonteLegivel);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#173d24' : '#2e7d32');
      raiz.toggle('a11y-texto-115', p.tamanho === 115);
      raiz.toggle('a11y-texto-130', p.tamanho === 130);
      raiz.toggle('a11y-contraste', p.contraste);
      raiz.toggle('a11y-espacamento', p.espacamento);
      raiz.toggle('a11y-links', p.sublinharLinks);
      raiz.toggle('a11y-sem-animacao', p.semAnimacao);
      raiz.toggle('a11y-foco', p.focoReforcado);
      this.vlibras(p.libras);
    });
  }

  /**
   * Monta o VLibras uma única vez (marcação oficial como filha direta do <body> + script do
   * vlibras.gov.br) e depois só mostra ou esconde. Sem internet, o FAB segue funcionando normalmente.
   */
  private vlibras(ligado: boolean): void {
    if (typeof document === 'undefined') return;
    let raiz = document.querySelector<HTMLElement>('div[vw]');
    if (ligado && !raiz) {
      raiz = document.createElement('div');
      raiz.setAttribute('vw', '');
      raiz.className = 'enabled';
      const botao = document.createElement('div');
      botao.setAttribute('vw-access-button', '');
      botao.className = 'active';
      const embrulho = document.createElement('div');
      embrulho.setAttribute('vw-plugin-wrapper', '');
      const topo = document.createElement('div');
      topo.className = 'vw-plugin-top-wrapper';
      embrulho.appendChild(topo);
      raiz.append(botao, embrulho);
      document.body.appendChild(raiz);

      const script = document.createElement('script');
      script.src = VLIBRAS_SCRIPT;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.onload = () => {
        const janela = window as JanelaComVLibras;
        if (!janela.VLibras) return;
        new janela.VLibras.Widget(VLIBRAS_APP);
        // O widget espera o "load" da página, que num app Angular já passou: dispara à mão.
        const aoCarregar = window.onload as ((this: Window, ev: Event) => unknown) | null;
        aoCarregar?.call(window, new Event('load'));
      };
      script.onerror = () => raiz?.remove();
      document.body.appendChild(script);
    }
    if (raiz) raiz.style.display = ligado ? '' : 'none';
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
