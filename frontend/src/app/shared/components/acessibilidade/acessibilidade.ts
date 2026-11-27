import { Component, inject, input, signal } from '@angular/core';
import { AcessibilidadeService, PreferenciasAcessibilidade } from '../../../core/services/acessibilidade.service';
import { DialogoDirective } from '../../directives/dialogo.directive';

type Opcao = Exclude<keyof PreferenciasAcessibilidade, 'tamanho'>;

/**
 * Botão "Acessibilidade" + janela com as preferências de leitura.
 * `variante`: 'navbar' (dentro da barra lateral) ou 'flutuante' (login e telas sem menu).
 */
@Component({
  selector: 'app-acessibilidade',
  standalone: true,
  imports: [DialogoDirective],
  templateUrl: './acessibilidade.html',
  styleUrl: './acessibilidade.css',
})
export class Acessibilidade {
  readonly service = inject(AcessibilidadeService);
  readonly variante = input<'navbar' | 'flutuante'>('navbar');
  readonly aberto = signal(false);

  readonly tamanhos: { valor: PreferenciasAcessibilidade['tamanho']; rotulo: string }[] = [
    { valor: 100, rotulo: 'Padrão' },
    { valor: 115, rotulo: 'Maior' },
    { valor: 130, rotulo: 'Bem maior' },
  ];

  readonly opcoes: { chave: Opcao; titulo: string; dica: string }[] = [
    { chave: 'contraste', titulo: 'Alto contraste', dica: 'Textos, bordas e ícones mais fortes.' },
    { chave: 'espacamento', titulo: 'Mais espaço no texto', dica: 'Entre linhas, letras e palavras.' },
    { chave: 'sublinharLinks', titulo: 'Sublinhar links', dica: 'Mostra o que é clicável sem depender da cor.' },
    { chave: 'focoReforcado', titulo: 'Foco reforçado', dica: 'Contorno amarelo e grosso ao navegar pelo teclado (Tab).' },
    { chave: 'semAnimacao', titulo: 'Menos animação', dica: 'Desliga movimentos e transições.' },
  ];

  alternar(chave: Opcao): void {
    this.service.mudar(chave, !this.service.preferencias()[chave]);
  }
}
