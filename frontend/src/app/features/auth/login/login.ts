import { Component, inject, signal } from '@angular/core';
// HttpErrorResponse: tipo do erro que o HttpClient devolve (traz o status, ex.: 401)
import { HttpErrorResponse } from '@angular/common/http';
// ReactiveFormsModule: habilita formulário reativo (formGroup, formControlName)
// FormBuilder: facilita criar o formulário; Validators: regras de validação
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// Componentes reutilizáveis criados no Card 5
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/input/input';
// Serviço de autenticação (Card 8)
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login', // tag: <app-login>
  standalone: true,
  // Tudo que o template usa precisa estar listado aqui
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
// Se o seu Angular gerou o nome "LoginComponent", use esse nome aqui
export class Login {
  // inject() entrega o FormBuilder sem precisar de construtor
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private rota = inject(ActivatedRoute);

  // Mensagem de erro vinda da API (ex.: senha incorreta). '' = sem erro
  erroApi = signal('');

  // Aviso de cima do formulário: senha trocada pelo link ou sessão vencida
  readonly aviso = signal(this.avisoInicial());
  // true enquanto a requisição está em andamento (desabilita o botão)
  carregando = signal(false);

  // Formulário reativo com dois campos e suas regras de validação
  form = this.fb.nonNullable.group({
    // e-mail: obrigatório e com formato de e-mail válido
    email: ['', [Validators.required, Validators.email]],
    // senha: obrigatória e com no mínimo 6 caracteres
    senha: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Devolve a mensagem de erro de um campo (ou '' se não houver erro).
  // Só mostra o erro depois que o usuário "tocou" no campo (saiu dele) ou tentou enviar.
  getError(campo: 'email' | 'senha'): string {
    const control = this.form.controls[campo];
    if (!control.touched || control.valid) return '';

    if (control.hasError('required')) {
      return campo === 'email' ? 'Informe seu e-mail' : 'Informe sua senha';
    }
    if (control.hasError('email')) return 'E-mail inválido';
    if (control.hasError('minlength')) return 'A senha deve ter ao menos 6 caracteres';
    return '';
  }

  // Chamado ao clicar em "Entrar" (evento ngSubmit do formulário)
  onSubmit(): void {
    // Se estiver inválido, marca todos os campos como "tocados" para exibir os erros
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.carregando()) return; // evita enviar duas vezes

    this.erroApi.set('');
    this.carregando.set(true);

    // O AuthService chama a API e, se der certo, guarda o token e o perfil na sessão desta aba
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.carregando.set(false);
        // Admin vai para a área administrativa; os demais para o dashboard
        this.router.navigate([this.auth.rotaInicial()]);
      },
      error: (erro: HttpErrorResponse) => {
        this.carregando.set(false);
        this.erroApi.set(mensagemDeLogin(erro));
      },
    });
  }

  private avisoInicial(): string {
    const params = this.rota.snapshot.queryParamMap;
    if (params.get('senhaRedefinida')) return 'Senha redefinida. Entre com a nova senha.';
    if (params.get('sessaoExpirada')) return 'Sua sessão terminou. Entre de novo para continuar.';
    return '';
  }
}

/**
 * Mensagem do login para cada resposta da API. Cada caso tem a sua mensagem, para a pessoa saber
 * o que fazer: senha errada (401), conta bloqueada ou inativa (403) e tentativas demais (429).
 * Usa o texto da própria API quando ele vem no envelope.
 */
export function mensagemDeLogin(erro: HttpErrorResponse): string {
  const daApi = typeof erro.error?.mensagem === 'string' ? erro.error.mensagem.trim() : '';
  switch (erro.status) {
    case 401:
      return daApi || 'E-mail ou senha incorretos.';
    case 403:
      return daApi || 'Conta desativada. Procure a coordenação.';
    case 429:
      return 'Muitas tentativas de login. Aguarde um minuto e tente de novo.';
    case 0:
      return 'Não foi possível conectar ao servidor. Confira a internet ou tente em instantes.';
    default:
      return 'Não foi possível entrar. Tente novamente em instantes.';
  }
}
