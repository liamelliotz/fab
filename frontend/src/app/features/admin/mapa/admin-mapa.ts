import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LOCAIS_ESCOLA,
  LocalEscola,
  NOME_ESCOLA_MODELO,
  buscarLocal,
} from '../../../core/constants/escola-modelo.constants';
import { AuthService } from '../../../core/services/auth.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { ItemNoLocal, MapaService, ResumoLocal, SituacaoNoLocal } from '../../../core/services/mapa.service';
import { formatarDataHora } from '../../../core/utils/date.utils';

type Camada = 'tudo' | 'em_uso' | 'guardado' | 'manutencao' | 'insumo';

export const NOME_SITUACAO: Record<SituacaoNoLocal, string> = {
  guardado: 'Guardado',
  reservado: 'Reservado para retirada',
  em_uso: 'Em uso',
  manutencao: 'Em manutenção',
  nao_localizado: 'Não localizado',
  inativo: 'Inativo',
  insumo: 'Insumo',
};

/**
 * MAPA DE ITENS: a planta da escola fictícia com o que está em cada sala agora.
 * Tudo vem dos registros (pedido, balcão, transferência, manutenção e insumos): para mudar o que
 * aparece aqui é preciso registrar o movimento, nunca editar o mapa.
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

  readonly camada = signal<Camada>('tudo');
  readonly camadas: { id: Camada; nome: string; icone: string }[] = [
    { id: 'tudo', nome: 'Tudo', icone: 'fa-layer-group' },
    { id: 'em_uso', nome: 'Em uso', icone: 'fa-person-chalkboard' },
    { id: 'guardado', nome: 'Guardados', icone: 'fa-warehouse' },
    { id: 'manutencao', nome: 'Manutenção', icone: 'fa-screwdriver-wrench' },
    { id: 'insumo', nome: 'Insumos', icone: 'fa-boxes-stacked' },
  ];
  readonly selecionado = signal<string>('lab-maker');
  readonly busca = signal('');
  readonly equipamentoBuscado = signal('');

  /** Locais desenhados na planta (sem o externo). */
  readonly planta = computed(() => this.mapa.locais().filter((r) => r.local.tipo !== 'externo'));
  readonly assistencia = computed(() => this.mapa.locais().find((r) => r.local.id === 'assistencia')!);
  readonly semLocal = this.mapa.semLocal;
  readonly movimentos = this.mapa.movimentos;

  readonly totais = computed(() => {
    const itens = this.mapa.itens();
    const soma = (f: (i: ItemNoLocal) => boolean) => itens.filter(f).reduce((s, i) => s + i.quantidade, 0);
    return {
      emUso: soma((i) => i.situacao === 'em_uso'),
      guardados: soma((i) => i.situacao === 'guardado' || i.situacao === 'reservado'),
      manutencao: soma((i) => i.situacao === 'manutencao'),
      naoLocalizados: soma((i) => i.situacao === 'nao_localizado'),
      locaisEmUso: new Set(itens.filter((i) => i.situacao === 'em_uso' && i.localId).map((i) => i.localId)).size,
    };
  });

  readonly resumoSelecionado = computed(() => this.mapa.locais().find((r) => r.local.id === this.selecionado()) ?? null);

  /** Itens do local escolhido, filtrados pela camada e agrupados em ordem de importância. */
  readonly itensSelecionados = computed(() => {
    const r = this.resumoSelecionado();
    if (!r) return [];
    const ordem: SituacaoNoLocal[] = ['em_uso', 'reservado', 'manutencao', 'guardado', 'inativo', 'insumo'];
    return r.itens
      .filter((i) => this.passaNaCamada(i))
      .sort((a, b) => ordem.indexOf(a.situacao) - ordem.indexOf(b.situacao) || a.nome.localeCompare(b.nome));
  });

  // "Onde está?"
  readonly opcoesBusca = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    if (termo.length < 2) return [];
    return this.equipamentos
      .itens()
      .filter((e) => `${e.nome} ${e.codigoPatrimonio}`.toLowerCase().includes(termo))
      .slice(0, 6);
  });
  readonly resultadoBusca = computed(() => {
    const id = this.equipamentoBuscado();
    if (!id) return null;
    const e = this.equipamentos.buscarPorId(id);
    if (!e) return null;
    return { equipamento: e, onde: this.mapa.ondeEsta(id) };
  });
  /** Locais destacados na planta pela busca. */
  readonly destacados = computed(() => new Set(this.resultadoBusca()?.onde.map((i) => i.localId) ?? []));

  passaNaCamada(i: ItemNoLocal): boolean {
    switch (this.camada()) {
      case 'tudo': return true;
      case 'em_uso': return i.situacao === 'em_uso';
      case 'guardado': return i.situacao === 'guardado' || i.situacao === 'reservado' || i.situacao === 'inativo';
      case 'manutencao': return i.situacao === 'manutencao' || i.situacao === 'nao_localizado';
      case 'insumo': return i.situacao === 'insumo';
    }
  }

  /** Número grande mostrado na sala, conforme a camada escolhida. */
  numeroDaSala(r: ResumoLocal): number {
    switch (this.camada()) {
      case 'em_uso': return r.emUso;
      case 'guardado': return r.guardados;
      case 'manutencao': return r.manutencao;
      case 'insumo': return r.insumos;
      default: return r.emUso + r.guardados + r.manutencao;
    }
  }

  /** Classe de cor da sala: em uso (azul), atraso (vermelho), manutenção (âmbar), guardado (verde). */
  tom(r: ResumoLocal): string {
    const c = this.camada();
    if (c === 'insumo') return r.insumos ? 'insumo' : 'vazio';
    if (c === 'manutencao') return r.manutencao ? 'manutencao' : 'vazio';
    if (c === 'guardado') return r.guardados ? 'guardado' : 'vazio';
    if (r.atrasados) return 'atraso';
    if (r.emUso) return 'uso';
    if (c === 'em_uso') return 'vazio';
    if (r.manutencao) return 'manutencao';
    if (r.guardados) return 'guardado';
    return r.insumos ? 'insumo' : 'vazio';
  }

  rotuloSala(r: ResumoLocal): string {
    const partes = [
      r.emUso ? `${r.emUso} em uso` : '',
      r.guardados ? `${r.guardados} guardado(s)` : '',
      r.manutencao ? `${r.manutencao} em manutenção` : '',
      r.insumos ? `${r.insumos} insumo(s)` : '',
      r.atrasados ? `${r.atrasados} com atraso` : '',
    ].filter(Boolean);
    return `${r.local.nome}: ${partes.length ? partes.join(', ') : 'nenhum item'}`;
  }

  escolher(local: LocalEscola | string): void {
    this.selecionado.set(typeof local === 'string' ? local : local.id);
  }

  aoTeclar(evento: KeyboardEvent, local: LocalEscola): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      this.escolher(local);
    }
  }

  digitarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
    this.equipamentoBuscado.set('');
  }

  buscarEquipamento(id: string): void {
    this.equipamentoBuscado.set(id);
    const e = this.equipamentos.buscarPorId(id);
    this.busca.set(e?.nome ?? '');
    const primeiro = this.mapa.ondeEsta(id).find((i) => i.localId);
    if (primeiro?.localId) this.selecionado.set(primeiro.localId);
  }

  limparBusca(): void {
    this.busca.set('');
    this.equipamentoBuscado.set('');
  }

  nomeDoLocal(id: string | null): string {
    return id ? (buscarLocal(id)?.nome ?? 'Local desconhecido') : 'Sem local na planta';
  }

  /** Blocos para os rótulos da planta. */
  readonly blocos = [
    { nome: 'Bloco A · Salas de aula', y: 40 },
    { nome: 'Bloco B · Laboratórios', y: 226 },
    { nome: 'Bloco C · Administração', y: 430 },
  ];
  readonly locais = LOCAIS_ESCOLA;
}
