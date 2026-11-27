import { AssistenciaService, formatarCnpj, formatarTelefone } from '../../../core/services/assistencia.service';
import { formatarMoeda } from '../../../core/utils/moeda.utils';
import { AssistenciasCredenciadas } from './assistencias/assistencias-credenciadas';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Manutencao, MotivoBaixa, StatusManutencao } from '../../../core/models/manutencao.model';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import {
  DadosBaixa,
  MOTIVOS_BAIXA,
  ManutencaoService,
  NOME_GRAVIDADE,
  NOME_MOTIVO_BAIXA,
  NOME_STATUS_MANUTENCAO,
  NOME_TIPO_AVARIA,
} from '../../../core/services/manutencao.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarData } from '../../../core/utils/date.utils';
import { AvariaCampos, DadosAvaria } from '../../../shared/components/avaria-campos/avaria-campos';
import { TermoBaixa } from '../../../shared/components/termo-baixa/termo-baixa';
import { DialogoDirective } from '../../../shared/directives/dialogo.directive';

type Filtro = 'pendentes' | 'resolvidas' | 'todas' | 'assistencias';
type Acao = 'assistencia' | 'concluir' | 'baixa';

/**
 * Manutenção: avarias e faltas (extravios) registradas no balcão ou aqui mesmo.
 * Cada ocorrência mostra quem estava com o item. A coordenação manda para conserto,
 * marca como consertada/encontrada (a unidade volta ao estoque) ou dá baixa (sai do acervo).
 */
@Component({
  selector: 'app-admin-manutencao',
  standalone: true,
  imports: [AssistenciasCredenciadas, RouterLink, AvariaCampos, DialogoDirective, TermoBaixa],
  templateUrl: './admin-manutencao.html',
  styleUrl: './admin-manutencao.css',
})
export class AdminManutencao {
  private readonly service = inject(ManutencaoService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly assistencias = inject(AssistenciaService);
  private readonly avisos = inject(NotificationService);

  readonly nomeTipo = NOME_TIPO_AVARIA;
  readonly nomeGravidade = NOME_GRAVIDADE;
  readonly nomeStatus = NOME_STATUS_MANUTENCAO;
  readonly nomeMotivoBaixa = NOME_MOTIVO_BAIXA;
  readonly motivosBaixa = MOTIVOS_BAIXA;
  readonly data = (iso: string) => formatarData(iso.slice(0, 10));

  readonly filtro = signal<Filtro>('pendentes');

  readonly pendentes = this.service.pendentes;
  readonly resolvidas = computed(() =>
    this.service.todas().filter((m) => m.status === 'concluida' || m.status === 'baixa'),
  );
  readonly lista = computed(() => {
    const f = this.filtro();
    return f === 'pendentes' ? this.pendentes() : f === 'resolvidas' ? this.resolvidas() : this.service.todas();
  });

  // Indicadores
  readonly unidadesBloqueadas = computed(() => this.pendentes().reduce((s, m) => s + m.quantidade, 0));
  readonly emConserto = computed(() => this.pendentes().filter((m) => m.status === 'em_assistencia').length);
  readonly faltasAbertas = computed(() =>
    this.pendentes().filter((m) => m.tipo === 'extravio').reduce((s, m) => s + m.quantidade, 0),
  );
  readonly totalResolvidas = computed(() => this.resolvidas().length);

  // Diálogo de ação (conserto, conclusão ou baixa)
  readonly acao = signal<{ tipo: Acao; alvo: Manutencao } | null>(null);
  readonly textoAcao = signal('');
  readonly erroAcao = signal('');
  /** Quantas e quais unidades estão sendo consertadas/encontradas ou baixadas (pode ser só parte). */
  readonly qtdAcao = signal(1);
  readonly identAcao = signal('');
  /** true quando nem todas as unidades da ocorrência estão sendo resolvidas. */
  readonly parcial = computed(() => {
    const a = this.acao();
    return !!a && this.qtdAcao() < a.alvo.quantidade;
  });

  /** Formulário da baixa (auditoria): tudo vai para o termo. */
  readonly baixa = signal<DadosBaixa>(this.baixaVazia());
  /** Ocorrência cujo termo de baixa está aberto. */
  readonly termoAberto = signal<Manutencao | null>(null);

  // Foto ampliada
  readonly fotoAberta = signal<string | null>(null);

  // Registro direto (item encontrado com problema no laboratório)
  readonly registrando = signal(false);
  readonly novoEquipamentoId = signal('');
  readonly novaQuantidade = signal(1);
  readonly novaAvaria = signal<DadosAvaria>({});
  readonly erroNovo = signal('');
  /** Só dá para registrar em unidade que está no laboratório (disponível). */
  readonly opcoesEquipamento = computed(() =>
    this.equipamentos.catalogo().filter((e) => e.quantidadeDisponivel > 0),
  );
  readonly maximoNovo = computed(
    () => this.equipamentos.buscarPorId(this.novoEquipamentoId())?.quantidadeDisponivel ?? 1,
  );

  foto(m: Manutencao): string | undefined {
    return m.temFoto ? this.service.foto(m.id) : undefined;
  }

  pendente(m: Manutencao): boolean {
    return m.status === 'aberta' || m.status === 'em_assistencia';
  }

  /** Classe de cor do selo: grave/moderada/leve para avaria e "falta" para extravio. */
  selo(m: Manutencao): string {
    return m.tipo === 'extravio' ? 'falta' : (m.gravidade ?? 'moderada');
  }

  rotuloSelo(m: Manutencao): string {
    return m.tipo === 'extravio' ? 'Falta' : `Avaria ${NOME_GRAVIDADE[m.gravidade ?? 'moderada'].toLowerCase()}`;
  }

  corStatus(s: StatusManutencao): string {
    return s;
  }

  disponibilidade(m: Manutencao): string {
    const e = this.equipamentos.buscarPorId(m.equipamentoId);
    if (!e) return '';
    const est = this.equipamentos.estoque(e);
    return `${est.disponiveis} de ${est.total} disponíveis` + (est.emManutencao ? ` · ${est.emManutencao} em manutenção` : '');
  }

  // ---------- Ações ----------

  /** Assistências que podem receber o equipamento do diálogo aberto. */
  readonly opcoesAssistencia = computed(() => {
    const a = this.acao();
    return a?.tipo === 'assistencia' ? this.service.assistenciasPara(a.alvo) : [];
  });
  readonly assistenciaEscolhida = signal('');
  readonly cnpj = formatarCnpj;
  readonly telefone = formatarTelefone;
  readonly moeda = formatarMoeda;

  /** Valor que vai para o termo de baixa (calculado do cadastro; ninguém digita). */
  valorBaixa(m: Manutencao): number | undefined {
    return this.service.valorDaBaixa(m, this.qtdAcao());
  }

  valorUnitario(m: Manutencao): number | undefined {
    return this.equipamentos.buscarPorId(m.equipamentoId)?.valorUnitario;
  }

  /** Telefone da assistência que está com o equipamento (mostrado na ocorrência). */
  contatoAssistencia(m: Manutencao): string {
    const a = m.assistenciaId ? this.assistencias.buscarPorId(m.assistenciaId) : undefined;
    return a ? `${formatarTelefone(a.telefone)} · ${a.email}` : '';
  }

  abrirAcao(tipo: Acao, alvo: Manutencao): void {
    this.textoAcao.set('');
    this.qtdAcao.set(alvo.quantidade);
    this.identAcao.set('');
    if (tipo === 'assistencia') {
      const opcoes = this.service.assistenciasPara(alvo);
      this.assistenciaEscolhida.set(opcoes.length === 1 ? opcoes[0].id : '');
    }
    this.baixa.set(this.baixaVazia(alvo));
    this.erroAcao.set('');
    this.acao.set({ tipo, alvo });
  }

  fecharAcao(): void {
    this.acao.set(null);
  }

  /** "1 unidade" / "2 unidades". */
  un(n: number): string {
    return n === 1 ? '1 unidade' : `${n} unidades`;
  }

  rotuloQtd(): string {
    const a = this.acao();
    if (a?.tipo === 'baixa') return 'Quantas recebem baixa';
    return a?.alvo.tipo === 'extravio' ? 'Quantas foram encontradas' : 'Quantas foram consertadas';
  }

  mudarQtdAcao(delta: number): void {
    const max = this.acao()?.alvo.quantidade ?? 1;
    this.qtdAcao.update((q) => Math.max(1, Math.min(max, q + delta)));
    this.erroAcao.set('');
  }

  escreverIdent(evento: Event): void {
    this.identAcao.set((evento.target as HTMLInputElement).value);
    this.erroAcao.set('');
  }

  escreverAcao(evento: Event): void {
    this.textoAcao.set((evento.target as HTMLInputElement | HTMLTextAreaElement).value);
    this.erroAcao.set('');
  }

  confirmarAcao(): void {
    const a = this.acao();
    if (!a) return;
    const { tipo, alvo } = a;
    const unidades = { quantidade: this.qtdAcao(), identificacao: this.identAcao() };
    const q = unidades.quantidade;
    const resto = alvo.quantidade - q;
    const ficam = resto > 0 ? ` ${this.un(resto)} ${resto === 1 ? 'continua' : 'continuam'} em manutenção.` : '';
    const erro =
      tipo === 'assistencia'
        ? this.service.enviarParaAssistencia(alvo.id, this.assistenciaEscolhida())
        : tipo === 'concluir'
          ? this.service.concluir(alvo.id, this.textoAcao(), unidades)
          : this.service.darBaixa(alvo.id, { ...this.baixa(), ...unidades });
    if (erro) {
      this.erroAcao.set(erro);
      return;
    }
    this.acao.set(null);
    if (tipo === 'assistencia') {
      this.avisos.info(`${alvo.protocolo}: ${alvo.equipamento} enviado para conserto.`);
    } else if (tipo === 'concluir') {
      this.avisos.sucesso(`${alvo.equipamento}: ${this.un(q)} de volta ao estoque.${ficam}`);
    } else {
      // Com baixa parcial o termo fica na ocorrência nova (a mais recente com baixa).
      const termo = this.service.baixas()[0];
      this.avisos.aviso(
        `${alvo.equipamento}: baixa de ${this.un(q)}. Termo ${termo?.baixa?.protocolo ?? ''} gerado.${ficam}`,
        8000,
      );
      if (termo) this.termoAberto.set(termo);
    }
  }

  mudarBaixa<K extends keyof DadosBaixa>(campo: K, valor: DadosBaixa[K]): void {
    this.erroAcao.set('');
    this.baixa.update((b) => ({ ...b, [campo]: valor }));
  }

  valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  private baixaVazia(alvo?: Manutencao): DadosBaixa {
    const motivos = alvo ? MOTIVOS_BAIXA[alvo.tipo] : [];
    return {
      motivo: motivos.length === 1 ? (motivos[0] as MotivoBaixa) : undefined,
      parecer: '',
      laudo: '',
      processo: '',
      responsavelCiente: false,
      testemunha: '',
      confirmacaoPatrimonio: '',
    };
  }

  // ---------- Registro direto ----------

  abrirRegistro(): void {
    const primeiro = this.opcoesEquipamento()[0];
    this.novoEquipamentoId.set(primeiro?.id ?? '');
    this.novaQuantidade.set(1);
    this.novaAvaria.set({});
    this.erroNovo.set('');
    this.registrando.set(true);
  }

  escolherEquipamento(evento: Event): void {
    this.novoEquipamentoId.set((evento.target as HTMLSelectElement).value);
    this.novaQuantidade.set(1);
  }

  mudarQuantidadeNova(delta: number): void {
    this.novaQuantidade.update((q) => Math.max(1, Math.min(this.maximoNovo(), q + delta)));
  }

  mudarNovaAvaria(mudanca: Partial<DadosAvaria>): void {
    this.novaAvaria.update((a) => ({ ...a, ...mudanca }));
    this.erroNovo.set('');
  }

  salvarRegistro(): void {
    const eq = this.equipamentos.buscarPorId(this.novoEquipamentoId());
    if (!eq) {
      this.erroNovo.set('Escolha o equipamento.');
      return;
    }
    const a = this.novaAvaria();
    const dados = {
      tipo: 'avaria' as const,
      quantidade: this.novaQuantidade(),
      tipoAvaria: a.tipoAvaria,
      gravidade: a.gravidade,
      descricao: a.descricao ?? '',
    };
    const erro = this.service.validar(dados, eq.nome);
    if (erro) {
      this.erroNovo.set(erro);
      return;
    }
    if (dados.quantidade > eq.quantidadeDisponivel) {
      this.erroNovo.set(`Só há ${eq.quantidadeDisponivel} unidade(s) de "${eq.nome}" no laboratório.`);
      return;
    }
    const m = this.service.registrar({ ...dados, equipamentoId: eq.id, foto: a.foto, origem: 'estoque' });
    this.registrando.set(false);
    this.filtro.set(m.bloqueia ? 'pendentes' : 'todas');
    this.avisos.sucesso(
      m.bloqueia
        ? `${m.protocolo} registrada: ${eq.nome} bloqueado para empréstimo.`
        : `${m.protocolo} registrada (avaria leve): ${eq.nome} continua disponível.`,
    );
  }
}
