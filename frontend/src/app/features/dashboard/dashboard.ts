import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Emprestimo } from '../../core/models/emprestimo.model';
import { AuthService } from '../../core/services/auth.service';
import { EmprestimoService, NOME_STATUS_EMPRESTIMO } from '../../core/services/emprestimo.service';
import { EquipamentoService } from '../../core/services/equipamento.service';
import { InsumoService } from '../../core/services/insumo.service';
import { ManutencaoService } from '../../core/services/manutencao.service';
import { RequisicaoInsumoService } from '../../core/services/requisicao-insumo.service';
import { formatarCodigo } from '../../core/utils/codigo.utils';
import { diferencaEmDias, formatarData, hojeISO, somarDias } from '../../core/utils/date.utils';

/** "1 pedido" · "3 pedidos" */
const n = (q: number, um: string, varios: string): string => `${q} ${q === 1 ? um : varios}`;

/** Uma linha de "O que fazer agora": só aparece quando há algo a fazer. */
interface Tarefa {
  icone: string;
  /** alerta = prazo vencido ou bloqueio; acao = espera alguém; info = só acompanhar */
  tom: 'alerta' | 'acao' | 'info';
  titulo: string;
  detalhe: string;
  rota: string;
  query?: Record<string, string>;
  botao: string;
}

/**
 * PAINEL: em vez de muitos números, mostra O QUE FAZER AGORA (em ordem de urgência), um resumo
 * curto do acervo e as movimentações recentes. Cada linha leva direto para a tela da ação.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly insumos = inject(InsumoService);
  private readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly manutencoes = inject(ManutencaoService);

  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;
  readonly data = formatarData;
  private readonly hoje = hojeISO();

  readonly ehAdmin = computed(() => this.auth.perfilAtual()?.toLowerCase() === 'admin');
  readonly primeiroNome = computed(() => (this.auth.nomeAtual() ?? '').split(' ')[0]);
  readonly dataPorExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  private readonly eu = computed(() => this.auth.usuarioAtual().id);
  private readonly meus = computed(() => this.emprestimos.meusPedidos(this.eu()));
  private readonly atrasados = computed(() =>
    this.emprestimos
      .todas()
      .filter((s) => this.emprestimos.estaAtrasado(s))
      .sort((a, b) => a.dataPrevistaDevolucao.localeCompare(b.dataPrevistaDevolucao)),
  );

  // ---------------- O que fazer agora ----------------
  readonly tarefas = computed<Tarefa[]>(() => (this.ehAdmin() ? this.tarefasCoordenacao() : this.tarefasProfessor()));

  private tarefasCoordenacao(): Tarefa[] {
    const t: Tarefa[] = [];
    const atrasados = this.atrasados();
    if (atrasados.length) {
      const p = atrasados[0];
      t.push({
        icone: 'fa-solid fa-triangle-exclamation', tom: 'alerta',
        titulo: n(atrasados.length, 'devolução atrasada', 'devoluções atrasadas'),
        detalhe: `${this.itens(p)} com ${p.responsavel.nome} · ${n(this.diasDeAtraso(p), 'dia', 'dias')} de atraso`,
        rota: '/admin/emprestimos', botao: 'Ver empréstimos',
      });
    }
    const pend = this.emprestimos.pendentes();
    if (pend.length) {
      t.push({
        icone: 'fa-solid fa-inbox', tom: 'acao',
        titulo: `${n(pend.length, 'pedido', 'pedidos')} de empréstimo para analisar`,
        detalhe: pend.slice(0, 2).map((s) => `${s.solicitante.nome.split(' ')[0]}: ${this.itens(s)}`).join(' · '),
        rota: '/admin/solicitacoes', botao: 'Analisar',
      });
    }
    const req = this.requisicoes.pendentes();
    if (req.length) {
      t.push({
        icone: 'fa-solid fa-box-open', tom: 'acao',
        titulo: `${n(req.length, 'requisição', 'requisições')} de insumo para analisar`,
        detalhe: req.slice(0, 2).map((r) => `${r.solicitante.nome.split(' ')[0]}: ${r.insumo.nome}`).join(' · '),
        rota: '/admin/solicitacoes', query: { aba: 'insumos' }, botao: 'Analisar',
      });
    }
    const retiradas = this.emprestimos.todas().filter((s) => s.status === 'aprovado' && s.dataPrevistaRetirada <= this.hoje);
    const entregas = this.requisicoes.aguardandoEntrega().filter((r) => r.dataUso <= this.hoje);
    if (retiradas.length || entregas.length) {
      t.push({
        icone: 'fa-solid fa-qrcode', tom: 'acao',
        titulo: `${n(retiradas.length + entregas.length, 'atendimento', 'atendimentos')} no balcão hoje`,
        detalhe: [
          retiradas.length ? `${n(retiradas.length, 'retirada', 'retiradas')} de equipamento` : '',
          entregas.length ? `${n(entregas.length, 'entrega', 'entregas')} de insumo` : '',
        ].filter(Boolean).join(' · '),
        rota: '/admin/balcao', botao: 'Abrir balcão',
      });
    }
    const transf = this.emprestimos.todas().filter((s) => !!s.transferenciaPendente).length;
    const avisos = this.emprestimos.avisosNaoLidos();
    if (avisos || transf) {
      t.push({
        icone: 'fa-solid fa-bell', tom: 'info',
        titulo: avisos ? n(avisos, 'movimentação nova', 'movimentações novas') : 'Transferências em andamento',
        detalhe: transf ? `${n(transf, 'transferência', 'transferências')} entre professores aguardando resposta` : 'Retiradas, devoluções e transferências registradas',
        rota: '/admin/emprestimos', botao: 'Ver',
      });
    }
    const manut = this.manutencoes.pendentes();
    if (manut.length) {
      t.push({
        icone: 'fa-solid fa-screwdriver-wrench', tom: 'info',
        titulo: `${n(manut.length, 'ocorrência', 'ocorrências')} de manutenção em aberto`,
        detalhe: manut.slice(0, 2).map((m) => m.equipamento).join(' · '),
        rota: '/admin/manutencao', botao: 'Acompanhar',
      });
    }
    const repor = this.insumos.aRepor();
    if (repor.length) {
      t.push({
        icone: 'fa-solid fa-cart-shopping', tom: 'info',
        titulo: `${n(repor.length, 'insumo', 'insumos')} para repor`,
        detalhe: repor.slice(0, 3).map((i) => i.nome).join(' · '),
        rota: '/admin/inventario/insumos', botao: 'Ver estoque',
      });
    }
    return t;
  }

  private tarefasProfessor(): Tarefa[] {
    const t: Tarefa[] = [];
    const eu = this.eu();
    const meus = this.meus();
    for (const s of meus.filter((x) => this.emprestimos.estaAtrasado(x) && x.responsavel.id === eu)) {
      t.push({
        icone: 'fa-solid fa-triangle-exclamation', tom: 'alerta',
        titulo: `Devolução atrasada: ${this.itens(s)}`,
        detalhe: `Era para ${this.data(s.dataPrevistaDevolucao)}. Devolva no balcão com o código.`,
        rota: `/pedidos/${s.id}`, botao: 'Ver código',
      });
    }
    const recebidas = this.emprestimos.transferenciasRecebidas(eu);
    if (recebidas.length) {
      t.push({
        icone: 'fa-solid fa-right-left', tom: 'acao',
        titulo: `${n(recebidas.length, 'transferência esperando', 'transferências esperando')} a sua resposta`,
        detalhe: recebidas.map((s) => `${s.transferenciaPendente?.de.nome.split(' ')[0]} quer passar: ${this.itens(s)}`).join(' · '),
        rota: '/meus-emprestimos', botao: 'Responder',
      });
    }
    for (const s of meus.filter((x) => x.status === 'aprovado' && x.responsavel.id === eu)) {
      t.push({
        icone: 'fa-solid fa-qrcode', tom: 'acao',
        titulo: `Retire no balcão: ${this.itens(s)}`,
        detalhe: `Mostre o código ${s.codigoRetirada ? formatarCodigo(s.codigoRetirada) : ''} · retirada em ${this.data(s.dataPrevistaRetirada)}`,
        rota: `/pedidos/${s.id}`, botao: 'Ver QR',
      });
    }
    const limite = somarDias(this.hoje, 2);
    for (const s of meus.filter(
      (x) => x.status === 'em_andamento' && x.responsavel.id === eu && !this.emprestimos.estaAtrasado(x) && x.dataPrevistaDevolucao <= limite,
    )) {
      t.push({
        icone: 'fa-solid fa-clock', tom: 'info',
        titulo: `Devolver até ${this.data(s.dataPrevistaDevolucao)}: ${this.itens(s)}`,
        detalhe: 'Se precisar de mais tempo, faça um novo pedido ou transfira a um colega.',
        rota: `/pedidos/${s.id}`, botao: 'Ver código',
      });
    }
    const insumos = this.requisicoes.requisicoes().filter((r) => r.solicitante.id === eu && r.status === 'aprovada');
    if (insumos.length) {
      t.push({
        icone: 'fa-solid fa-box-open', tom: 'acao',
        titulo: `${n(insumos.length, 'insumo aprovado', 'insumos aprovados')} para retirar`,
        detalhe: insumos.map((r) => `${r.insumo.nome} (${r.protocolo})`).join(' · '),
        rota: '/meus-emprestimos', query: { aba: 'insumos' }, botao: 'Ver',
      });
    }
    const aguardando =
      meus.filter((x) => x.status === 'pendente').length +
      this.requisicoes.requisicoes().filter((r) => r.solicitante.id === eu && r.status === 'pendente').length;
    if (aguardando) {
      t.push({
        icone: 'fa-solid fa-hourglass-half', tom: 'info',
        titulo: `${n(aguardando, 'pedido aguardando', 'pedidos aguardando')} a coordenação`,
        detalhe: 'Você recebe o código assim que for aprovado.',
        rota: '/meus-emprestimos', botao: 'Acompanhar',
      });
    }
    return t;
  }

  // ---------------- Resumo ----------------
  readonly unidadesEmUso = computed(() =>
    this.emprestimos.emAndamento().reduce((s, p) => s + p.itens.reduce((q, i) => q + i.quantidade, 0), 0),
  );
  readonly unidadesDisponiveis = this.equipamentos.unidadesDisponiveis;
  readonly unidadesManutencao = this.equipamentos.emManutencao;
  readonly unidadesTotal = computed(() => this.equipamentos.catalogo().reduce((s, e) => s + e.quantidadeTotal, 0));
  readonly percentualEmUso = computed(() =>
    this.unidadesTotal() ? Math.round((this.unidadesEmUso() / this.unidadesTotal()) * 100) : 0,
  );
  readonly meusEmUso = computed(() => this.meus().filter((s) => s.status === 'em_andamento' && s.responsavel.id === this.eu()).length);

  /** Últimos pedidos: todos (coordenação) ou só os do professor. */
  readonly recentes = computed(() => (this.ehAdmin() ? this.emprestimos.todas() : this.meus()).slice(0, 5));

  itens(s: Emprestimo): string {
    return this.emprestimos.resumoItens(s);
  }

  diasDeAtraso(s: Emprestimo): number {
    return Math.max(0, diferencaEmDias(s.dataPrevistaDevolucao, this.hoje));
  }

  statusExibido(s: Emprestimo): string {
    return this.emprestimos.estaAtrasado(s) ? 'atrasado' : s.status;
  }

  nomeStatusExibido(s: Emprestimo): string {
    return this.emprestimos.estaAtrasado(s) ? 'Atrasado' : this.nomeStatus[s.status];
  }
}
