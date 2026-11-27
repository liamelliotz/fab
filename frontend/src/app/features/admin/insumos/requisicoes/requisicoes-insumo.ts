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
  aceitaFracao,
} from '../../../../core/services/requisicao-insumo.service';
import { formatarData, formatarDataHora } from '../../../../core/utils/date.utils';
import { DialogoDirective } from '../../../../shared/directives/dialogo.directive';

type Filtro = 'abertas' | StatusRequisicaoInsumo | 'todas';
type Acao = 'recusar' | 'entregar' | 'sobra' | 'historico';

/**
 * Requisições de insumo para a coordenação: aprovar (reserva), recusar (com motivo),
 * entregar no balcão (saída do estoque) e registrar a sobra que voltou.
 */
@Component({
  selector: 'app-requisicoes-insumo',
  standalone: true,
  imports: [DialogoDirective],
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
        f === 'todas' ? true : f === 'abertas' ? r.status === 'pendente' || r.status === 'aprovada' : r.status === f,
      )
      .sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status) || a.dataUso.localeCompare(b.dataUso));
  });

  readonly dialogo = signal<{ acao: Acao; req: RequisicaoInsumo } | null>(null);
  readonly texto = signal('');
  readonly erro = signal('');

  mudarFiltro(evento: Event): void {
    this.filtro.set((evento.target as HTMLSelectElement).value as Filtro);
  }

  passo(r: RequisicaoInsumo): string {
    return aceitaFracao(r.insumo.unidadeMedida) ? '0.1' : '1';
  }

  aprovar(r: RequisicaoInsumo): void {
    const erro = this.service.aprovar(r.id);
    if (erro) this.avisos.erro(erro);
    else this.avisos.sucesso(`${r.protocolo} aprovada. ${this.service.qtd(r.quantidade, r.insumo.unidadeMedida)} reservados.`);
  }

  abrir(acao: Acao, r: RequisicaoInsumo): void {
    this.erro.set('');
    this.texto.set(acao === 'entregar' ? String(r.quantidade) : acao === 'sobra' ? '' : '');
    this.dialogo.set({ acao, req: r });
  }

  escrever(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
    this.erro.set('');
  }

  confirmar(): void {
    const d = this.dialogo();
    if (!d) return;
    const numero = Number(this.texto().replace(',', '.'));
    let erro: string | null = null;
    let ok = '';
    switch (d.acao) {
      case 'recusar':
        erro = this.service.recusar(d.req.id, this.texto());
        ok = `${d.req.protocolo} recusada. O professor vê o motivo.`;
        break;
      case 'entregar':
        erro = this.service.entregar(d.req.id, numero);
        ok = `${d.req.protocolo} entregue. Saída registrada no estoque.`;
        break;
      case 'sobra':
        erro = this.service.devolverSobra(d.req.id, numero);
        ok = `Sobra de ${d.req.protocolo} devolvida ao estoque.`;
        break;
      default:
        this.dialogo.set(null);
        return;
    }
    if (erro) {
      this.erro.set(erro);
      return;
    }
    this.avisos.sucesso(ok);
    this.dialogo.set(null);
  }
}
