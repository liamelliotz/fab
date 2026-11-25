import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UsuarioAutenticado } from '../auth/decorators/usuario-atual.decorator.js';
import {
  CategoriaEquipamento,
  Perfil,
  StatusEmprestimo,
  StatusEquipamento,
  StatusUsuario,
  TipoEventoEmprestimo,
} from '../common/enums/index.js';
import { hojeIso, somarDias } from '../common/utils/data.util.js';
import type { Equipamento } from '../equipamentos/entities/equipamento.entity.js';
import { EquipamentosRepository } from '../equipamentos/equipamentos.repository.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import { UsuariosRepository } from '../usuarios/usuarios.repository.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { SolicitarEmprestimoDto } from './dto/solicitar-emprestimo.dto.js';
import { EmprestimosRepository } from './emprestimos.repository.js';
import { EmprestimosService } from './emprestimos.service.js';

function novoEquipamento(
  dados: Partial<Equipamento> & { id: string },
): Equipamento {
  return {
    nome: `Equipamento ${dados.id}`,
    descricao: 'Item de teste',
    codigoPatrimonio: `PAT-${dados.id}`,
    categoria: CategoriaEquipamento.Eletronico,
    status: StatusEquipamento.Disponivel,
    localizacao: 'Bancada 01',
    requerTreinamento: false,
    prazoMaximoDias: 7,
    quantidadeTotal: 5,
    quantidadeDisponivel: 5,
    criadoEm: new Date().toISOString(),
    ...dados,
  };
}

describe('EmprestimosService: solicitar', () => {
  let emprestimosRepo: EmprestimosRepository;
  let equipamentosRepo: EquipamentosRepository;
  let usuariosRepo: UsuariosRepository;
  let service: EmprestimosService;
  let sub: string;
  let token: UsuarioAutenticado;

  const hoje = hojeIso();
  const retirada = somarDias(hoje, 1);

  function pedido(
    itens: SolicitarEmprestimoDto['itens'],
    dias = 2,
  ): SolicitarEmprestimoDto {
    return {
      itens,
      justificativa: 'Aula de eletrônica do 3º ano',
      dataPrevistaRetirada: retirada,
      dataPrevistaDevolucao: somarDias(retirada, dias),
    };
  }

  beforeEach(async () => {
    emprestimosRepo = new EmprestimosRepository();
    await emprestimosRepo.onModuleInit();
    equipamentosRepo = new EquipamentosRepository();
    usuariosRepo = new UsuariosRepository();
    const equipamentosService = new EquipamentosService(equipamentosRepo);
    const usuariosService = new UsuariosService(usuariosRepo, equipamentosService);

    await equipamentosRepo.criar(
      novoEquipamento({
        id: 'multimetro',
        nome: 'Multímetro',
        prazoMaximoDias: 7,
      }),
    );
    await equipamentosRepo.criar(
      novoEquipamento({ id: 'projetor', nome: 'Projetor', prazoMaximoDias: 3 }),
    );
    await equipamentosRepo.criar(
      novoEquipamento({
        id: 'impressora',
        nome: 'Impressora 3D',
        requerTreinamento: true,
        prazoMaximoDias: 5,
      }),
    );

    const solicitante = await usuariosService.criar({
      nome: 'João',
      email: 'joao@teste.com',
      cpf: '52998224725',
      senha: 'Senha@123',
      perfil: Perfil.Usuario,
      status: StatusUsuario.Ativo,
    });
    sub = solicitante.id;
    token = { sub, email: 'joao@teste.com', perfil: Perfil.Usuario };

    service = new EmprestimosService(
      emprestimosRepo,
      usuariosService,
      equipamentosService,
    );
  });

  it('caso feliz: grava pendente, com protocolo, responsável e evento solicitado', async () => {
    const r = await service.solicitar(
      pedido([{ equipamentoId: 'multimetro', quantidade: 1 }]),
      token,
    );
    expect(r.status).toBe(StatusEmprestimo.Pendente);
    expect(r.protocolo).toMatch(/^EMP-\d{4}-\d{4}$/);
    expect(r.solicitante?.id).toBe(sub);
    expect(r.responsavel?.id).toBe(sub);
    expect(r.historico).toHaveLength(1);
    expect(r.historico[0].tipo).toBe(TipoEventoEmprestimo.Solicitado);
    expect(r.historico[0].por?.id).toBe(sub);
  });

  it('Projetor (prazo 3) por 5 dias: 400 com a data limite na mensagem', async () => {
    const limite = somarDias(retirada, 3);
    await expect(
      service.solicitar(
        pedido([{ equipamentoId: 'projetor', quantidade: 1 }], 5),
        token,
      ),
    ).rejects.toThrow(limite);
  });

  it('Impressora 3D sem habilitação: 409', async () => {
    await expect(
      service.solicitar(
        pedido([{ equipamentoId: 'impressora', quantidade: 1 }]),
        token,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('Impressora 3D com habilitação: passa', async () => {
    await usuariosRepo.atualizar(sub, { habilitacoes: ['impressora'] });
    const r = await service.solicitar(
      pedido([{ equipamentoId: 'impressora', quantidade: 1 }]),
      token,
    );
    expect(r.status).toBe(StatusEmprestimo.Pendente);
  });

  it('equipamento inexistente: 404', async () => {
    await expect(
      service.solicitar(
        pedido([{ equipamentoId: 'nao-existe', quantidade: 1 }]),
        token,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('equipamento indisponível: 409', async () => {
    await equipamentosRepo.atualizar('multimetro', {
      status: StatusEquipamento.EmManutencao,
    });
    await expect(
      service.solicitar(
        pedido([{ equipamentoId: 'multimetro', quantidade: 1 }]),
        token,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('retirada no passado: 400', async () => {
    const dto = pedido([{ equipamentoId: 'multimetro', quantidade: 1 }]);
    dto.dataPrevistaRetirada = somarDias(hoje, -1);
    await expect(service.solicitar(dto, token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('devolução antes da retirada: 400', async () => {
    const dto = pedido([{ equipamentoId: 'multimetro', quantidade: 1 }]);
    dto.dataPrevistaDevolucao = somarDias(retirada, -1);
    await expect(service.solicitar(dto, token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('data inexistente (30/02): 400', async () => {
    const dto = pedido([{ equipamentoId: 'multimetro', quantidade: 1 }]);
    dto.dataPrevistaDevolucao = '2027-02-30';
    await expect(service.solicitar(dto, token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('o estoque não muda depois de solicitar', async () => {
    const antes = await equipamentosRepo.buscarPorId('multimetro');
    await service.solicitar(
      pedido([{ equipamentoId: 'multimetro', quantidade: 2 }]),
      token,
    );
    const depois = await equipamentosRepo.buscarPorId('multimetro');
    expect(depois?.quantidadeDisponivel).toBe(antes?.quantidadeDisponivel);
    expect(depois?.status).toBe(antes?.status);
  });
});
