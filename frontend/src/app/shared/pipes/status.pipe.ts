import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  // Nome usado no HTML.
  name: 'statusDescription',

  // Pipe independente.
  standalone: true
})
export class StatusPipe implements PipeTransform {

  transform(value: string | null | undefined): string {

    // Se não tiver estado, mostramos um texto padrão.
    if (!value) {
      return 'Não informado';
    }

    // Convertemos para maiúsculo para facilitar a comparação.
    const status = value.toUpperCase();

    // Transformamos o código em uma descrição.
    switch (status) {

      case 'AVAILABLE':
      case 'DISPONIVEL':
      case 'DISPONÍVEL':
        return 'Disponível';

      case 'BORROWED':
      case 'EMPRESTADO':
        return 'Emprestado';

      case 'RETURNED':
      case 'DEVOLVIDO':
        return 'Devolvido';

      case 'OVERDUE':
      case 'ATRASADO':
        return 'Devolução atrasada';

      case 'MAINTENANCE':
      case 'MANUTENCAO':
      case 'MANUTENÇÃO':
        return 'Em manutenção';

      default:
        // Se não reconhecermos o estado,
        // devolvemos o texto original.
        return value;
    }
  }
}

