import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DemoService } from '../../../core/services/demo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UsuarioService } from '../../../core/services/usuario.service';

/**
 * BARRA DA DEMONSTRAÇÃO (só no modo demonstração): troca de conta com um clique, para mostrar
 * os dois lados de um fluxo na apresentação, e restaura os dados iniciais.
 * Cada aba guarda a própria sessão: dá para deixar o professor numa aba e a coordenação em outra.
 */
@Component({
  selector: 'app-barra-demo',
  standalone: true,
  templateUrl: './barra-demo.html',
  styleUrl: './barra-demo.css',
})
export class BarraDemo {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly avisos = inject(NotificationService);
  private readonly demo = inject(DemoService);
  private readonly usuarios = inject(UsuarioService);

  readonly ativo = this.demo.ativo;
  readonly aberto = signal(false);
  readonly eu = computed(() => this.auth.usuarioAtual());

  /** Coordenação primeiro, depois os professores ativos. */
  readonly contas = computed(() =>
    this.usuarios
      .todos()
      .filter((u) => u.status === 'ativo')
      .sort((a, b) => (a.perfil === b.perfil ? a.nome.localeCompare(b.nome) : a.perfil === 'admin' ? -1 : 1)),
  );

  entrarComo(id: string, nome: string): void {
    if (!this.auth.entrarComoDemo(id)) return;
    this.aberto.set(false);
    this.avisos.info(`Agora você está como ${nome}.`);
    this.router.navigate([this.auth.rotaInicial()]);
  }

  restaurar(): void {
    this.aberto.set(false);
    this.demo.confirmandoRestauracao.set(true);
  }
}
