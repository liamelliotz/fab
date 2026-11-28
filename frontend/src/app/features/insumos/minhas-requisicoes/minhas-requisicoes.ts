import { Component, computed, inject, signal } from '@angular/core';
import { nomeLocal } from '../../../core/constants/escola-modelo.constants';
import { RequisicaoInsumo } from '../../../core/models/requisicao-insumo.model';
import { NOME_UNIDADE, formatarQuantidade } from '../../../core/services/insumo.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  MINIMO_TEXTO,
  NOME_STATUS_REQUISICAO,
  RequisicaoInsumoService,
} from '../../../core/services/requisicao-insumo.service';
import { formatarData } from '../../../core/utils/date.utils';
import { DialogoDirective } from '../../../shared/directives/dialogo.directive';
import { QrCode } from '../../../shared/components/qr-code/qr-code';
import { formatarCodigo, montarPayloadQr } from '../../../core/utils/codigo.utils';

/**
 * Requisições de insumo do professor logado (Meus pedidos › Insumos): código e QR para retirar
 * no balcão, código e QR para devolver a sobra, e cancelamento com motivo.
 */
@Component({
  selector: 'app-minhas-requisicoes',
  standalone: true,
  imports: [DialogoDirective, QrCode],
  templateUrl: './minhas-requisicoes.html',
  styleUrl: './minhas-requisicoes.css',
})
export class MinhasRequisicoes {
  private readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly avisos = inject(NotificationService);

  readonly nomeUnidade = NOME_UNIDADE;
  readonly nomeStatus = NOME_STATUS_REQUISICAO;
  readonly local = nomeLocal;
  readonly data = formatarData;
  readonly qtd = formatarQuantidade;
  readonly minimo = MINIMO_TEXTO;

  readonly minhas = computed(() => {
    this.requisicoes.requisicoes();
    return this.requisicoes.minhas();
  });
  readonly abertas = computed(
    () => this.minhas().filter((r) => r.status === 'pendente' || r.status === 'aprovada' || !!r.codigoDevolucao).length,
  );

  readonly codigo = formatarCodigo;
  readonly prazoRetirada = (r: RequisicaoInsumo) => this.requisicoes.prazoRetirada(r);

  /** Janela com o QR (retirada ou devolução da sobra) para mostrar no balcão. */
  readonly qrAberto = signal<{ req: RequisicaoInsumo; tipo: 'R' | 'D' } | null>(null);
  readonly qrValor = computed(() => {
    const a = this.qrAberto();
    if (!a) return '';
    const c = a.tipo === 'R' ? a.req.codigoRetirada : a.req.codigoDevolucao;
    return c ? montarPayloadQr(a.tipo, a.req.protocolo, c) : '';
  });

  readonly cancelando = signal<RequisicaoInsumo | null>(null);
  readonly motivoCancelamento = signal('');
  readonly erroCancelamento = signal('');

  abrirCancelamento(r: RequisicaoInsumo): void {
    this.motivoCancelamento.set('');
    this.erroCancelamento.set('');
    this.cancelando.set(r);
  }

  escreverMotivo(evento: Event): void {
    this.motivoCancelamento.set((evento.target as HTMLTextAreaElement).value);
    this.erroCancelamento.set('');
  }

  confirmarCancelamento(): void {
    const r = this.cancelando();
    if (!r) return;
    const erro = this.requisicoes.cancelar(r.id, this.motivoCancelamento());
    if (erro) {
      this.erroCancelamento.set(erro);
      return;
    }
    this.avisos.info(`Requisição ${r.protocolo} cancelada.`);
    this.cancelando.set(null);
  }
}
