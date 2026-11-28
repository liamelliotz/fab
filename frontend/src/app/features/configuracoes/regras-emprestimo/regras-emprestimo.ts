import { Component, computed, inject, signal } from '@angular/core';
import { PoliticaAtraso, RegrasEmprestimo } from '../../../core/models/regras-emprestimo.model';
import { CATEGORIAS } from '../../../core/services/equipamento.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  DESCRICAO_POLITICA_ATRASO,
  LIMITES_REGRAS,
  NOME_POLITICA_ATRASO,
  RegrasEmprestimoService,
} from '../../../core/services/regras-emprestimo.service';
import { formatarDataHora } from '../../../core/utils/date.utils';

/** Cópia editável das regras (limites como texto, para aceitar o campo vazio = sem limite). */
interface Rascunho {
  diasParaRetirar: number;
  limites: Record<string, string>;
  politicaAtraso: PoliticaAtraso;
  fatorSuspensao: number;
  maximoSuspensaoDias: number;
}

/**
 * REGRAS DE EMPRÉSTIMO (só a coordenação): prazo para retirar um pedido aprovado, limite de
 * unidades por categoria e política de atraso. Cada alteração fica registrada (quem e quando).
 */
@Component({
  selector: 'app-regras-emprestimo',
  standalone: true,
  templateUrl: './regras-emprestimo.html',
  styleUrl: './regras-emprestimo.css',
})
export class RegrasEmprestimoForm {
  private readonly service = inject(RegrasEmprestimoService);
  private readonly avisos = inject(NotificationService);

  readonly categorias = CATEGORIAS;
  readonly politicas = (Object.keys(NOME_POLITICA_ATRASO) as PoliticaAtraso[]).map((valor) => ({
    valor,
    nome: NOME_POLITICA_ATRASO[valor],
    descricao: DESCRICAO_POLITICA_ATRASO[valor],
  }));
  readonly L = LIMITES_REGRAS;
  readonly opcoesRetirada = Array.from({ length: LIMITES_REGRAS.diasParaRetirar.max + 1 }, (_, i) => i);
  readonly dataHora = formatarDataHora;

  readonly atuais = this.service.regras;
  readonly ultimas = computed(() => this.service.alteracoes().slice(0, 3));
  readonly rascunho = signal<Rascunho>(this.paraRascunho(this.service.regras()));
  readonly erro = signal('');

  /** Exemplo calculado na hora para a política de suspensão (3 dias de atraso). */
  readonly exemplo = computed(() => {
    const r = this.rascunho();
    return Math.min(r.maximoSuspensaoDias || 0, 3 * (r.fatorSuspensao || 0));
  });

  readonly alterado = computed(() => {
    const r = this.montar();
    return !!r && JSON.stringify(this.semCarimbo(r)) !== JSON.stringify(this.semCarimbo(this.service.regras()));
  });

  textoDias(n: number): string {
    if (n === 0) return 'No mesmo dia';
    return n === 1 ? 'Até 1 dia depois' : `Até ${n} dias depois`;
  }

  mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]): void {
    this.erro.set('');
    this.rascunho.update((r) => ({ ...r, [campo]: valor }));
  }

  mudarLimite(categoria: string, valor: string): void {
    this.erro.set('');
    this.rascunho.update((r) => ({ ...r, limites: { ...r.limites, [categoria]: valor } }));
  }

  numero(evento: Event): number {
    const v = (evento.target as HTMLInputElement | HTMLSelectElement).value;
    return v === '' ? NaN : Number(v);
  }

  texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  descartar(): void {
    this.erro.set('');
    this.rascunho.set(this.paraRascunho(this.service.regras()));
  }

  salvar(): void {
    const r = this.montar();
    if (!r) {
      this.erro.set(`Os limites devem ser números inteiros de ${this.L.limitePorCategoria.min} a ${this.L.limitePorCategoria.max}, ou ficar vazios (sem limite).`);
      return;
    }
    const erro = this.service.salvar(r);
    if (erro) {
      this.erro.set(erro);
      return;
    }
    this.rascunho.set(this.paraRascunho(this.service.regras()));
    this.avisos.sucesso('Regras de empréstimo salvas. Valem para os pedidos a partir de agora.');
  }

  /** Converte o rascunho em regras; null se algum limite não é número. */
  private montar(): RegrasEmprestimo | null {
    const d = this.rascunho();
    const limitePorCategoria = {} as RegrasEmprestimo['limitePorCategoria'];
    for (const c of CATEGORIAS) {
      const t = (d.limites[c.valor] ?? '').trim();
      if (t === '') {
        limitePorCategoria[c.valor] = null;
        continue;
      }
      if (!/^\d+$/.test(t)) return null;
      limitePorCategoria[c.valor] = Number(t);
    }
    const atual = this.service.regras();
    return {
      diasParaRetirar: d.diasParaRetirar,
      limitePorCategoria,
      politicaAtraso: d.politicaAtraso,
      fatorSuspensao: d.politicaAtraso === 'suspensao' ? d.fatorSuspensao : atual.fatorSuspensao,
      maximoSuspensaoDias: d.politicaAtraso === 'suspensao' ? d.maximoSuspensaoDias : atual.maximoSuspensaoDias,
    };
  }

  private semCarimbo(r: RegrasEmprestimo) {
    return {
      diasParaRetirar: r.diasParaRetirar,
      limitePorCategoria: CATEGORIAS.map((c) => r.limitePorCategoria[c.valor] ?? null),
      politicaAtraso: r.politicaAtraso,
      fatorSuspensao: r.fatorSuspensao,
      maximoSuspensaoDias: r.maximoSuspensaoDias,
    };
  }

  private paraRascunho(r: RegrasEmprestimo): Rascunho {
    const limites: Record<string, string> = {};
    for (const c of CATEGORIAS) {
      const v = r.limitePorCategoria[c.valor];
      limites[c.valor] = v === null || v === undefined ? '' : String(v);
    }
    return {
      diasParaRetirar: r.diasParaRetirar,
      limites,
      politicaAtraso: r.politicaAtraso,
      fatorSuspensao: r.fatorSuspensao,
      maximoSuspensaoDias: r.maximoSuspensaoDias,
    };
  }
}
