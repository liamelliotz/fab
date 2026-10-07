import { Component, inject } from '@angular/core';
// ReactiveFormsModule: habilita formulário reativo (formGroup, formControlName)
// FormBuilder: facilita criar o formulário; Validators: regras de validação
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
// RouterLink: permite usar [routerLink] no template (link de navegação sem recarregar a página)
import { RouterLink } from '@angular/router';
// Componentes reutilizáveis criados no Card 5
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/input/input';

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
    // TODO: integrar com o backend (NestJS) quando a API de autenticação existir
    console.log('Login enviado:', this.form.getRawValue());
  }

  // Chamado ao clicar em "Fazer login com o Google"
  onGoogleLogin(): void {
    // TODO: implementar login com Google na etapa de integração
    console.log('Login com Google');
  }
}