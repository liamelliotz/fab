// signal: valor reativo que atualiza a tela sozinho quando muda
// forwardRef: permite referenciar a classe antes de ela ser totalmente definida
import { Component, forwardRef, input, signal } from '@angular/core';
// ControlValueAccessor: contrato que permite usar este componente com
// formControlName, [formControl] e ngModel, como se fosse um <input> nativo
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// Contador usado para gerar um id único por instância (liga <label> ao <input>)
let nextId = 0;

@Component({
  selector: 'app-input', // uso: <app-input />
  standalone: true,
  templateUrl: './input.html',
  styleUrl: './input.css',
  // Registra este componente como "campo de formulário" para o Angular Forms
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Input),
      multi: true,
    },
  ],
})
// Se o seu Angular gerou o nome "InputComponent", use esse nome aqui (e no forwardRef acima)
export class Input implements ControlValueAccessor {
  // ---------- Propriedades que o componente PAI pode configurar ----------
  label = input('');        // etiqueta de identificação (texto acima do campo)
  placeholder = input('');  // texto de exemplo dentro do campo
  type = input<'text' | 'email' | 'password' | 'number'>('text'); // tipo do campo
  hint = input('');         // texto de contexto/ajuda abaixo do campo
  error = input('');        // mensagem de erro/validação (se preenchida, o campo fica em estado de erro)

  // ---------- Estado interno ----------
  id = `app-input-${nextId++}`; // id único deste campo
  value = signal('');           // valor atual digitado
  isDisabled = signal(false);   // se o campo está desabilitado pelo formulário

  // Funções que o Angular Forms entrega para avisarmos quando algo muda.
  // Começam vazias e são substituídas em registerOnChange/registerOnTouched.
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ---------- Métodos exigidos pelo ControlValueAccessor ----------

  // O formulário -> componente: chamado quando o valor é definido por fora
  writeValue(v: string): void { this.value.set(v ?? ''); }

  // Guarda a função que avisa o formulário de que o valor mudou
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }

  // Guarda a função que avisa o formulário de que o campo foi "tocado" (perdeu o foco)
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  // Chamado quando o formulário habilita/desabilita o campo
  setDisabledState(d: boolean): void { this.isDisabled.set(d); }

  // ---------- Eventos do template ----------

  // A cada digitação: atualiza o valor local e avisa o formulário
  handleInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  // Ao sair do campo: marca como "tocado" (útil para exibir erros só depois)
  handleBlur(): void { this.onTouched(); }
}