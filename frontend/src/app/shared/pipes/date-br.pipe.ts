import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'returnDate',
  standalone: true
})
export class ReturnDatePipe implements PipeTransform {

  transform(value: string | Date | null | undefined): string {

    // Se não tiver uma data, não mostramos nada.
    if (!value) {
      return '';
    }

    // Transformamos o valor recebido em uma data.
    const date = new Date(value);

    // Verificamos se a data é válida.
    if (isNaN(date.getTime())) {
      return '';
    }

    // Formatamos a data para o padrão brasileiro.
    return date.toLocaleDateString('pt-BR');
  }
}