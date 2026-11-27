import { ActivatedRoute } from '@angular/router';
import { RequisicaoInsumoService } from '../../../core/services/requisicao-insumo.service';
import { RequisicoesInsumo } from './requisicoes/requisicoes-insumo';
import { Component, computed, inject, signal } from '@angular/core';
import { LOCAIS_DE_USO, nomeLocal } from '../../../core/constants/escola-modelo.constants';
import {
  CategoriaInsumo,
  Insumo,
  MotivoMovimentacao,
  TipoMovimentacao,
  UnidadeMedida,
} from '../../../core/models/insumo.model';
import {
  InsumoService,
  MOTIVOS_ENTRADA,
  MOTIVOS_SAIDA,
  MovimentacaoDemo,
  NOME_CATEGORIA_INSUMO,
  NOME_MOTIVO_INSUMO,
  NOME_UNIDADE,
  formatarQuantidade,
} from '../../../core/services/insumo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { baixarArquivo } from '../../../core/utils/arquivo.utils';
import { formatarData, formatarDataHora } from '../../../core/utils/date.utils';
import { DialogoDirective } from '../../../shared/directives/dialogo.directive';

type Aba = 'estoque' | 'requisicoes' | 'movimentacoes' | 'consumo';
const ABAS: Aba[] = ['estoque', 'requisicoes', 'movimentacoes', 'consumo'];

interface FormInsumo {
  nome: string;
  descricao: string;
  categoria: CategoriaInsumo;
  unidadeMedida: UnidadeMedida;
  estoqueMinimo: number;
  quantidadeInicial: number;
  fornecedor: string;
  validade: string;
  localizacao: string;
}

interface FormMovimentacao {
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  observacao: string;
  destinatarioId: string;
  localId: string;
  documento: string;
  validadeLote: string;
}

const FORM_VAZIO: FormInsumo = {
  nome: '', descricao: '', categoria: 'eletronica', unidadeMedida: 'un', estoqueMinimo: 1,
  quantidadeInicial: 0, fornecedor: '', validade: '', localizacao: '',
};

/**
 * INSUMOS: materiais de consumo (filamento, solda, papel...). A coordenação acompanha o saldo,
 * registra entradas (compra, doação) e saídas (uso em aula com professor, local e finalidade;
 * perda; vencimento) e vê quando cada item deve acabar. Tudo fica no histórico (auditoria).
 *
 * Nesta versão os dados são os da demonstração (InsumoService). O card D8 liga a tela à API.
 */
@Component({
  selector: 'app-admin-insumos',
  standalone: true,
  imports: [DialogoDirective, RequisicoesInsumo],
  templateUrl: './admin-insumos.html',
  styleUrl: './admin-insumos.css',
})
export class AdminInsumos {
  readonly service = inject(InsumoService);
  readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly usuarios = inject(UsuarioService);
  private readonly avisos = inject(NotificationService);

  readonly nomeCategoria = NOME_CATEGORIA_INSUMO;
  readonly nomeUnidade = NOME_UNIDADE;
  readonly nomeMotivo = NOME_MOTIVO_INSUMO;
  readonly categorias = Object.keys(NOME_CATEGORIA_INSUMO) as CategoriaInsumo[];
  readonly unidades = Object.keys(NOME_UNIDADE) as UnidadeMedida[];
  readonly locaisDeUso = LOCAIS_DE_USO;
  readonly qtd = formatarQuantidade;
  readonly data = formatarData;
  readonly dataHora = formatarDataHora;
  readonly local = nomeLocal;

  /** Aba inicial pode vir do link (?aba=requisicoes), por exemplo do painel. */
  readonly aba = signal<Aba>(
    ((a) => (ABAS.includes(a as Aba) ? (a as Aba) : 'estoque'))(inject(ActivatedRoute).snapshot.queryParamMap.get('aba')),
  );

  // ---------- Estoque ----------
  readonly busca = signal('');
  readonly categoria = signal<CategoriaInsumo | ''>('');
  readonly soARepor = signal(false);
  readonly mostrarInativos = signal(false);

  readonly lista = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return this.service
      .insumos()
      .filter((i) => this.mostrarInativos() || i.ativo)
      .filter((i) => !this.categoria() || i.categoria === this.categoria())
      .filter((i) => !this.soARepor() || (i.ativo && i.quantidadeAtual <= i.estoqueMinimo))
      .filter((i) => !termo || `${i.nome} ${i.fornecedor ?? ''} ${i.localizacao ?? ''}`.toLowerCase().includes(termo))
      .sort((a, b) => this.urgencia(a) - this.urgencia(b) || a.nome.localeCompare(b.nome));
  });

  // Indicadores
  readonly totalAtivos = computed(() => this.service.ativos().length);
  readonly totalARepor = computed(() => this.service.aRepor().length);
  readonly proximoAcabar = computed(() => this.service.relatorio(30).find((c) => c.diasRestantes !== null) ?? null);

  // ---------- Movimentações ----------
  readonly filtroInsumo = signal('');
  readonly filtroTipo = signal<TipoMovimentacao | ''>('');
  readonly movimentacoes = computed(() =>
    this.service
      .movimentacoes()
      .filter((m) => !this.filtroInsumo() || m.insumo.id === this.filtroInsumo())
      .filter((m) => !this.filtroTipo() || m.tipo === this.filtroTipo()),
  );

  // ---------- Consumo ----------
  readonly periodo = signal(30);
  readonly relatorio = computed(() => this.service.relatorio(this.periodo()));
  readonly maiorConsumo = computed(() => Math.max(1, ...this.relatorio().map((c) => c.totalConsumido)));

  // ---------- Diálogos ----------
  readonly editando = signal<{ id: string | null; form: FormInsumo } | null>(null);
  readonly movimentando = signal<{ insumo: Insumo; form: FormMovimentacao } | null>(null);
  readonly erroDialogo = signal('');

  readonly professores = computed(() =>
    this.usuarios.ativos().filter((u) => u.perfil === 'usuario').map((u) => ({ id: u.id, nome: u.nome })),
  );

  // ---------- Apresentação ----------

  /** 0 = esgotado, 1 = a repor, 2 = ok, 9 = inativo (ordem da lista). */
  urgencia(i: Insumo): number {
    if (!i.ativo) return 9;
    if (i.quantidadeAtual <= 0) return 0;
    if (i.quantidadeAtual <= i.estoqueMinimo) return 1;
    return 2;
  }

  /** Largura da barra de saldo: 100% = o dobro do mínimo (ou o saldo, se for maior). */
  barra(i: Insumo): number {
    const referencia = Math.max(i.estoqueMinimo * 2, i.quantidadeAtual, 1);
    return Math.round((i.quantidadeAtual / referencia) * 100);
  }

  marcaMinimo(i: Insumo): number {
    const referencia = Math.max(i.estoqueMinimo * 2, i.quantidadeAtual, 1);
    return Math.round((i.estoqueMinimo / referencia) * 100);
  }

  previsao(i: Insumo): string {
    if (!i.ativo) return 'Inativo';
    if (i.quantidadeAtual <= 0) return 'Esgotado';
    const c = this.service.consumo(i, 30);
    if (c.diasRestantes === null) return 'Sem consumo nos últimos 30 dias';
    if (c.diasRestantes === 0) return 'Acaba hoje no ritmo atual';
    return `Acaba em ~${c.diasRestantes} dia(s) · ${this.data(c.previsaoDeTermino)}`;
  }

  validade(i: Insumo): string | null {
    const dias = this.service.diasParaVencer(i);
    if (dias === null) return null;
    if (dias < 0) return `Vencido em ${this.data(i.validade)}`;
    if (dias <= 30) return `Vence em ${dias} dia(s)`;
    return null;
  }

  motivosDe(tipo: TipoMovimentacao): MotivoMovimentacao[] {
    return tipo === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SAIDA;
  }

  detalheMov(m: MovimentacaoDemo): string {
    return [
      m.destinatario ? `para ${m.destinatario.nome}` : '',
      m.localId ? `em ${nomeLocal(m.localId)}` : '',
      m.observacao ?? '',
      m.documento ? `doc. ${m.documento}` : '',
      m.validadeLote ? `validade ${this.data(m.validadeLote)}` : '',
    ].filter(Boolean).join(' · ');
  }

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  numero(evento: Event): number {
    const v = (evento.target as HTMLInputElement).value.replace(',', '.');
    return v === '' ? Number.NaN : Number(v);
  }

  verHistorico(i: Insumo): void {
    this.filtroInsumo.set(i.id);
    this.filtroTipo.set('');
    this.aba.set('movimentacoes');
  }

  // ---------- Cadastro ----------

  novo(): void {
    this.erroDialogo.set('');
    this.editando.set({ id: null, form: { ...FORM_VAZIO } });
  }

  editar(i: Insumo): void {
    this.erroDialogo.set('');
    this.editando.set({
      id: i.id,
      form: {
        nome: i.nome, descricao: i.descricao ?? '', categoria: i.categoria, unidadeMedida: i.unidadeMedida,
        estoqueMinimo: i.estoqueMinimo, quantidadeInicial: 0, fornecedor: i.fornecedor ?? '',
        validade: i.validade ?? '', localizacao: i.localizacao ?? '',
      },
    });
  }

  mudarForm<K extends keyof FormInsumo>(campo: K, valor: FormInsumo[K]): void {
    this.erroDialogo.set('');
    this.editando.update((e) => (e ? { ...e, form: { ...e.form, [campo]: valor } } : e));
  }

  salvarCadastro(): void {
    const e = this.editando();
    if (!e) return;
    const f = e.form;
    const dto = {
      nome: f.nome, descricao: f.descricao, categoria: f.categoria, unidadeMedida: f.unidadeMedida,
      estoqueMinimo: f.estoqueMinimo, fornecedor: f.fornecedor, validade: f.validade || undefined,
      localizacao: f.localizacao, quantidadeInicial: e.id ? undefined : f.quantidadeInicial || 0,
    };
    if (e.id) {
      const erro = this.service.atualizar(e.id, dto);
      if (erro) {
        this.erroDialogo.set(erro);
        return;
      }
      this.avisos.sucesso(`${f.nome.trim()} atualizado.`);
    } else {
      const r = this.service.cadastrar(dto);
      if (!r.ok) {
        this.erroDialogo.set(r.erro);
        return;
      }
      this.avisos.sucesso(
        `${r.valor.nome} cadastrado com saldo de ${this.qtd(r.valor.quantidadeAtual)} ${NOME_UNIDADE[r.valor.unidadeMedida]}.`,
      );
    }
    this.editando.set(null);
  }

  alternarAtivo(i: Insumo): void {
    this.service.alternarAtivo(i.id);
    this.avisos.info(i.ativo ? `${i.nome} desativado: sai da lista de estoque.` : `${i.nome} reativado.`);
  }

  // ---------- Movimentação ----------

  movimentar(insumo: Insumo, tipo: TipoMovimentacao): void {
    this.erroDialogo.set('');
    this.movimentando.set({
      insumo,
      form: {
        tipo, motivo: tipo === 'entrada' ? 'compra' : 'uso_em_aula', quantidade: 1, observacao: '',
        destinatarioId: '', localId: '', documento: '', validadeLote: '',
      },
    });
  }

  mudarMov<K extends keyof FormMovimentacao>(campo: K, valor: FormMovimentacao[K]): void {
    this.erroDialogo.set('');
    this.movimentando.update((m) => (m ? { ...m, form: { ...m.form, [campo]: valor } } : m));
  }

  /** Saldo que ficará depois da movimentação (prévia no diálogo). */
  saldoPrevisto(m: { insumo: Insumo; form: FormMovimentacao }): number {
    const q = Number.isFinite(m.form.quantidade) ? m.form.quantidade : 0;
    return Math.round((m.insumo.quantidadeAtual + (m.form.tipo === 'entrada' ? q : -q)) * 1000) / 1000;
  }

  salvarMovimentacao(): void {
    const m = this.movimentando();
    if (!m) return;
    const f = m.form;
    const r = this.service.movimentar(m.insumo.id, {
      tipo: f.tipo, motivo: f.motivo, quantidade: f.quantidade, observacao: f.observacao,
      destinatarioId: f.destinatarioId || undefined, localId: f.localId || undefined,
      documento: f.documento, validadeLote: f.validadeLote || undefined,
    });
    if (!r.ok) {
      this.erroDialogo.set(r.erro);
      return;
    }
    const { insumo, alertaEstoqueBaixo } = r.valor;
    const texto = `${f.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada: ${this.qtd(f.quantidade)} ${NOME_UNIDADE[insumo.unidadeMedida]} de ${insumo.nome}. Saldo: ${this.qtd(insumo.quantidadeAtual)}.`;
    if (alertaEstoqueBaixo) {
      this.avisos.aviso(`${texto} Chegou ao estoque mínimo: providencie a reposição.`, 8000);
    } else {
      this.avisos.sucesso(texto);
    }
    this.movimentando.set(null);
  }

  exportarMovimentacoes(): void {
    const celula = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = this.movimentacoes().map((m) =>
      [
        this.dataHora(m.ocorridaEm), m.insumo.nome, m.tipo === 'entrada' ? 'Entrada' : 'Saída', NOME_MOTIVO_INSUMO[m.motivo],
        this.qtd(m.quantidade), NOME_UNIDADE[m.insumo.unidadeMedida], this.qtd(m.saldoApos), m.responsavel.nome,
        m.destinatario?.nome, m.localId ? nomeLocal(m.localId) : '', m.observacao, m.documento,
      ].map(celula).join(';'),
    );
    const cabecalho = ['Data e hora', 'Insumo', 'Tipo', 'Motivo', 'Quantidade', 'Unidade', 'Saldo após', 'Registrado por', 'Recebido por', 'Local', 'Observação', 'Documento'];
    baixarArquivo('fab-movimentacoes-insumos.csv', '﻿' + [cabecalho.map(celula).join(';'), ...linhas].join('\r\n'));
  }
}
