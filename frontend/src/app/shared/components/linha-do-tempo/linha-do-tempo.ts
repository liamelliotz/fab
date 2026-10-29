import { Component, input } from '@angular/core';
import { ICONE_EVENTO, ROTULO_EVENTO, TOM_EVENTO } from '../../../core/constants/evento.constants';
import { EventoEmprestimo, TipoEventoEmprestimo } from '../../../core/models/emprestimo.model';
import { formatarDataHora } from '../../../core/utils/date.utils';

/** Etapa que ainda vai acontecer (aparece tracejada no fim da linha do tempo). */
export interface PassoFuturo {
  titulo: string;
  detalhe?: string;
  /** Marca em vermelho (ex.: devolução atrasada). */
  alerta?: boolean;
}

/**
 * Linha do tempo (auditoria) de um pedido: o que aconteceu, quem fez e quando.
 * Uso: <app-linha-do-tempo [eventos]="pedido.historico" [futuros]="passos" />
 */
@Component({
  selector: 'app-linha-do-tempo',
  standalone: true,
  templateUrl: './linha-do-tempo.html',
  styleUrl: './linha-do-tempo.css',
})
export class LinhaDoTempo {
  readonly eventos = input.required<EventoEmprestimo[]>();
  readonly futuros = input<PassoFuturo[]>([]);

  readonly dataHora = formatarDataHora;

  rotulo(tipo: TipoEventoEmprestimo): string {
    return ROTULO_EVENTO[tipo];
  }

  icone(tipo: TipoEventoEmprestimo): string {
    return ICONE_EVENTO[tipo];
  }

  tom(tipo: TipoEventoEmprestimo): string {
    return TOM_EVENTO[tipo];
  }
}
