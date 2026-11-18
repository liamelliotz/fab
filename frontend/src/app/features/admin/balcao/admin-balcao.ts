import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Emprestimo, ItemEmprestimo } from '../../../core/models/emprestimo.model';
import { RegistroAvariaDTO } from '../../../core/models/manutencao.model';
import { EmprestimoService, OpcoesDevolucao } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { AvariaCampos, DadosAvaria } from '../../../shared/components/avaria-campos/avaria-campos';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarData } from '../../../core/utils/date.utils';

type Aba = 'retirada' | 'devolucao';

/**
 * Balcão da coordenação: entrega e recebe o material usando o código (digitado, ditado ou lido
 * do QR por um leitor USB, que "digita" o conteúdo e dá Enter).
 * O código prova que a pessoa que está no balcão é quem recebeu a aprovação.
 * Não existe registro sem código: as listas abaixo só mostram o que está esperando.
 */
@Component({
  selector: 'app-admin-balcao',
  standalone: true,
  imports: [RouterLink, AvariaCampos],
  templateUrl: './admin-balcao.html',
  styleUrl: './admin-balcao.css',
})
export class AdminBalcao {
  private readonly service = inject(EmprestimoService);
  private readonly notificacoes = inject(NotificationService);
  private readonly equipamentos = inject(EquipamentoService);

  readonly data = formatarData;

  readonly aba = signal<Aba>('retirada');
  readonly codigo = signal('');
  readonly erro = signal('');

  /** Pedido encontrado (pelo código ou escolhido nas listas) aguardando a confirmação. */
  readonly alvo = signal<Emprestimo | null>(null);

  // Conferência da devolução
  /** false = tudo em ordem; true = abre o registro de avaria/falta por item. */
  readonly comProblema = signal(false);
  /** Avarias e faltas por equipamento do pedido (chave = equipamentoId). */
  readonly registros = signal<Record<string, RegistroAvariaDTO>>({});
  readonly observacoes = signal('');

  /** O que será enviado ao confirmar a devolução. */
  readonly opcoes = computed<OpcoesDevolucao>(() => ({
    observacoes: this.observacoes(),
    ocorrencias: this.comProblema() ? Object.values(this.registros()) : [],
  }));

  /** Quantas unidades voltam ao estoque, vão para manutenção ou ficam como falta. */
  readonly resumo = computed(() => {
    const s = this.alvo();
    return s ? this.service.resumoDevolucao(s, this.opcoes()) : null;
  });

  readonly aguardandoRetirada = computed(() =>
    this.service.todas().filter((s) => s.status === 'aprovado'),
  );
  readonly emUso = computed(() => this.service.emAndamento());

  itens(s: Emprestimo): string {
    return this.service.resumoItens(s);
  }

  atrasado(s: Emprestimo): boolean {
    return this.service.estaAtrasado(s);
  }

  trocarAba(aba: Aba): void {
    this.aba.set(aba);
    this.limpar();
  }

  atualizarCodigo(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value);
  }

  atualizarObservacoes(evento: Event): void {
    this.observacoes.set((evento.target as HTMLTextAreaElement).value);
  }

  nomeItem(equipamentoId: string): string {
    return this.equipamentos.buscarPorId(equipamentoId)?.nome ?? 'Item removido';
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

  /** Procura o pedido pelo código (não altera nada ainda). */
  buscar(): void {
    this.erro.set('');
    const texto = this.codigo();
    const achado =
      this.aba() === 'retirada'
        ? this.service.buscarPorCodigoRetirada(texto)
        : this.service.buscarPorCodigoDevolucao(texto);
    if (!achado) {
      this.alvo.set(null);
      this.erro.set(this.service.erroCodigo(texto, this.aba()));
      return;
    }
    this.alvo.set(achado);
  }

  limpar(): void {
    this.codigo.set('');
    this.erro.set('');
    this.alvo.set(null);
    this.comProblema.set(false);
    this.registros.set({});
    this.observacoes.set('');
  }

  confirmar(): void {
    const s = this.alvo();
    if (!s) return;

    // O registro só acontece com o código: o serviço confere o código de novo antes de alterar o pedido.
    const resultado =
      this.aba() === 'retirada'
        ? this.service.confirmarRetirada(this.codigo())
        : this.service.confirmarDevolucao(this.codigo(), this.opcoes());

    if (!resultado.ok) {
      this.erro.set(resultado.erro);
      return;
    }
    const concluido = resultado.valor;
    const r = this.resumo();
    if (this.aba() === 'retirada') {
      this.notificacoes.sucesso(`Retirada registrada: ${concluido.protocolo} entregue a ${concluido.responsavel.nome}.`);
    } else if (r && (r.emManutencao > 0 || r.faltando > 0)) {
      const partes = [
        `${r.aoEstoque} de volta ao estoque`,
        r.emManutencao ? `${r.emManutencao} para manutenção` : '',
        r.faltando ? `${r.faltando} faltando` : '',
      ].filter(Boolean);
      this.notificacoes.aviso(`Devolução registrada: ${concluido.protocolo}. ${partes.join(' · ')}. Veja em Manutenção.`, 8000);
    } else {
      this.notificacoes.sucesso(`Devolução registrada: ${concluido.protocolo}. Tudo de volta ao estoque.`);
    }
    this.limpar();
  }
}
