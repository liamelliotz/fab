import { Controller } from '@nestjs/common';
import { EmprestimosService } from './emprestimos.service.js';

@Controller('emprestimos')
export class EmprestimosController {
  constructor(private readonly emprestimosService: EmprestimosService) {}
}
