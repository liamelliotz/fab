import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  // Nome que vamos usar no HTML.
  name: 'patrimonyCode',

  // Pipe independente.
  standalone: true
})
export class PatrimonyCodePipe implements PipeTransform {

  transform(value: string | number | null | undefined): string {

    // Se não tiver valor, não mostramos nada.
    if (value === null || value === undefined || value === '') {
      return '';
    }

    // Transformamos o valor em texto.
    let code = String(value);

    // Removemos espaços e caracteres que não sejam letras ou números.
    code = code.replace(/[^a-zA-Z0-9]/g, '');

    // Deixamos tudo em maiúsculo.
    code = code.toUpperCase();

    // Exemplo:
    // 12345678
    // vira:
    // PAT-1234-5678
    //
    // Aqui estamos considerando um código de 8 números.
    if (code.length === 8) {
      return `PAT-${code.substring(0, 4)}-${code.substring(4, 8)}`;
    }

    // Se não tiver 8 caracteres,
    // devolvemos o código sem alterar a estrutura.
    return code;
  }
}