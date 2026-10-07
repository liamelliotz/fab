import {
  Directive,
  ElementRef,
  HostListener
} from '@angular/core';

@Directive({
  selector: '[appCpfMask]',
  standalone: true
})
export class CpfMaskDirective {

  // Pegamos o campo HTML onde a diretiva foi colocada.
  constructor(
    private elementRef: ElementRef<HTMLInputElement>
  ) {}

  // Executa toda vez que o usuário digita.
  @HostListener('input')
  onInput(): void {

    // Pegamos o valor que o usuário digitou.
    let value = this.elementRef.nativeElement.value;

    // Removemos tudo que não for número.
    value = value.replace(/\D/g, '');

    // Limitamos o CPF a 11 números.
    value = value.substring(0, 11);

    // Aplicamos a máscara.
    if (value.length > 9) {

      value = value.replace(
        /^(\d{3})(\d{3})(\d{3})(\d{2}).*/,
        '$1.$2.$3-$4'
      );

    } else if (value.length > 6) {

      value = value.replace(
        /^(\d{3})(\d{3})(\d{1,3}).*/,
        '$1.$2.$3'
      );

    } else if (value.length > 3) {

      value = value.replace(
        /^(\d{3})(\d{1,3}).*/,
        '$1.$2'
      );
    }

    // Colocamos o valor formatado de volta no input.
    this.elementRef.nativeElement.value = value;
  }
}