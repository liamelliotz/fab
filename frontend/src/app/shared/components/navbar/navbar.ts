import { Acessibilidade } from '../acessibilidade/acessibilidade';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
// Serviço de autenticação: perfil do usuário e logout
import { AuthService } from '../../../core/services/auth.service';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { InsumoService } from '../../../core/services/insumo.service';
import { RequisicaoInsumoService } from '../../../core/services/requisicao-insumo.service';

interface NavItem {
  label: string;
  route: string;
  /** Classes do Font Awesome, ex.: 'fa-solid fa-gear' */
  icon: string;
  /** Título do grupo que este item abre (ex.: "Operação"). Só aparece para a coordenação. */
  grupo?: string;
  /** true = vai para o rodapé da barra (Configurações). */
  rodape?: boolean;
  /** true = o link só aparece para quem tem perfil admin */
  somenteAdmin?: boolean;
  /** true = o link só aparece para quem NÃO é admin (usuário comum) */
  somenteUsuario?: boolean;
  /** Número mostrado na bolinha vermelha do ícone (some quando é 0). */
  badge?: () => number;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, Acessibilidade],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly insumos = inject(InsumoService);
  private readonly requisicoes = inject(RequisicaoInsumoService);

  /** true quando o usuário logado tem perfil admin. */
  readonly ehAdmin = computed(() => this.auth.perfilAtual()?.toLowerCase() === 'admin');

  /** Links exibidos: quem não é admin não vê os itens marcados com somenteAdmin. */
  readonly itensVisiveis = computed(() =>
    this.items.filter(
      (item) =>
        !item.rodape && (!item.somenteAdmin || this.ehAdmin()) && (!item.somenteUsuario || !this.ehAdmin()),
    ),
  );
  readonly itensRodape = computed(() => this.items.filter((item) => item.rodape));

  /** Nome e perfil mostrados no rodapé da barra. */
  readonly nome = computed(() => this.auth.nomeAtual() ?? '');
  readonly iniciais = computed(() =>
    this.nome()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join(''),
  );
  readonly perfil = computed(() => (this.ehAdmin() ? 'Coordenação' : 'Professor'));

  /**
   * Nome lido pelo leitor de tela. Inclui as novidades, porque o número na bolinha
   * é só visual (e o aria-label do link esconderia o texto dela).
   */
  rotuloDoLink(item: NavItem): string {
    const novidades = item.badge?.() ?? 0;
    if (novidades === 0) return item.label;
    return `${item.label}, ${novidades} ${novidades === 1 ? 'novidade' : 'novidades'}`;
  }

  /** Encerra a sessão e volta para a tela de login. */
  sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Requisições de insumo do professor logado já aprovadas (falta retirar no balcão). */
  private readonly meusInsumosAprovados = () =>
    this.requisicoes
      .requisicoes()
      .filter((r) => r.status === 'aprovada' && r.solicitante.id === this.auth.usuarioAtual().id).length;

  readonly items: NavItem[] = [
    { label: 'Painel', route: '/dashboard', icon: 'fa-solid fa-house', grupo: 'Operação' },
    {
      label: 'Solicitações',
      route: '/admin/solicitacoes',
      icon: 'fa-solid fa-inbox',
      somenteAdmin: true,
      // Pedidos de empréstimo e requisições de insumo esperando análise
      badge: () => this.emprestimos.pendentes().length + this.requisicoes.pendentes().length,
    },
    { label: 'Balcão', route: '/admin/balcao', icon: 'fa-solid fa-qrcode', somenteAdmin: true },
    {
      label: 'Empréstimos',
      route: '/admin/emprestimos',
      icon: 'fa-solid fa-right-left',
      somenteAdmin: true,
      badge: () => this.emprestimos.avisosNaoLidos(),
    },
    {
      label: 'Inventário',
      route: '/admin/inventario',
      icon: 'fa-solid fa-boxes-stacked',
      somenteAdmin: true,
      grupo: 'Acervo',
      // Insumos no estoque mínimo ou abaixo
      badge: () => this.insumos.aRepor().length,
    },
    { label: 'Manutenção', route: '/admin/manutencao', icon: 'fa-solid fa-screwdriver-wrench', somenteAdmin: true },
    { label: 'Mapa de itens', route: '/admin/mapa', icon: 'fa-solid fa-map-location-dot', somenteAdmin: true },
    { label: 'Auditoria', route: '/admin/auditoria', icon: 'fa-solid fa-shield-halved', somenteAdmin: true, grupo: 'Gestão' },
    { label: 'Usuários', route: '/admin/usuarios', icon: 'fa-solid fa-users', somenteAdmin: true },
    { label: 'Relatórios', route: '/admin/relatorios', icon: 'fa-solid fa-chart-column', somenteAdmin: true },
    { label: 'Inventário', route: '/inventario', icon: 'fa-solid fa-boxes-stacked', somenteUsuario: true },
    {
      label: 'Meus pedidos',
      route: '/meus-emprestimos',
      icon: 'fa-solid fa-clipboard-list',
      somenteUsuario: true,
      // Transferências esperando resposta + insumos aprovados para retirar
      badge: () =>
        this.emprestimos.transferenciasRecebidas(this.auth.usuarioAtual().id).length + this.meusInsumosAprovados(),
    },
    { label: 'Configurações', route: '/configuracoes', icon: 'fa-solid fa-gear', rodape: true },
  ];

}
