import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Acessibilidade } from '../../shared/components/acessibilidade/acessibilidade';

/** Página inicial pública: o que é o FAB, como funciona e para quem serve. */
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, Acessibilidade],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly auth = inject(AuthService);
  /** Quem já entrou vai direto ao painel. */
  readonly destino = this.auth.obterToken() ? this.auth.rotaInicial() : '/login';
  readonly logado = !!this.auth.obterToken();

  readonly valores = [
    { icone: 'fa-qrcode', titulo: 'Retirada com código', texto: 'O material só sai do balcão com o código ou o QR do professor e o termo de responsabilidade aceito.' },
    { icone: 'fa-map-location-dot', titulo: 'Onde está cada item', texto: 'O mapa mostra, sala por sala, o que está em uso, guardado ou em manutenção, montado pelos próprios registros.' },
    { icone: 'fa-box-open', titulo: 'Insumos sob controle', texto: 'Filamento, papel e componentes com saldo, pedido do professor, consumo real e previsão de término.' },
    { icone: 'fa-shield-halved', titulo: 'Prestação de contas', texto: 'Auditoria que ninguém edita, baixa patrimonial com termo numerado e relatórios em CSV.' },
  ];

  readonly passos = [
    { n: 1, titulo: 'Pedir', texto: 'O professor escolhe no inventário, informa as datas, a sala e a finalidade.' },
    { n: 2, titulo: 'Aprovar', texto: 'A coordenação aprova e o estoque fica reservado.' },
    { n: 3, titulo: 'Retirar', texto: 'No balcão, com código ou QR e termo de responsabilidade.' },
    { n: 4, titulo: 'Devolver', texto: 'Conferência na volta; avaria vai para a manutenção.' },
  ];
}
