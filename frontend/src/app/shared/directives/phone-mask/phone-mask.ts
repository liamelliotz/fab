import {
  Directive,
  ElementRef,
  HostListener
} from '@angular/core';

@Directive({
  selector: '[appPhoneMask]',
  standalone: true
})
export class PhoneMaskDirective {

  // Pegamos o input onde a diretiva foi usada.
  constructor(
    private elementRef: ElementRef<HTMLInputElement>
  ) {}

  // Executa sempre que o usuário digitar.
  @HostListener('input')
  onInput(): void {

    // Pegamos o valor digitado.
    let value = this.elementRef.nativeElement.value;

    // Removemos tudo que não for número.
    value = value.replace(/\D/g, '');

    // Limitamos a 11 números.
    value = value.substring(0, 11);

    // Telefone com 11 números:
    // 91999999999
    // vira:
    // (91) 99999-9999
    if (value.length > 10) {

      value = value.replace(
        /^(\d{2})(\d{5})(\d{4}).*/,
        '($1) $2-$3'
      );

    // Telefone começando a ser digitado.
    } else if (value.length > 6) {

      value = value.replace(
        /^(\d{2})(\d{1,5})(\d{1,4}).*/,
        '($1) $2-$3'
      );

    } else if (value.length > 2) {

      value = value.replace(
        /^(\d{2})(\d{1,5}).*/,
        '($1) $2'
      );
    }

    // Colocamos o telefone formatado no input.
    this.elementRef.nativeElement.value = value;
  }
}