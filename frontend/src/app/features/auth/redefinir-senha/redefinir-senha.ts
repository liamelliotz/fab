import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/input/input';
import { AuthService } from '../../../core/services/auth.service';

/** As duas senhas digitadas precisam ser iguais. */
function senhasIguais(grupo: AbstractControl): ValidationErrors | null {
  const nova = grupo.get('novaSenha')?.value;
  const confirmacao = grupo.get('confirmacao')?.value;
  return nova && confirmacao && nova !== confirmacao ? { diferentes: true } : null;
}

/**
 * Tela aberta pelo link de redefinição (/redefinir-senha?token=...).
 * O token vale 30 minutos e uma única vez. Quem confere tudo é a API.
 */
@Component({
  selector: 'app-redefinir-senha',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './redefinir-senha.html',
  styleUrls: ['../login/login.css', '../recuperar-senha/recuperar-senha.css'],
})
export class RedefinirSenha {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Token que veio no link. Vazio = link incompleto. */
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';
  readonly carregando = signal(false);
  readonly erroApi = signal('');

  form = this.fb.nonNullable.group(
    {
      novaSenha: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmacao: ['', [Validators.required]],
    },
    { validators: senhasIguais },
  );

  getError(campo: 'novaSenha' | 'confirmacao'): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) {
      return campo === 'novaSenha' ? 'Informe a nova senha' : 'Repita a nova senha';
    }
    if (control.hasError('minlength')) return 'A senha deve ter no mínimo 8 caracteres';
    if (control.hasError('maxlength')) return 'A senha deve ter no máximo 72 caracteres';
    if (campo === 'confirmacao' && this.form.hasError('diferentes')) return 'As senhas não são iguais';
    return '';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.carregando()) return;
    this.erroApi.set('');
    this.carregando.set(true);
    this.auth.redefinirSenha(this.token, this.form.getRawValue().novaSenha).subscribe({
      next: () => {
        this.carregando.set(false);
        void this.router.navigate(['/login'], { queryParams: { senhaRedefinida: 1 } });
      },
      error: (erro: HttpErrorResponse) => {
        this.carregando.set(false);
        // A API diz o motivo: link inválido, vencido ou já usado (todos 400).
        this.erroApi.set(
          erro.status === 429
            ? 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
            : erro.status === 0
              ? 'Não foi possível conectar ao servidor. Tente em instantes.'
              : (erro.error?.mensagem ?? 'Não foi possível redefinir a senha. Peça um novo link.'),
        );
      },
    });
  }
}
