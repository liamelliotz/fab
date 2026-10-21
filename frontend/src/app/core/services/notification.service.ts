
import { Injectable, signal } from '@angular/core';

/**
 * Exemplos de uso:
 *
 * inject(NotificationService).sucesso('Equipamento cadastrado com sucesso!');
 * inject(NotificationService).erro('Não foi possível salvar o equipamento.');
 *
 * A duração é informada em milissegundos. Use 0 para manter o aviso
 * visível até que o usuário o feche manualmente.
 */

export type TipoNotificacao = 'sucesso' | 'erro' | 'aviso' | 'info';

export interface Notificacao {
  id: number;
  tipo: TipoNotificacao;
  mensagem: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly lista = signal<Notificacao[]>([]);
  private proximoId = 0;

  private readonly temporizadores = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  readonly notificacoes = this.lista.asReadonly();

  sucesso(mensagem: string, duracao = 5000): void {
    this.exibir('sucesso', mensagem, duracao);
  }

  erro(mensagem: string, duracao = 7000): void {
    this.exibir('erro', mensagem, duracao);
  }

  aviso(mensagem: string, duracao = 5000): void {
    this.exibir('aviso', mensagem, duracao);
  }

  info(mensagem: string, duracao = 5000): void {
    this.exibir('info', mensagem, duracao);
  }

  fechar(id: number): void {
    const temporizador = this.temporizadores.get(id);

    if (temporizador !== undefined) {
      clearTimeout(temporizador);
      this.temporizadores.delete(id);
    }

    this.lista.update((notificacoes) =>
      notificacoes.filter((notificacao) => notificacao.id !== id),
    );
  }

  limpar(): void {
    for (const temporizador of this.temporizadores.values()) {
      clearTimeout(temporizador);
    }

    this.temporizadores.clear();
    this.lista.set([]);
  }

  private exibir(
    tipo: TipoNotificacao,
    mensagem: string,
    duracao: number,
  ): void {
    const id = ++this.proximoId;

    this.lista.update((notificacoes) => [
      ...notificacoes,
      { id, tipo, mensagem },
    ]);

    if (duracao > 0) {
      const temporizador = setTimeout(() => {
        this.fechar(id);
      }, duracao);

      this.temporizadores.set(id, temporizador);
    }
  }
}
