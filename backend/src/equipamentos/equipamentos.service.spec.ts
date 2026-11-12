import { NotFoundException } from '@nestjs/common';
import {
  CategoriaEquipamento,
  Perfil,
  StatusEquipamento,
} from '../common/enums/index.js';
import { EQUIPAMENTO_IDS } from '../common/seed/index.js';
import { FiltroEquipamentoDto } from './dto/filtro-equipamento.dto.js';
import { EquipamentosRepository } from './equipamentos.repository.js';
import { EquipamentosService } from './equipamentos.service.js';

describe('EquipamentosService', () => {
  let repositorio: EquipamentosRepository;
  let service: EquipamentosService;
  const filtro = (dados: Partial<FiltroEquipamentoDto> = {}) =>
    Object.assign(new FiltroEquipamentoDto(), { itensPorPagina: 100 }, dados);

  beforeEach(async () => {
    repositorio = new EquipamentosRepository();
    await repositorio.onModuleInit();
    service = new EquipamentosService(repositorio);
  });

  it('o professor não vê itens inativos; o admin vê todos', async () => {
    const doProfessor = await service.listar(filtro());
    const doAdmin = await service.listar(filtro(), Perfil.Admin);
    expect(doAdmin.totalItens).toBe(10);
    expect(doProfessor.totalItens).toBe(9);
    expect(
      doProfessor.itens.some((e) => e.status === StatusEquipamento.Inativo),
    ).toBe(false);
  });

  it('pagina em ordem alfabética', async () => {
    const pagina = await service.listar(
      filtro({ pagina: 2, itensPorPagina: 4 }),
    );
    expect(pagina.itens).toHaveLength(4);
    expect(pagina).toMatchObject({ paginaAtual: 2, totalPaginas: 3 });
    const nomes = (await service.listar(filtro())).itens.map((e) => e.nome);
    expect(nomes).toEqual(
      [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    );
  });

  it('filtra por busca (nome ou patrimônio), categoria e status', async () => {
    expect(
      (await service.listar(filtro({ busca: 'notebook' }))).totalItens,
    ).toBe(2);
    expect(
      (await service.listar(filtro({ busca: 'pat-0002' }))).itens[0].id,
    ).toBe(EQUIPAMENTO_IDS.projetor);
    const ferramentas = await service.listar(
      filtro({ categoria: CategoriaEquipamento.Ferramenta }),
    );
    expect(ferramentas.totalItens).toBe(2);
    const emManutencao = await service.listar(
      filtro({ status: StatusEquipamento.EmManutencao }),
    );
    expect(emManutencao.itens.map((e) => e.id)).toEqual([
      EQUIPAMENTO_IDS.parafusadeira,
    ]);
  });

  it('apenasDisponiveis traz só itens disponíveis e com saldo', async () => {
    const { itens } = await service.listar(filtro({ apenasDisponiveis: true }));
    expect(itens.length).toBeGreaterThan(0);
    expect(
      itens.every(
        (e) =>
          e.status === StatusEquipamento.Disponivel &&
          e.quantidadeDisponivel > 0,
      ),
    ).toBe(true);
  });

  it('obterPorId: 404 para id inexistente e para item oculto do professor', async () => {
    await expect(service.obterPorId('nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.obterPorId(EQUIPAMENTO_IDS.cortadoraLaser),
    ).rejects.toBeInstanceOf(NotFoundException);
    const comoAdmin = await service.obterPorId(
      EQUIPAMENTO_IDS.cortadoraLaser,
      Perfil.Admin,
    );
    expect(comoAdmin.status).toBe(StatusEquipamento.Inativo);
  });

  it('acha o patrimônio ignorando maiúsculas e espaços', async () => {
    const achado = await repositorio.buscarPorCodigoPatrimonio('  pat-0001 ');
    expect(achado?.id).toBe(EQUIPAMENTO_IDS.notebookDell);
    expect(await repositorio.buscarPorCodigoPatrimonio('PAT-9999')).toBeNull();
  });
});
