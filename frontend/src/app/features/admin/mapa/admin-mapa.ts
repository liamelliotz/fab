import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NOME_ESCOLA_MODELO, buscarLocal } from '../../../core/constants/escola-modelo.constants';
import { AuthService } from '../../../core/services/auth.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { ItemNoLocal, MapaService, ResumoLocal, SituacaoNoLocal } from '../../../core/services/mapa.service';
import { formatarDataHora } from '../../../core/utils/date.utils';

type Filtro = 'tudo' | 'equipamentos' | 'em_uso' | 'manutencao' | 'insumo';

export const NOME_SITUACAO: Record<SituacaoNoLocal, string> = {
  guardado: 'Guardado',
  reservado: 'Reservado',
  em_uso: 'Em uso',
  manutencao: 'Em manutenção',
  nao_localizado: 'Não localizado',
  inativo: 'Inativo',
  insumo: 'Insumo',
};

const ORDEM: SituacaoNoLocal[] = ['em_uso', 'reservado', 'manutencao', 'nao_localizado', 'guardado', 'inativo', 'insumo'];

/**
 * MAPA DE ITENS: em que sala da escola fictícia cada material está agora.
 * Tudo vem dos registros (pedido, balcão, transferência, manutenção e insumos); o mapa nunca é editado à mão.
 */
@Component({
  selector: 'app-admin-mapa',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-mapa.html',
  styleUrl: './admin-mapa.css',
})
export class AdminMapa {
  private readonly mapa = inject(MapaService);
  private readonly equipamentos = inject(EquipamentoService);
  readonly modoDemo = inject(AuthService).modoDemo;

  readonly escola = NOME_ESCOLA_MODELO;
  readonly nomeSituacao = NOME_SITUACAO;
  readonly dataHora = formatarDataHora;

  readonly selecionado = signal<string>('lab-maker');
  readonly filtro = signal<Filtro>('tudo');
  readonly busca = signal('');

  readonly movimentos = computed(() => this.mapa.movimentos().slice(0, 8));

  readonly totais = computed(() => {
    const itens = this.mapa.itens();
    const soma = (f: (i: ItemNoLocal) => boolean) => itens.filter(f).reduce((s, i) => s + i.quantidade, 0);
    return {
      emUso: soma((i) => i.situacao === 'em_uso'),
      guardados: soma((i) => i.situacao === 'guardado' || i.situacao === 'reservado'),
      manutencao: soma((i) => i.situacao === 'manutencao'),
      naoLocalizados: soma((i) => i.situacao === 'nao_localizado'),
    };
  });

  /** Locais agrupados por bloco, na ordem da planta. A assistência técnica (fora da escola) fica no fim. */
  readonly blocos = computed(() => {
    const grupos = new Map<string, ResumoLocal[]>();
    for (const r of this.mapa.locais()) {
      const lista = grupos.get(r.local.bloco) ?? [];
      lista.push(r);
      grupos.set(r.local.bloco, lista);
    }
    return [...grupos.entries()].map(([nome, locais]) => ({ nome, locais }));
  });

  readonly localSelecionado = computed(() => this.mapa.locais().find((r) => r.local.id === this.selecionado()) ?? null);

  readonly itensDoLocal = computed(() =>
    (this.localSelecionado()?.itens ?? [])
      .filter((i) => this.passaNoFiltro(i))
      .sort((a, b) => ORDEM.indexOf(a.situacao) - ORDEM.indexOf(b.situacao) || a.nome.localeCompare(b.nome)),
  );

  /** "Onde está?": todas as posições dos equipamentos e insumos que batem com o texto. */
  readonly resultadoBusca = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    if (termo.length < 2) return null;
    return this.mapa
      .itens()
      .filter((i) => `${i.nome} ${i.patrimonio ?? ''}`.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome) || ORDEM.indexOf(a.situacao) - ORDEM.indexOf(b.situacao));
  });

  /** Total mostrado em cada sala da planta (unidades de equipamento; insumos à parte). */
  totalDaSala(r: ResumoLocal): number {
    return r.emUso + r.guardados + r.manutencao;
  }

  rotuloSala(r: ResumoLocal): string {
    const partes = [
      r.emUso ? `${r.emUso} em uso` : '',
      r.guardados ? `${r.guardados} guardado(s)` : '',
      r.manutencao ? `${r.manutencao} em manutenção` : '',
      r.insumos ? `${r.insumos} insumo(s)` : '',
    ].filter(Boolean);
    return `${r.local.nome}: ${partes.length ? partes.join(', ') : 'nenhum item'}`;
  }

  passaNoFiltro(i: ItemNoLocal): boolean {
    switch (this.filtro()) {
      case 'tudo': return true;
      case 'equipamentos': return i.situacao !== 'insumo';
      case 'em_uso': return i.situacao === 'em_uso' || i.situacao === 'reservado';
      case 'manutencao': return i.situacao === 'manutencao' || i.situacao === 'nao_localizado';
      case 'insumo': return i.situacao === 'insumo';
    }
  }

  escolher(id: string | null): void {
    if (!id) return;
    this.selecionado.set(id);
    this.busca.set('');
  }

  digitarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  mudarFiltro(evento: Event): void {
    this.filtro.set((evento.target as HTMLSelectElement).value as Filtro);
  }

  nomeDoLocal(id: string | null): string {
    return id ? (buscarLocal(id)?.nome ?? 'Local desconhecido') : 'Não localizado';
  }

  historico(i: ItemNoLocal): string | null {
    return i.equipamentoId && this.equipamentos.buscarPorId(i.equipamentoId) ? i.equipamentoId : null;
  }
}
