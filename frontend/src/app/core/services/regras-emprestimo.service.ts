import { Injectable, effect, inject, signal } from '@angular/core';
import { CategoriaEquipamento } from '../models/equipamento.model';
import { AlteracaoRegras, PoliticaAtraso, RegrasEmprestimo } from '../models/regras-emprestimo.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';
import { agoraISO, somarDias } from '../utils/date.utils';
import { AuthService } from './auth.service';
import { CATEGORIAS } from './equipamento.service';

const CHAVE_REGRAS = 'fab_demo_v9_regras_emprestimo';
const CHAVE_ALTERACOES = 'fab_demo_v9_regras_alteracoes';

/** Limites das regras (os mesmos que a API deve conferir). */
export const LIMITES_REGRAS = {
  diasParaRetirar: { min: 0, max: 7 },
  limitePorCategoria: { min: 1, max: 50 },
  fatorSuspensao: { min: 1, max: 5 },
  maximoSuspensaoDias: { min: 1, max: 90 },
} as const;

export const NOME_POLITICA_ATRASO: Record<PoliticaAtraso, string> = {
  aviso: 'Só avisar',
  bloqueio: 'Bloquear novos pedidos',
  suspensao: 'Suspensão automática',
};

export const DESCRICAO_POLITICA_ATRASO: Record<PoliticaAtraso, string> = {
  aviso: 'O atraso fica registrado e aparece no painel, mas a pessoa continua pedindo normalmente.',
  bloqueio: 'Enquanto houver material atrasado, a pessoa não faz pedidos novos.',
  suspensao: 'Bloqueia enquanto houver atraso e, depois da devolução, suspende a pessoa por alguns dias.',
};

/** Regras de fábrica: valem até a coordenação mudar. */
export function regrasPadrao(): RegrasEmprestimo {
  return {
    diasParaRetirar: 1,
    limitePorCategoria: { eletronico: 4, ferramenta: 3, impressora_3d: 1, corte_laser: 1, outros: null },
    politicaAtraso: 'suspensao',
    fatorSuspensao: 2,
    maximoSuspensaoDias: 30,
  };
}

export function nomeCategoria(c: CategoriaEquipamento): string {
  return CATEGORIAS.find((x) => x.valor === c)?.nome ?? c;
}

const dias = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);

/**
 * REGRAS DE EMPRÉSTIMO (modo demonstração): prazo para retirar, limite por categoria e
 * política de atraso. Quem aplica as regras é o EmprestimoService; aqui só ficam os valores,
 * a validação e o registro de quem mudou o quê (vai para a auditoria).
 */
@Injectable({ providedIn: 'root' })
export class RegrasEmprestimoService {
  private readonly auth = inject(AuthService);

  readonly regras = signal<RegrasEmprestimo>({ ...regrasPadrao(), ...lerJson<Partial<RegrasEmprestimo>>(CHAVE_REGRAS) });
  readonly alteracoes = signal<AlteracaoRegras[]>(lerJson<AlteracaoRegras[]>(CHAVE_ALTERACOES) ?? []);

  constructor() {
    effect(() => gravarJson(CHAVE_REGRAS, this.regras()));
    effect(() => gravarJson(CHAVE_ALTERACOES, this.alteracoes()));
    ouvirOutrasAbas<RegrasEmprestimo>(CHAVE_REGRAS, (v) => v && this.regras.set({ ...regrasPadrao(), ...v }));
    ouvirOutrasAbas<AlteracaoRegras[]>(CHAVE_ALTERACOES, (v) => v && this.alteracoes.set(v));
  }

  // ---------- Consultas usadas pelas regras ----------

  /** Último dia para retirar um pedido aprovado (inclusive). */
  prazoRetirada(dataPrevistaRetirada: string): string {
    return somarDias(dataPrevistaRetirada.slice(0, 10), this.regras().diasParaRetirar);
  }

  limite(categoria: CategoriaEquipamento): number | null {
    return this.regras().limitePorCategoria[categoria] ?? null;
  }

  /** Atraso impede pedidos novos? (políticas "bloqueio" e "suspensão") */
  atrasoBloqueia(): boolean {
    return this.regras().politicaAtraso !== 'aviso';
  }

  /** Dias de suspensão para um atraso (0 quando a política não suspende). */
  diasDeSuspensao(diasAtraso: number): number {
    const r = this.regras();
    if (r.politicaAtraso !== 'suspensao' || diasAtraso <= 0) return 0;
    return Math.min(r.maximoSuspensaoDias, diasAtraso * r.fatorSuspensao);
  }

  /** Resumo em uma linha (Configurações e tela de pedido). */
  resumoPolitica(r: RegrasEmprestimo = this.regras()): string {
    if (r.politicaAtraso === 'suspensao') {
      return `Suspensão automática: ${dias(r.fatorSuspensao)} para cada dia de atraso (máximo de ${dias(r.maximoSuspensaoDias)}).`;
    }
    return DESCRICAO_POLITICA_ATRASO[r.politicaAtraso];
  }

  // ---------- Alterar ----------

  /** Confere as regras. Devolve a mensagem do 1º problema, ou null. */
  validar(r: RegrasEmprestimo): string | null {
    const inteiro = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    const L = LIMITES_REGRAS;
    if (!inteiro(r.diasParaRetirar, L.diasParaRetirar.min, L.diasParaRetirar.max)) {
      return `O prazo para retirar deve ser de ${L.diasParaRetirar.min} a ${L.diasParaRetirar.max} dias.`;
    }
    for (const c of CATEGORIAS) {
      const v = r.limitePorCategoria[c.valor];
      if (v !== null && v !== undefined && !inteiro(v, L.limitePorCategoria.min, L.limitePorCategoria.max)) {
        return `O limite de "${c.nome}" deve ser de ${L.limitePorCategoria.min} a ${L.limitePorCategoria.max} unidades, ou ficar vazio (sem limite).`;
      }
    }
    if (!(r.politicaAtraso in NOME_POLITICA_ATRASO)) return 'Escolha a política de atraso.';
    if (r.politicaAtraso === 'suspensao') {
      if (!inteiro(r.fatorSuspensao, L.fatorSuspensao.min, L.fatorSuspensao.max)) {
        return `A suspensão deve ser de ${L.fatorSuspensao.min} a ${L.fatorSuspensao.max} dias por dia de atraso.`;
      }
      if (!inteiro(r.maximoSuspensaoDias, L.maximoSuspensaoDias.min, L.maximoSuspensaoDias.max)) {
        return `A suspensão máxima deve ser de ${L.maximoSuspensaoDias.min} a ${L.maximoSuspensaoDias.max} dias.`;
      }
    }
    return null;
  }

  /** Grava as regras novas (somente a coordenação). Devolve erro ou null. */
  salvar(nova: RegrasEmprestimo): string | null {
    if (this.auth.perfilAtual() !== 'admin') return 'Só a coordenação altera as regras de empréstimo.';
    const erro = this.validar(nova);
    if (erro) return erro;
    const mudancas = this.diferencas(this.regras(), nova);
    if (mudancas.length === 0) return 'Nada mudou.';
    const por = this.auth.usuarioAtual();
    const em = agoraISO();
    this.regras.set({ ...nova, atualizadoEm: em, atualizadoPor: por });
    this.alteracoes.update((l) => [{ id: crypto.randomUUID(), em, por, mudancas }, ...l]);
    return null;
  }

  /** Registra uma decisão da coordenação ligada às regras (ex.: encerrar uma suspensão antes do prazo). */
  registrar(mudanca: string): void {
    const por = this.auth.usuarioAtual();
    this.alteracoes.update((l) => [{ id: crypto.randomUUID(), em: agoraISO(), por, mudancas: [mudanca] }, ...l]);
  }

  /** Volta às regras de fábrica (demonstração). */
  reiniciar(): void {
    this.regras.set(regrasPadrao());
    this.alteracoes.set([]);
  }

  private diferencas(a: RegrasEmprestimo, b: RegrasEmprestimo): string[] {
    const m: string[] = [];
    const lim = (v: number | null | undefined) => (v === null || v === undefined ? 'sem limite' : String(v));
    if (a.diasParaRetirar !== b.diasParaRetirar) {
      m.push(`Prazo para retirar: ${dias(a.diasParaRetirar)} → ${dias(b.diasParaRetirar)}`);
    }
    for (const c of CATEGORIAS) {
      const x = a.limitePorCategoria[c.valor] ?? null;
      const y = b.limitePorCategoria[c.valor] ?? null;
      if (x !== y) m.push(`Limite de ${c.nome}: ${lim(x)} → ${lim(y)}`);
    }
    if (a.politicaAtraso !== b.politicaAtraso) {
      m.push(`Política de atraso: ${NOME_POLITICA_ATRASO[a.politicaAtraso]} → ${NOME_POLITICA_ATRASO[b.politicaAtraso]}`);
    }
    if (b.politicaAtraso === 'suspensao') {
      if (a.fatorSuspensao !== b.fatorSuspensao) m.push(`Suspensão por dia de atraso: ${dias(a.fatorSuspensao)} → ${dias(b.fatorSuspensao)}`);
      if (a.maximoSuspensaoDias !== b.maximoSuspensaoDias) m.push(`Suspensão máxima: ${dias(a.maximoSuspensaoDias)} → ${dias(b.maximoSuspensaoDias)}`);
    }
    return m;
  }
}
