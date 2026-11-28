import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Card } from '../../shared/components/card/card';
import { RegrasEmprestimoForm } from './regras-emprestimo/regras-emprestimo';
import { Usuario } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { formatarTelefone } from '../../core/utils/validation.utils';

/**
 * Configurações: dados da conta de quem está logado.
 * Desde o card A7 vêm de GET /auth/me (a API devolve a conta atual, nunca a senha).
 * Enquanto a resposta não chega, mostra o que já está no token (nome, e-mail e perfil).
 */
@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [Card, RegrasEmprestimoForm],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.css',
})
export class Configuracoes {
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);
  private readonly router = inject(Router);

  /** Conta vinda da API (GET /auth/me). null enquanto carrega ou se falhar. */
  readonly conta = signal<Usuario | null>(null);

  readonly nome = computed(() => this.conta()?.nome ?? this.auth.nomeAtual() ?? '—');
  readonly email = computed(() => this.conta()?.email ?? (this.auth.usuarioAtual().email || '—'));
  readonly perfil = computed(() =>
    (this.conta()?.perfil ?? this.auth.perfilAtual()) === 'admin' ? 'Administrador' : 'Professor',
  );
  readonly ehAdmin = computed(() => (this.conta()?.perfil ?? this.auth.perfilAtual()) === 'admin');
  readonly departamento = computed(() => this.conta()?.departamento || '—');
  readonly matricula = computed(() => this.conta()?.matricula || '—');
  readonly telefone = computed(() => {
    const t = this.conta()?.telefone;
    return t ? formatarTelefone(t) : '—';
  });

  constructor() {
    this.usuarios
      .minhaConta(this.auth.usuarioAtual().id)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({ next: (u) => this.conta.set(u), error: () => this.conta.set(null) });
  }

  sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
