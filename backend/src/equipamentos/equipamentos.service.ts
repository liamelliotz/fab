
import { Injectable } from '@nestjs/common';
import { EquipamentosRepository } from './equipamentos.repository.js';

@Injectable()
export class EquipamentosService {
  constructor(
    private readonly equipamentosRepository: EquipamentosRepository,
  ) {}

  async listar() {
    return this.equipamentosRepository.listar();
  }

  async buscarPorId(id: string) {
    return this.equipamentosRepository.buscarPorId(id);
  }
}
