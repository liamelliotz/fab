import { Injectable } from '@angular/core';
import { gerarCodigo } from '../utils/codigo.utils';

/**
 * Códigos de balcão em uso (empréstimos e requisições de insumo usam o MESMO balcão).
 * Cada serviço registra de onde vêm os seus códigos; um código novo nunca repete nenhum deles,
 * então o balcão sempre sabe, sem ambiguidade, de que pedido é o código lido.
 */
@Injectable({ providedIn: 'root' })
export class CodigosService {
  private readonly fontes: (() => Iterable<string | undefined>)[] = [];

  registrar(fonte: () => Iterable<string | undefined>): void {
    this.fontes.push(fonte);
  }

  emUso(): Set<string> {
    const todos = new Set<string>();
    for (const fonte of this.fontes) for (const c of fonte()) if (c) todos.add(c);
    return todos;
  }

  novo(): string {
    return gerarCodigo(6, this.emUso());
  }
}
