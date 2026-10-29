import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Emprestimo } from '../../../core/models/emprestimo.model';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarData } from '../../../core/utils/date.utils';

type Aba = 'retirada' | 'devolucao';

/**
 * Balcão da coordenação: entrega e recebe o material usando o código (digitado, ditado ou lido
 * do QR por um leitor USB, que "digita" o conteúdo e dá Enter).
 * O código prova que a pessoa que está no balcão é quem recebeu a aprovação.
 */
@Component({
  selector: 'app-admin-balcao',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-balcao.html',
  styleUrl: './admin-balcao.css',
})
export class AdminBalcao {
  private readonly service = inject(EmprestimoService);
  private readonly notificacoes = inject(NotificationService);

  readonly data = formatarData;

  readonly aba = signal<Aba>('retirada');
  readonly codigo = signal('');
  readonly erro = signal('');

  /** Pedido encontrado (pelo código ou escolhido nas listas) aguardando a confirmação. */
  readonly alvo = signal<Emprestimo | null>(null);
  /** true = a coordenação escolheu o pedido na lista, sem usar o código (fica anotado na linha do tempo). */
  readonly manual = signal(false);

  // Conferência da devolução
  readonly houveAvaria = signal(false);
  readonly observacoes = signal('');

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

  atualizarAvaria(evento: Event): void {
    this.houveAvaria.set((evento.target as HTMLInputElement).checked);
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
    this.manual.set(false);
    this.alvo.set(achado);
  }

  /** Escolhe um pedido da lista (exceção: sem código). */
  escolher(s: Emprestimo, aba: Aba): void {
    this.aba.set(aba);
    this.erro.set('');
    this.codigo.set('');
    this.houveAvaria.set(false);
    this.observacoes.set('');
    this.manual.set(true);
    this.alvo.set(s);
  }

  limpar(): void {
    this.codigo.set('');
    this.erro.set('');
    this.alvo.set(null);
    this.manual.set(false);
    this.houveAvaria.set(false);
    this.observacoes.set('');
  }

  confirmar(): void {
    const s = this.alvo();
    if (!s) return;

    const resultado =
      this.aba() === 'retirada'
        ? this.service.registrarRetirada(s.id, this.manual())
        : this.service.registrarDevolucao(
            s.id,
            { houveAvaria: this.houveAvaria(), observacoes: this.observacoes() },
            this.manual(),
          );

    if (!resultado.ok) {
      this.erro.set(resultado.erro);
      return;
    }
    const concluido = resultado.valor;
    this.notificacoes.sucesso(
      this.aba() === 'retirada'
        ? `Retirada registrada: ${concluido.protocolo} entregue a ${concluido.responsavel.nome}.`
        : `Devolução registrada: ${concluido.protocolo} voltou ao estoque.`,
    );
    this.limpar();
  }
}
