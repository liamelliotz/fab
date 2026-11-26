import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
// Serviço de autenticação: perfil do usuário e logout
import { AuthService } from '../../../core/services/auth.service';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { InsumoService } from '../../../core/services/insumo.service';

interface NavItem {
  label: string;
  route: string;
  /** Classes do Font Awesome, ex.: 'fa-solid fa-gear' */
  icon: string;
  /** true = começa um novo grupo (linha separadora, só desenhada para admin) */
  novoGrupo?: boolean;
  /** true = o link só aparece para quem tem perfil admin */
  somenteAdmin?: boolean;
  /** true = o link só aparece para quem NÃO é admin (usuário comum) */
  somenteUsuario?: boolean;
  /** Número mostrado na bolinha vermelha do ícone (some quando é 0). */
  badge?: () => number;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly insumos = inject(InsumoService);

  /** true quando o usuário logado tem perfil admin. */
  readonly ehAdmin = computed(() => this.auth.perfilAtual()?.toLowerCase() === 'admin');

  /** Links exibidos: quem não é admin não vê os itens marcados com somenteAdmin. */
  readonly itensVisiveis = computed(() =>
    this.items.filter(
      (item) =>
        (!item.somenteAdmin || this.ehAdmin()) && (!item.somenteUsuario || !this.ehAdmin()),
    ),
  );

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

  readonly items: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'fa-solid fa-gauge-high' },
    {
      label: 'Solicitações',
      route: '/admin/solicitacoes',
      icon: 'fa-solid fa-inbox',
      somenteAdmin: true,
      badge: () => this.emprestimos.pendentes().length,
    },
    { label: 'Balcão', route: '/admin/balcao', icon: 'fa-solid fa-qrcode', somenteAdmin: true },
    {
      label: 'Empréstimos',
      route: '/admin/emprestimos',
      icon: 'fa-solid fa-right-left',
      somenteAdmin: true,
      badge: () => this.emprestimos.avisosNaoLidos(),
    },
    { label: 'Equipamentos', route: '/admin/equipamentos', icon: 'fa-solid fa-laptop', somenteAdmin: true },
    { label: 'Manutenção', route: '/admin/manutencao', icon: 'fa-solid fa-screwdriver-wrench', somenteAdmin: true },
    {
      label: 'Insumos',
      route: '/admin/insumos',
      icon: 'fa-solid fa-boxes-stacked',
      somenteAdmin: true,
      badge: () => this.insumos.aRepor().length,
    },
    { label: 'Mapa de itens', route: '/admin/mapa', icon: 'fa-solid fa-map-location-dot', somenteAdmin: true },
    { label: 'Auditoria', route: '/admin/auditoria', icon: 'fa-solid fa-shield-halved', somenteAdmin: true },
    { label: 'Usuários', route: '/admin/usuarios', icon: 'fa-solid fa-users', somenteAdmin: true },
    { label: 'Relatórios', route: '/admin/relatorios', icon: 'fa-solid fa-chart-column', somenteAdmin: true },
    { label: 'Materiais', route: '/materiais', icon: 'fa-solid fa-box-open', novoGrupo: true },
    {
      label: 'Meus pedidos',
      route: '/meus-emprestimos',
      icon: 'fa-solid fa-clipboard-list',
      somenteUsuario: true,
      // Transferências de outros professores esperando a sua resposta
      badge: () => this.emprestimos.transferenciasRecebidas(this.auth.usuarioAtual().id).length,
    },
    { label: 'Configurações', route: '/configuracoes', icon: 'fa-solid fa-gear' },
  ];
}
