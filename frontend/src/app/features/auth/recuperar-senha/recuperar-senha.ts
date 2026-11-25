import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/input/input';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * "Esqueci minha senha": a pessoa informa o e-mail e a API gera um link de redefinição.
 * A resposta é sempre a mesma, exista o e-mail ou não (para ninguém descobrir quem tem conta).
 * Nesta versão não há envio de e-mail: em desenvolvimento, o link aparece no log da API.
 */
@Component({
  selector: 'app-recuperar-senha',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './recuperar-senha.html',
  styleUrls: ['../login/login.css', './recuperar-senha.css'],
})
export class RecuperarSenha {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly carregando = signal(false);
  readonly erroApi = signal('');
  /** Mensagem da API depois do envio. Preenchida = mostra a tela de "pedido enviado". */
  readonly enviado = signal('');
  /** Fora de produção, lembra onde o link aparece (não há e-mail nesta versão). */
  readonly dicaDesenvolvimento = !environment.production && !environment.modoDemo;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  getError(): string {
    const control = this.form.controls.email;
    if (!control.touched || control.valid) return '';
    return control.hasError('required') ? 'Informe seu e-mail' : 'E-mail inválido';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.carregando()) return;
    this.erroApi.set('');
    this.carregando.set(true);
    this.auth.recuperarSenha(this.form.getRawValue().email.trim()).subscribe({
      next: (mensagem) => {
        this.carregando.set(false);
        this.enviado.set(mensagem);
      },
      error: (erro: HttpErrorResponse) => {
        this.carregando.set(false);
        this.erroApi.set(
          erro.status === 429
            ? 'Muitos pedidos seguidos. Aguarde um minuto e tente de novo.'
            : erro.status === 0
              ? 'Não foi possível conectar ao servidor. Tente em instantes.'
              : (erro.error?.mensagem ?? 'Não foi possível enviar o pedido. Tente novamente.'),
        );
      },
    });
  }
}
