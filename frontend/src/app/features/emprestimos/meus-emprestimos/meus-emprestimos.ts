import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Emprestimo } from '../../../core/models/emprestimo.model';
import { AuthService } from '../../../core/services/auth.service';
import {
  EmprestimoService,
  NOME_STATUS_EMPRESTIMO,
} from '../../../core/services/emprestimo.service';
import { formatarData } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-meus-emprestimos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './meus-emprestimos.html',
  styleUrl: './meus-emprestimos.css',
})
export class MeusEmprestimos {
  private readonly service = inject(EmprestimoService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;
  readonly data = formatarData;

  /** true logo após enviar uma solicitação (a tela de envio redireciona com ?enviado=1). */
  readonly enviado = this.route.snapshot.queryParamMap.get('enviado') === '1';

  readonly meus = computed(() => {
    const id = this.auth.usuarioAtual().id;
    return this.service.todas().filter((s) => s.solicitante.id === id);
  });

  itens(s: Emprestimo): string {
    return this.service.resumoItens(s);
  }

  atrasado(s: Emprestimo): boolean {
    return this.service.estaAtrasado(s);
  }

  cancelar(s: Emprestimo): void {
    this.service.cancelar(s.id);
  }
}
