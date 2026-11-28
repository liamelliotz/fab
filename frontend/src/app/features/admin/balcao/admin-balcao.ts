import { LeitorQr } from '../../../shared/components/leitor-qr/leitor-qr';
import { CodigoInsumo, RequisicaoInsumoService, aceitaFracao } from '../../../core/services/requisicao-insumo.service';
import { Component, DestroyRef, Injector, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { nomeLocal } from '../../../core/constants/escola-modelo.constants';
import { InsumoService, NOME_UNIDADE, formatarQuantidade } from '../../../core/services/insumo.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { LOCAIS_DE_USO } from '../../../core/constants/escola-modelo.constants';
import { Emprestimo, ItemEmprestimo } from '../../../core/models/emprestimo.model';
import { RegistroAvariaDTO } from '../../../core/models/manutencao.model';
import {
  EmprestimoAdminService,
  mensagemErroAdmin,
} from '../../../core/services/emprestimo-admin.service';
import { EmprestimoService, OpcoesDevolucao, descreverLocalUso } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { NotificationService } from '../../../core/services/notification.service';
import { normalizarCodigo } from '../../../core/utils/codigo.utils';
import { formatarData } from '../../../core/utils/date.utils';
import { AvariaCampos, DadosAvaria } from '../../../shared/components/avaria-campos/avaria-campos';

type Aba = 'retirada' | 'devolucao';

/**
 * Balcão da coordenação: entrega e recebe o material usando o código (digitado, ditado ou lido
 * do QR por um leitor USB, que "digita" o conteúdo e dá Enter).
 * O código prova que a pessoa que está no balcão é quem recebeu a aprovação.
 * Não existe registro sem código: as listas abaixo só mostram o que está esperando.
 *
 * Toda operação passa pelo EmprestimoAdminService, que fala com a API ou, no modo demonstração,
 * com os dados do navegador. Na devolução, cada item pode voltar com avaria ou faltando.
 */
@Component({
  selector: 'app-admin-balcao',
  standalone: true,
  imports: [RouterLink, AvariaCampos, LeitorQr],
  templateUrl: './admin-balcao.html',
  styleUrl: './admin-balcao.css',
})
export class AdminBalcao {
  readonly service = inject(EmprestimoAdminService);
  private readonly notificacoes = inject(NotificationService);
  /** Requisições de insumo: retirada e sobra também passam por este balcão, com código. */
  readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly insumos = inject(InsumoService);
  private readonly rota = inject(ActivatedRoute);
  readonly insumosParaEntregar = computed(() => this.requisicoes.aguardandoEntrega());
  readonly sobrasParaReceber = computed(() => this.requisicoes.aguardandoSobra());
  readonly nomeUnidade = NOME_UNIDADE;
  readonly qtd = formatarQuantidade;
  readonly nomeLocal = nomeLocal;

  /** Requisição de insumo encontrada pelo código (em vez de um empréstimo). */
  readonly alvoInsumo = signal<CodigoInsumo | null>(null);
  /** Quantidade entregue (retirada) ou sobra (devolução), como texto do campo. */
  readonly qtdInsumo = signal('');
  /** Devolução de insumo: true = usou tudo (nada volta). */
  readonly usouTudo = signal(false);

  /** Máximo que dá para entregar agora: o aprovado, limitado ao saldo do estoque. */
  readonly maximoEntrega = computed(() => {
    const a = this.alvoInsumo();
    if (!a) return 0;
    const saldo = this.insumos.buscarPorId(a.req.insumo.id)?.quantidadeAtual ?? 0;
    return Math.min(a.req.quantidade, saldo);
  });
  private readonly equipamentos = inject(EquipamentoService);
  private readonly injector = inject(Injector);
  private readonly destroy = inject(DestroyRef);
  private consulta?: Subscription;
  /** Código que o servidor já conferiu. A confirmação usa este, não o que está no campo agora. */
  private codigoConferido = '';

  readonly data = formatarData;
  readonly locais = LOCAIS_DE_USO;
  readonly descreverLocal = descreverLocalUso;

  readonly aba = signal<Aba>('retirada');
  readonly codigo = signal('');
  readonly erro = signal('');
  readonly consultando = signal(false);
  readonly salvando = signal(false);

  /** Pedido encontrado pelo código, aguardando a confirmação. */
  readonly alvo = signal<Emprestimo | null>(null);

  // Conferência da retirada: onde o material vai ser usado e o termo de responsabilidade
  readonly localUsoId = signal('');
  readonly localUsoDetalhe = signal('');
  readonly termoAceito = signal(false);

  // Conferência da devolução
  /** false = tudo em ordem; true = abre o registro de avaria/falta por item. */
  readonly comProblema = signal(false);
  /** Avarias e faltas por equipamento do pedido (chave = equipamentoId). */
  readonly registros = signal<Record<string, RegistroAvariaDTO>>({});
  readonly observacoes = signal('');

  /** Só os itens com avaria ou falta de verdade (quantidade maior que zero). */
  readonly ocorrencias = computed(() =>
    this.comProblema()
      ? Object.values(this.registros()).filter((r) => r.avariadas > 0 || r.faltando > 0)
      : [],
  );

  /** "Com avaria ou falta" marcado e nenhuma quantidade informada: as observações explicam o problema. */
  readonly houveAvaria = computed(() => this.comProblema() && this.ocorrencias().length === 0);

  /** Quantas unidades voltam ao estoque, vão para manutenção ou ficam como falta. */
  readonly resumo = computed(() => {
    const s = this.alvo();
    if (!s) return null;
    const opcoes: OpcoesDevolucao = { observacoes: this.observacoes(), ocorrencias: this.ocorrencias() };
    return this.demo.resumoDevolucao(s, opcoes);
  });

  // Listas de espera. No modo demonstração atualizam sozinhas (inclusive entre abas).
  // Com a API, são carregadas ao abrir a tela e depois de cada registro.
  private readonly listaApiRetirada = signal<Emprestimo[]>([]);
  private readonly listaApiEmUso = signal<Emprestimo[]>([]);
  readonly aguardandoRetirada = computed(() =>
    this.service.modoDemo
      ? this.demo.todas().filter((s) => s.status === 'aprovado')
      : this.listaApiRetirada(),
  );
  readonly emUso = computed(() =>
    this.service.modoDemo ? this.demo.emAndamento() : this.listaApiEmUso(),
  );

  constructor() {
    this.destroy.onDestroy(() => this.consulta?.unsubscribe());
    this.carregarListas();
    // Atalho vindo de Solicitações › Insumos: /admin/balcao?aba=retirada&codigo=XXXXXX
    const q = this.rota.snapshot.queryParamMap;
    const aba = q.get('aba');
    if (aba === 'retirada' || aba === 'devolucao') this.aba.set(aba);
    const codigo = q.get('codigo');
    if (codigo) {
      this.codigo.set(codigo);
      this.buscar();
    }
  }

  passoInsumo(): string {
    const a = this.alvoInsumo();
    return a && aceitaFracao(a.req.insumo.unidadeMedida) ? '0.1' : '1';
  }

  atualizarQtdInsumo(evento: Event): void {
    this.qtdInsumo.set((evento.target as HTMLInputElement).value);
    this.erro.set('');
  }

  definirUsouTudo(valor: boolean): void {
    this.usouTudo.set(valor);
    this.erro.set('');
  }

  /** Entrega o insumo ou recebe a sobra, com o código já conferido. */
  confirmarInsumo(): void {
    const a = this.alvoInsumo();
    if (!a || this.salvando()) return;
    const unidade = NOME_UNIDADE[a.req.insumo.unidadeMedida];
    const texto = this.qtdInsumo().trim().replace(',', '.');
    const numero = texto === '' ? NaN : Number(texto);
    if (a.tipo === 'retirada') {
      const erro = this.requisicoes.entregar(a.req.id, numero, this.codigoConferido);
      if (erro) {
        this.erro.set(erro);
        return;
      }
      const r = this.requisicoes.buscarPorId(a.req.id)!;
      this.notificacoes.sucesso(
        `${r.protocolo} entregue a ${r.solicitante.nome}: ${formatarQuantidade(numero)} ${unidade} de ${r.insumo.nome}. A sobra volta com o código de devolução.`,
      );
    } else {
      const sobra = this.usouTudo() ? 0 : numero;
      if (!this.usouTudo() && !(sobra > 0)) {
        this.erro.set('Informe quanto sobrou, ou marque que usou tudo.');
        return;
      }
      const erro = this.requisicoes.devolverSobra(a.req.id, sobra, this.codigoConferido);
      if (erro) {
        this.erro.set(erro);
        return;
      }
      this.notificacoes.sucesso(
        sobra === 0
          ? `${a.req.protocolo} encerrada: ${a.req.solicitante.nome} usou tudo.`
          : `Sobra de ${a.req.protocolo} de volta ao estoque: ${formatarQuantidade(sobra)} ${unidade} de ${a.req.insumo.nome}.`,
      );
    }
    this.limpar();
  }

  /** Serviço dos dados do navegador (modo demonstração e resumo da devolução). */
  private get demo(): EmprestimoService {
    return this.injector.get(EmprestimoService);
  }

  itens(s: Emprestimo): string {
    // As listas do modo demonstração vêm direto dos dados do navegador (sem o equipamento embutido).
    return this.service.modoDemo ? this.demo.resumoItens(s) : this.service.resumoItens(s);
  }

  atrasado(s: Emprestimo): boolean {
    return s.status === 'atrasado' || (this.service.modoDemo && this.demo.estaAtrasado(s));
  }

  trocarAba(aba: Aba): void {
    if (this.salvando()) return;
    this.limpar();
    this.aba.set(aba);
  }

  atualizarCodigo(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value);
  }

  atualizarObservacoes(evento: Event): void {
    this.observacoes.set((evento.target as HTMLTextAreaElement).value);
  }

  nomeItem(equipamentoId: string): string {
    const item = this.alvo()?.itens.find((i) => i.equipamentoId === equipamentoId);
    return item?.equipamento?.nome ?? this.equipamentos.buscarPorId(equipamentoId)?.nome ?? 'Item removido';
  }

  registro(equipamentoId: string): RegistroAvariaDTO {
    return this.registros()[equipamentoId] ?? { equipamentoId, avariadas: 0, faltando: 0 };
  }

  definirProblema(valor: boolean): void {
    this.comProblema.set(valor);
    this.erro.set('');
  }

  /** Botões − e + de "avariadas" e "faltando". A soma nunca passa do que foi emprestado. */
  mudarQuantidade(item: ItemEmprestimo, campo: 'avariadas' | 'faltando', delta: number): void {
    const r = this.registro(item.equipamentoId);
    const outro = campo === 'avariadas' ? r.faltando : r.avariadas;
    const valor = Math.max(0, Math.min(item.quantidade - outro, r[campo] + delta));
    this.salvarRegistro(item.equipamentoId, { [campo]: valor });
  }

  mudarAvaria(equipamentoId: string, mudanca: Partial<DadosAvaria>): void {
    this.salvarRegistro(equipamentoId, mudanca);
  }

  private salvarRegistro(equipamentoId: string, mudanca: Partial<RegistroAvariaDTO>): void {
    this.erro.set('');
    this.registros.update((atual) => ({
      ...atual,
      [equipamentoId]: { ...this.registro(equipamentoId), ...mudanca },
    }));
  }

  /**
   * QR lido pela câmera: o próprio QR diz se é retirada (FAB:R:...) ou devolução (FAB:D:...),
   * então a aba certa é escolhida sozinha antes de conferir.
   */
  lerQr(texto: string): void {
    const marcador = /^FAB:([RD]):/i.exec(texto.trim())?.[1]?.toUpperCase();
    if (marcador === 'R' && this.aba() !== 'retirada') this.trocarAba('retirada');
    if (marcador === 'D' && this.aba() !== 'devolucao') this.trocarAba('devolucao');
    this.codigo.set(texto.trim());
    this.buscar();
  }

  /** Procura o pedido pelo código (não altera nada ainda). */
  buscar(): void {
    if (this.consultando() || this.salvando()) return;
    this.erro.set('');
    this.alvo.set(null);
    this.alvoInsumo.set(null);
    this.codigoConferido = '';

    const texto = this.codigo().trim();
    const codigo = normalizarCodigo(texto);
    // O QR diz de que tipo é: FAB:R:... (retirada) ou FAB:D:... (devolução)
    const marcador = /^FAB:([RD]):/i.exec(texto)?.[1]?.toUpperCase();
    if ((marcador === 'R' && this.aba() !== 'retirada') || (marcador === 'D' && this.aba() !== 'devolucao')) {
      this.erro.set('Este QR pertence à outra operação. Troque a aba antes de conferir.');
      return;
    }
    if (!codigo) {
      this.erro.set('Digite ou escaneie o código.');
      return;
    }

    // Requisição de insumo? (os códigos nunca se repetem entre insumos e empréstimos)
    const insumo = this.requisicoes.buscarPorCodigo(texto);
    if (insumo) {
      if (insumo.tipo !== this.aba()) {
        this.erro.set(
          insumo.tipo === 'retirada'
            ? 'Este é um código de RETIRADA de insumo. Use a aba Retirada.'
            : 'Este é um código de DEVOLUÇÃO de sobra de insumo. Use a aba Devolução.',
        );
        return;
      }
      this.codigoConferido = codigo;
      this.alvoInsumo.set(insumo);
      this.usouTudo.set(false);
      this.qtdInsumo.set(insumo.tipo === 'retirada' ? String(Math.min(insumo.req.quantidade, this.maximoEntrega())) : '');
      return;
    }

    this.consultando.set(true);
    this.consulta = this.service
      .consultarCodigo(texto, this.aba())
      .pipe(finalize(() => this.consultando.set(false)))
      .subscribe({
        next: (resposta) => {
          if (resposta.tipo !== this.aba()) {
            this.erro.set(
              resposta.tipo === 'retirada'
                ? 'Este é um código de RETIRADA. Use a aba Retirada.'
                : 'Este é um código de DEVOLUÇÃO. Use a aba Devolução.',
            );
            return;
          }
          this.codigoConferido = codigo;
          this.alvo.set(resposta.emprestimo);
          this.localUsoId.set(resposta.emprestimo.localUso?.localId ?? '');
          this.localUsoDetalhe.set(resposta.emprestimo.localUso?.detalhe ?? '');
          this.termoAceito.set(false);
        },
        error: (erro) => this.erro.set(mensagemErroAdmin(erro)),
      });
  }

  limpar(): void {
    this.consulta?.unsubscribe();
    this.codigoConferido = '';
    this.codigo.set('');
    this.erro.set('');
    this.alvo.set(null);
    this.alvoInsumo.set(null);
    this.qtdInsumo.set('');
    this.usouTudo.set(false);
    this.comProblema.set(false);
    this.registros.set({});
    this.observacoes.set('');
    this.localUsoId.set('');
    this.localUsoDetalhe.set('');
    this.termoAceito.set(false);
  }

  atualizarLocal(evento: Event): void {
    this.localUsoId.set((evento.target as HTMLSelectElement).value);
    this.erro.set('');
  }

  atualizarDetalheLocal(evento: Event): void {
    this.localUsoDetalhe.set((evento.target as HTMLInputElement).value);
  }

  confirmar(): void {
    if (!this.alvo() || !this.codigoConferido || this.salvando()) return;
    const devolucao = this.aba() === 'devolucao';
    if (devolucao && this.houveAvaria() && !this.observacoes().trim()) {
      this.erro.set('Informe as observações da avaria ou marque as unidades com problema.');
      return;
    }
    if (!devolucao && this.service.modoDemo && !this.localUsoId()) {
      this.erro.set('Confirme onde o material será usado.');
      return;
    }
    if (!devolucao && !this.termoAceito()) {
      this.erro.set('O responsável precisa aceitar o termo de responsabilidade antes da entrega.');
      return;
    }

    const resumo = this.resumo();
    const comAvaria = this.houveAvaria();
    this.erro.set('');
    this.salvando.set(true);
    const operacao = devolucao
      ? this.service.devolver({
          codigo: this.codigoConferido,
          houveAvaria: comAvaria,
          observacoes: this.observacoes(),
          ocorrencias: this.ocorrencias(),
        })
      : this.service.retirar(this.codigoConferido, {
          termoAceito: true,
          localUso: this.localUsoId()
            ? { localId: this.localUsoId(), detalhe: this.localUsoDetalhe().trim() || undefined }
            : undefined,
        });

    operacao
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe({
        next: (s) => {
          this.avisarSucesso(s, devolucao, comAvaria, resumo);
          this.limpar();
          this.carregarListas();
        },
        error: (erro) => {
          this.erro.set(mensagemErroAdmin(erro));
          // Exige nova consulta depois de um erro (por exemplo, outra pessoa já usou o código).
          this.alvo.set(null);
          this.codigoConferido = '';
        },
      });
  }

  private avisarSucesso(
    s: Emprestimo,
    devolucao: boolean,
    comAvaria: boolean,
    r: { aoEstoque: number; emManutencao: number; faltando: number } | null,
  ): void {
    if (!devolucao) {
      const onde = s.localUso ? ` · em uso em ${descreverLocalUso(s.localUso)}` : '';
      this.notificacoes.sucesso(`Retirada registrada: ${s.protocolo} entregue a ${s.responsavel.nome}${onde}.`);
    } else if (r && (r.emManutencao > 0 || r.faltando > 0)) {
      const partes = [
        `${r.aoEstoque} de volta ao estoque`,
        r.emManutencao ? `${r.emManutencao} para manutenção` : '',
        r.faltando ? `${r.faltando} faltando` : '',
      ].filter(Boolean);
      this.notificacoes.aviso(`Devolução registrada: ${s.protocolo}. ${partes.join(' · ')}. Veja em Manutenção.`, 8000);
    } else if (comAvaria) {
      this.notificacoes.aviso(`Devolução registrada: ${s.protocolo} com avaria. Veja em Manutenção.`, 8000);
    } else {
      this.notificacoes.sucesso(`Devolução registrada: ${s.protocolo}. Tudo de volta ao estoque.`);
    }
    // Política de atraso: a devolução atrasada pode ter suspendido o responsável.
    const suspensao = devolucao ? s.historico.find((e) => e.tipo === 'suspensao_aplicada') : undefined;
    if (suspensao?.detalhe) this.notificacoes.aviso(suspensao.detalhe, 9000);
  }

  /** Com a API, busca os pedidos aprovados e em uso. No modo demonstração não precisa. */
  private carregarListas(): void {
    if (this.service.modoDemo) return;
    const carregar = (status: 'aprovado' | 'em_andamento', destino: (lista: Emprestimo[]) => void) =>
      this.service
        .listar({ status, itensPorPagina: 100 })
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({ next: (pagina) => destino(pagina.itens), error: () => destino([]) });
    carregar('aprovado', (l) => this.listaApiRetirada.set(l));
    carregar('em_andamento', (l) => this.listaApiEmUso.set(l));
  }
}
