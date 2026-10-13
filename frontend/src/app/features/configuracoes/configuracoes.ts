import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Card } from '../../shared/components/card/card';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [Card],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.css',
})
export class Configuracoes {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly nome = computed(() => this.auth.nomeAtual() ?? '—');
  readonly email = computed(() => this.auth.usuarioAtual().email || '—');
  readonly perfil = computed(() =>
    this.auth.perfilAtual()?.toLowerCase() === 'admin' ? 'Administrador' : 'Usuário',
  );

  sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
