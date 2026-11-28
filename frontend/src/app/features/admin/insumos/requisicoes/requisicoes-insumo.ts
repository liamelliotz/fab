import { Component, computed, inject, signal } from '@angular/core';
import { nomeLocal } from '../../../../core/constants/escola-modelo.constants';
import { RequisicaoInsumo, StatusRequisicaoInsumo } from '../../../../core/models/requisicao-insumo.model';
import { NOME_UNIDADE, formatarQuantidade } from '../../../../core/services/insumo.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  MINIMO_TEXTO,
  NOME_ACAO_REQUISICAO,
  NOME_STATUS_REQUISICAO,
  RequisicaoInsumoService,
} from '../../../../core/services/requisicao-insumo.service';
import { formatarData, formatarDataHora } from '../../../../core/utils/date.utils';
import { DialogoDirective } from '../../../../shared/directives/dialogo.directive';
import { RouterLink } from '@angular/router';
import { formatarCodigo } from '../../../../core/utils/codigo.utils';

type Filtro = 'abertas' | 'sobra' | StatusRequisicaoInsumo | 'todas';
type Acao = 'recusar' | 'historico';

/**
 * Requisições de insumo para a coordenação: aprovar (reserva + código de retirada) e recusar
 * (com motivo). Entrega e sobra são feitas no Balcão, com o código conferido; daqui há um atalho.
 */
@Component({
  selector: 'app-requisicoes-insumo',
  standalone: true,
  imports: [DialogoDirective, RouterLink],
  templateUrl: './requisicoes-insumo.html',
  styleUrl: './requisicoes-insumo.css',
})
export class RequisicoesInsumo {
  readonly service = inject(RequisicaoInsumoService);
  private readonly avisos = inject(NotificationService);

  readonly nomeStatus = NOME_STATUS_REQUISICAO;
  readonly nomeAcao = NOME_ACAO_REQUISICAO;
  readonly nomeUnidade = NOME_UNIDADE;
  readonly qtd = formatarQuantidade;
  readonly data = formatarData;
  readonly dataHora = formatarDataHora;
  readonly local = nomeLocal;
  readonly minimo = MINIMO_TEXTO;

  readonly filtro = signal<Filtro>('abertas');

  readonly lista = computed(() => {
    const f = this.filtro();
    const ordem: StatusRequisicaoInsumo[] = ['pendente', 'aprovada', 'entregue', 'recusada', 'cancelada'];
    return this.service
      .requisicoes()
      .filter((r) =>
        f === 'todas'
          ? true
          : f === 'abertas'
            ? r.status === 'pendente' || r.status === 'aprovada' || !!r.codigoDevolucao
            : f === 'sobra'
              ? !!r.codigoDevolucao
              : r.status === f,
      )
      .sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status) || a.dataUso.localeCompare(b.dataUso));
  });

  readonly dialogo = signal<{ acao: Acao; req: RequisicaoInsumo } | null>(null);
  readonly texto = signal('');
  readonly erro = signal('');

  mudarFiltro(evento: Event): void {
    this.filtro.set((evento.target as HTMLSelectElement).value as Filtro);
  }

  codigo(c?: string): string {
    return c ? formatarCodigo(c) : '';
  }

  aprovar(r: RequisicaoInsumo): void {
    const erro = this.service.aprovar(r.id);
    if (erro) this.avisos.erro(erro);
    else {
      const codigo = this.service.buscarPorId(r.id)?.codigoRetirada;
      this.avisos.sucesso(
        `${r.protocolo} aprovada. ${this.service.qtd(r.quantidade, r.insumo.unidadeMedida)} reservados. Código de retirada: ${this.codigo(codigo)}.`,
      );
    }
  }

  abrir(acao: Acao, r: RequisicaoInsumo): void {
    this.erro.set('');
    this.texto.set('');
    this.dialogo.set({ acao, req: r });
  }

  escrever(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
    this.erro.set('');
  }

  confirmar(): void {
    const d = this.dialogo();
    if (!d || d.acao !== 'recusar') {
      this.dialogo.set(null);
      return;
    }
    const erro = this.service.recusar(d.req.id, this.texto());
    if (erro) {
      this.erro.set(erro);
      return;
    }
    this.avisos.sucesso(`${d.req.protocolo} recusada. O professor vê o motivo.`);
    this.dialogo.set(null);
  }
}
