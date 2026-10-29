import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  EmprestimoService,
  NOME_STATUS_EMPRESTIMO,
} from '../../../core/services/emprestimo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarCodigo, montarPayloadQr } from '../../../core/utils/codigo.utils';
import { formatarData, formatarDataHora } from '../../../core/utils/date.utils';
import { LinhaDoTempo, PassoFuturo } from '../../../shared/components/linha-do-tempo/linha-do-tempo';
import { QrCode } from '../../../shared/components/qr-code/qr-code';
import { TransferirDialog } from '../components/transferir-dialog/transferir-dialog';

/**
 * Detalhes de um pedido: código e QR (retirada e devolução), responsável atual, cadeia de
 * responsáveis, transferência e a linha do tempo completa (auditoria).
 * Aberto em /pedidos/:id pelo professor (seus pedidos) e pela coordenação (todos).
 */
@Component({
  selector: 'app-emprestimo-detalhes',
  standalone: true,
  imports: [RouterLink, QrCode, LinhaDoTempo, TransferirDialog],
  templateUrl: './emprestimo-detalhes.html',
  styleUrl: './emprestimo-detalhes.css',
})
export class EmprestimoDetalhes {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmprestimoService);
  private readonly auth = inject(AuthService);
  private readonly notificacoes = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;
  readonly data = formatarData;
  readonly dataHora = formatarDataHora;
  readonly codigo = formatarCodigo;

  readonly dialogoAberto = signal(false);
  readonly recusando = signal(false);
  readonly motivoRecusa = signal('');

  readonly eu = computed(() => this.auth.usuarioAtual());
  readonly ehAdmin = computed(() => this.eu().perfil === 'admin');
  readonly pedido = computed(() => this.service.buscarPorId(this.id));

  /** A coordenação vê tudo; o professor só vê pedidos em que participa. */
  readonly podeVer = computed(() => {
    const p = this.pedido();
    if (!p) return false;
    const eu = this.eu();
    return (
      this.ehAdmin() ||
      p.solicitante.id === eu.id ||
      p.responsavel.id === eu.id ||
      p.transferenciaPendente?.para.id === eu.id
    );
  });

  readonly voltarPara = computed(() => (this.ehAdmin() ? '/admin/emprestimos' : '/meus-emprestimos'));
  readonly souResponsavel = computed(() => this.pedido()?.responsavel.id === this.eu().id);
  readonly souDestinatario = computed(
    () => this.pedido()?.transferenciaPendente?.para.id === this.eu().id,
  );
  readonly souQuemTransfere = computed(
    () => this.pedido()?.transferenciaPendente?.de.id === this.eu().id,
  );

  readonly atrasado = computed(() => {
    const p = this.pedido();
    return !!p && this.service.estaAtrasado(p);
  });
  readonly statusExibido = computed(() => (this.atrasado() ? 'atrasado' : this.pedido()?.status ?? ''));
  readonly nomeStatusExibido = computed(() =>
    this.atrasado() ? 'Atrasado' : this.nomeStatus[this.pedido()?.status ?? 'pendente'],
  );

  readonly itens = computed(() => {
    const p = this.pedido();
    return p ? this.service.resumoItens(p) : '';
  });
  readonly cadeia = computed(() => {
    const p = this.pedido();
    return p ? this.service.cadeiaResponsaveis(p) : [];
  });

  /** "Faltam 3 dia(s)", "Vence hoje" ou "Atrasado há 2 dia(s)". */
  readonly prazoTexto = computed(() => {
    const p = this.pedido();
    if (!p || (p.status !== 'aprovado' && p.status !== 'em_andamento')) return '';
    const dias = this.service.diasRestantes(p);
    if (dias < 0) return `Atrasado há ${-dias} dia(s)`;
    return dias === 0 ? 'Vence hoje' : `Faltam ${dias} dia(s)`;
  });

  /** Motivo pelo qual o botão "Transferir" está bloqueado (null = liberado). */
  readonly erroTransferencia = computed(() => {
    const p = this.pedido();
    return p && this.souResponsavel() ? this.service.erroTransferencia(p, this.eu().id) : null;
  });
  readonly mostrarTransferir = computed(
    () => this.pedido()?.status === 'em_andamento' && this.souResponsavel(),
  );
  readonly podeCancelarPedido = computed(() => {
    const p = this.pedido();
    if (!p || (p.status !== 'pendente' && p.status !== 'aprovado')) return false;
    const eu = this.eu();
    return this.ehAdmin() || p.solicitante.id === eu.id || p.responsavel.id === eu.id;
  });

  // ---- Código e QR (só o responsável atual vê; a coordenação digita o que a pessoa mostra) ----
  readonly qrRetirada = computed(() => {
    const p = this.pedido();
    return p?.codigoRetirada ? montarPayloadQr('R', p.protocolo, p.codigoRetirada) : '';
  });
  readonly qrDevolucao = computed(() => {
    const p = this.pedido();
    return p?.codigoDevolucao ? montarPayloadQr('D', p.protocolo, p.codigoDevolucao) : '';
  });

  /** Etapas que ainda vão acontecer, mostradas tracejadas no fim da linha do tempo. */
  readonly passosFuturos = computed<PassoFuturo[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    const devolucao: PassoFuturo = {
      titulo: 'Devolução',
      detalhe: `Prevista para ${formatarData(p.dataPrevistaDevolucao)}`,
      alerta: this.atrasado(),
    };
    switch (p.status) {
      case 'pendente':
        return [
          { titulo: 'Análise da coordenação', detalhe: 'Aguardando aprovação' },
          { titulo: 'Retirada', detalhe: `Prevista para ${formatarData(p.dataPrevistaRetirada)}` },
          devolucao,
        ];
      case 'aprovado':
        return [
          { titulo: 'Retirada no balcão', detalhe: `Prevista para ${formatarData(p.dataPrevistaRetirada)}` },
          devolucao,
        ];
      case 'em_andamento':
        return [devolucao];
      default:
        return [];
    }
  });

  // ---- Ações ----
  aceitar(): void {
    const erro = this.service.responderTransferencia(this.id, true);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.sucesso('Transferência aceita. Agora você é o responsável por este material.');
  }

  recusar(): void {
    const erro = this.service.responderTransferencia(this.id, false, this.motivoRecusa());
    if (erro) {
      this.notificacoes.erro(erro);
      return;
    }
    this.recusando.set(false);
    this.motivoRecusa.set('');
    this.notificacoes.info('Transferência recusada. O material continua com quem pediu.');
  }

  atualizarMotivoRecusa(evento: Event): void {
    this.motivoRecusa.set((evento.target as HTMLInputElement).value);
  }

  cancelarTransferencia(): void {
    const erro = this.service.cancelarTransferencia(this.id);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.info('Pedido de transferência cancelado.');
  }

  cancelarPedido(): void {
    const erro = this.service.cancelar(this.id);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.info('Pedido cancelado.');
  }
}
