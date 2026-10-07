import { Component, inject } from '@angular/core';
// takeUntilDestroyed: cancela a "escuta" do campo quando o componente é destruído (evita vazamento de memória)
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
// Componentes reutilizáveis criados no Card 5
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/input/input';

// Nomes dos campos do formulário (usado para tipar o getError)
type Campo = 'nome' | 'email' | 'cpf' | 'senha' | 'confirmarSenha' | 'telefone';

// ---------- Funções de apoio (máscaras e validações) ----------

// Deixa só números de um texto: "123.456" -> "123456"
const somenteNumeros = (valor: string): string => (valor ?? '').replace(/\D/g, '');

// Máscara de CPF enquanto o usuário digita: 12345678900 -> 123.456.789-00
function formatarCpf(valor: string): string {
  const n = somenteNumeros(valor).slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

// Máscara de telefone: 11999998888 -> (11) 99999-8888 | 1133334444 -> (11) 3333-4444
function formatarTelefone(valor: string): string {
  const n = somenteNumeros(valor).slice(0, 11);
  if (n.length <= 2) return n.length ? `(${n}` : '';
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

// Calcula um dígito verificador do CPF (len = 9 para o 1º dígito, 10 para o 2º)
function digitoCpf(cpf: string, len: number): number {
  let soma = 0;
  for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

// Validador de CPF: confere tamanho, sequências repetidas (111.111.111-11) e os dígitos verificadores
const cpfValido: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const cpf = somenteNumeros(control.value);
  if (!cpf) return null; // vazio é tratado pelo Validators.required
  const repetido = /^(\d)\1{10}$/.test(cpf);
  const ok = cpf.length === 11 && !repetido &&
    digitoCpf(cpf, 9) === Number(cpf[9]) && digitoCpf(cpf, 10) === Number(cpf[10]);
  return ok ? null : { cpfInvalido: true };
};

// Validador de telefone: aceita 10 dígitos (fixo) ou 11 (celular), com DDD
const telefoneValido: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const n = somenteNumeros(control.value);
  if (!n) return null;
  return n.length === 10 || n.length === 11 ? null : { telefoneInvalido: true };
};

// Validador do FORMULÁRIO inteiro: senha e confirmação precisam ser iguais
const senhasIguais: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const senha = group.get('senha')?.value;
  const confirmar = group.get('confirmarSenha')?.value;
  return senha === confirmar ? null : { senhasDiferentes: true };
};

@Component({
  selector: 'app-cadastro', // tag: <app-cadastro>
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.css',
})
// Se o seu Angular gerou o nome "CadastroComponent", use esse nome aqui
export class Cadastro {
  private fb = inject(FormBuilder);

  // Formulário reativo com todos os campos e suas regras
  form = this.fb.nonNullable.group(
    {
      nome: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      cpf: ['', [Validators.required, cpfValido]],
      senha: ['', [Validators.required, Validators.minLength(6)]],
      confirmarSenha: ['', [Validators.required]],
      telefone: ['', [Validators.required, telefoneValido]],
    },
    // Regra aplicada ao grupo: compara senha e confirmação
    { validators: senhasIguais },
  );

  constructor() {
    // A cada digitação no CPF, reaplica a máscara.
    // emitEvent: false evita um loop infinito (setValue disparar valueChanges de novo).
    this.form.controls.cpf.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const formatado = formatarCpf(v);
      if (formatado !== v) this.form.controls.cpf.setValue(formatado, { emitEvent: false });
    });

    // Mesma ideia para o telefone
    this.form.controls.telefone.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const formatado = formatarTelefone(v);
      if (formatado !== v) this.form.controls.telefone.setValue(formatado, { emitEvent: false });
    });
  }

  // Devolve a mensagem de erro de um campo ('' = sem erro).
  // Só mostra depois que o usuário saiu do campo ou tentou enviar.
  getError(campo: Campo): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';

    if (control.hasError('required')) {
      const obrigatorios: Record<Campo, string> = {
        nome: 'Informe seu nome completo',
        email: 'Informe seu e-mail',
        cpf: 'Informe seu CPF',
        senha: 'Crie uma senha',
        confirmarSenha: 'Confirme sua senha',
        telefone: 'Informe seu telefone',
      };
      return obrigatorios[campo];
    }
    if (control.hasError('minlength')) {
      return campo === 'nome'
        ? 'O nome deve ter ao menos 3 caracteres'
        : 'A senha deve ter ao menos 6 caracteres';
    }
    if (control.hasError('email')) return 'E-mail inválido';
    if (control.hasError('cpfInvalido')) return 'CPF inválido';
    if (control.hasError('telefoneInvalido')) return 'Telefone inválido (use DDD + número)';
    // Erro do grupo (senhas diferentes) exibido no campo de confirmação
    if (campo === 'confirmarSenha' && this.form.hasError('senhasDiferentes')) {
      return 'As senhas não conferem';
    }
    return '';
  }

  // Chamado ao clicar em "Criar Conta"
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // mostra todos os erros de uma vez
      return;
    }
    const { nome, email, cpf, senha, telefone } = this.form.getRawValue();
    // Envia CPF e telefone só com números (sem máscara). Não envia a confirmação da senha.
    const dados = { nome, email, cpf: somenteNumeros(cpf), senha, telefone: somenteNumeros(telefone) };
    // TODO: integrar com o backend (NestJS) quando a API de cadastro existir
    console.log('Cadastro enviado:', { ...dados, senha: '***' });
  }
}