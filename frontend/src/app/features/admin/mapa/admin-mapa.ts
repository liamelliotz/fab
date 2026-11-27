import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { baixarArquivo } from '../../../core/utils/arquivo.utils';
import { NOME_ESCOLA_MODELO, buscarLocal } from '../../../core/constants/escola-modelo.constants';
import { AuthService } from '../../../core/services/auth.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { ItemNoLocal, MapaService, ResumoLocal, SituacaoNoLocal } from '../../../core/services/mapa.service';
import { formatarDataHora } from '../../../core/utils/date.utils';

type Filtro = 'tudo' | 'equipamentos' | 'em_uso' | 'manutencao' | 'insumo';
/** Visões rápidas dos indicadores do topo (lista de toda a escola). */
export type Visao = 'em_uso' | 'guardados' | 'manutencao' | 'nao_localizado';
const NOME_VISAO: Record<Visao, string> = {
  em_uso: 'Em uso agora',
  guardados: 'Guardados',
  manutencao: 'Em manutenção',
  nao_localizado: 'Não localizados',
};

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

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** Sala aberta; pode vir do link (?local=sala-103). */
  readonly selecionado = signal<string>(this.query.get('local') ?? 'lab-maker');
  readonly filtro = signal<Filtro>('tudo');
  /** "Onde está?"; pode vir do link (?busca=PAT-0003), por exemplo do Inventário. */
  readonly busca = signal(this.query.get('busca') ?? '');
  /** Indicador do topo clicado: lista tudo daquela situação na escola. */
  readonly visao = signal<Visao | null>(null);
  readonly nomeVisao = NOME_VISAO;
  private readonly detalhe = viewChild<ElementRef<HTMLElement>>('detalheSala');

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
    // "Área externa" e "Fora da escola" têm um local cada: viram uma linha só.
    const externos = ['Área externa', 'Fora da escola'];
    const lista = [...grupos.entries()].filter(([nome]) => !externos.includes(nome)).map(([nome, locais]) => ({ nome, locais }));
    const outros = externos.flatMap((n) => grupos.get(n) ?? []);
    if (outros.length) lista.push({ nome: 'Área externa e fora da escola', locais: outros });
    return lista;
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
    const visao = this.visao();
    if (termo.length < 2 && !visao) return null;
    return this.mapa
      .itens()
      .filter((i) => (termo.length < 2 ? true : `${i.nome} ${i.patrimonio ?? ''}`.toLowerCase().includes(termo)))
      .filter((i) => !visao || this.daVisao(i, visao))
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

  daVisao(i: ItemNoLocal, v: Visao): boolean {
    switch (v) {
      case 'em_uso': return i.situacao === 'em_uso';
      case 'guardados': return i.situacao === 'guardado' || i.situacao === 'reservado';
      case 'manutencao': return i.situacao === 'manutencao';
      case 'nao_localizado': return i.situacao === 'nao_localizado';
    }
  }

  /** Clique num indicador: mostra (ou esconde) a lista daquela situação. */
  alternarVisao(v: Visao): void {
    this.visao.update((atual) => (atual === v ? null : v));
    this.busca.set('');
  }

  escolher(id: string | null, rolar = false): void {
    if (!id) return;
    this.selecionado.set(id);
    if (rolar) {
      this.busca.set('');
      this.visao.set(null);
      // Leva a pessoa até a lista da sala (respeita quem prefere menos movimento).
      const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => this.detalhe()?.nativeElement.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' }));
    }
  }

  digitarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
    this.visao.set(null);
  }

  limparBusca(): void {
    this.busca.set('');
    this.visao.set(null);
  }

  /** Inventário por sala (CSV para planilha): prestação de contas e conferência física. */
  exportar(): void {
    const cel = (v: string | number | undefined | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [['Bloco', 'Local', 'Material', 'Patrimônio', 'Quantidade', 'Situação', 'Responsável', 'Pedido', 'Desde']];
    for (const r of this.mapa.locais()) {
      for (const i of r.itens) {
        linhas.push([
          r.local.bloco, r.local.nome, i.nome, i.patrimonio ?? '', i.quantidadeTexto, NOME_SITUACAO[i.situacao],
          i.responsavel?.nome ?? '', i.protocolo ?? '', i.desde ? formatarDataHora(i.desde) : '',
        ]);
      }
    }
    for (const i of this.mapa.itens().filter((x) => !x.localId)) {
      linhas.push(['—', 'Não localizado', i.nome, i.patrimonio ?? '', i.quantidadeTexto, NOME_SITUACAO[i.situacao], i.responsavel?.nome ?? '', i.protocolo ?? '', i.desde ? formatarDataHora(i.desde) : '']);
    }
    const csv = '\uFEFF' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
    baixarArquivo(`inventario-por-sala-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
