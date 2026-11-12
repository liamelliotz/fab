import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { montarPagina, type RespostaPaginada } from '../common/dto/index.js';
import { Perfil, StatusEquipamento } from '../common/enums/index.js';
import type { FiltroEquipamentoDto } from './dto/filtro-equipamento.dto.js';
import type { Equipamento } from './entities/equipamento.entity.js';
import { EquipamentosRepository } from './equipamentos.repository.js';

/** Status que só a coordenação enxerga (o catálogo do professor não mostra). */
const STATUS_OCULTOS_DO_CATALOGO: readonly StatusEquipamento[] = [
  StatusEquipamento.Inativo,
  StatusEquipamento.Descartado,
];

@Injectable()
export class EquipamentosService {
  constructor(
    @Inject(EquipamentosRepository)
    private readonly equipamentosRepository: EquipamentosRepository,
  ) {}

  /**
   * Lista com filtros e paginação, em ordem alfabética.
   * Quem não é admin não vê itens inativos nem descartados.
   */
  async listar(
    filtro: FiltroEquipamentoDto,
    perfil: Perfil = Perfil.Usuario,
  ): Promise<RespostaPaginada<Equipamento>> {
    const busca = filtro.busca?.trim().toLowerCase();
    const todos = await this.equipamentosRepository.listar();

    const filtrados = todos
      .filter(
        (e) =>
          perfil === Perfil.Admin ||
          !STATUS_OCULTOS_DO_CATALOGO.includes(e.status),
      )
      .filter((e) => !filtro.categoria || e.categoria === filtro.categoria)
      .filter((e) => !filtro.status || e.status === filtro.status)
      .filter(
        (e) =>
          !filtro.apenasDisponiveis ||
          (e.status === StatusEquipamento.Disponivel &&
            e.quantidadeDisponivel > 0),
      )
      .filter(
        (e) =>
          !busca ||
          e.nome.toLowerCase().includes(busca) ||
          e.codigoPatrimonio.toLowerCase().includes(busca),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return montarPagina(filtrados, filtro);
  }

  /** Busca interna (outros módulos): devolve `null` quando não existe. */
  buscarPorId(id: string): Promise<Equipamento | null> {
    return this.equipamentosRepository.buscarPorId(id);
  }

  /** Para as rotas: 404 quando não existe (ou quando o professor pede um item oculto). */
  async obterPorId(
    id: string,
    perfil: Perfil = Perfil.Usuario,
  ): Promise<Equipamento> {
    const equipamento = await this.equipamentosRepository.buscarPorId(id);
    const oculto =
      equipamento &&
      perfil !== Perfil.Admin &&
      STATUS_OCULTOS_DO_CATALOGO.includes(equipamento.status);
    if (!equipamento || oculto) {
      throw new NotFoundException('Equipamento não encontrado.');
    }
    return equipamento;
  }
}
