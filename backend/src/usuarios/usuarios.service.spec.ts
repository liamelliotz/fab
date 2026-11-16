import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Perfil, StatusUsuario } from '../common/enums/index.js';
import { EQUIPAMENTO_IDS, USUARIO_IDS } from '../common/seed/index.js';
import { EquipamentosRepository } from '../equipamentos/equipamentos.repository.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import { UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

describe('UsuariosService', () => {
  let service: UsuariosService;

  beforeAll(async () => {
    const usuarios = new UsuariosRepository();
    const equipamentos = new EquipamentosRepository();
    await usuarios.onModuleInit(); // seed com o hash das senhas
    await equipamentos.onModuleInit();
    service = new UsuariosService(
      usuarios,
      new EquipamentosService(equipamentos),
    );
  });

  const novo = (n: number) => ({
    nome: `Pessoa ${n}`,
    email: `pessoa${n}@escola.br`,
    cpf: ['86288366757', '04821553023', '71428793860'][n],
    senha: 'senha-de-teste',
  });

  describe('listarPagina', () => {
    it('ordena pelo nome e pagina', async () => {
      const pagina = await service.listarPagina({
        pagina: 1,
        itensPorPagina: 2,
      });
      expect(pagina.itens.map((u) => u.nome)).toEqual([
        'Administrador FAB',
        'Ana Lima',
      ]);
      expect(pagina).toMatchObject({
        totalItens: 6,
        totalPaginas: 3,
        temProxima: true,
      });
    });

    it('filtra por busca, perfil e status', async () => {
      const informatica = await service.listarPagina({
        busca: 'informática',
        pagina: 1,
        itensPorPagina: 10,
      });
      expect(informatica.itens.map((u) => u.nome)).toEqual([
        'Ana Lima',
        'João Silva',
      ]);

      const admins = await service.listarPagina({
        perfil: Perfil.Admin,
        pagina: 1,
        itensPorPagina: 10,
      });
      expect(admins.itens.map((u) => u.id)).toEqual([USUARIO_IDS.admin]);

      const bloqueados = await service.listarPagina({
        status: StatusUsuario.Bloqueado,
        pagina: 1,
        itensPorPagina: 10,
      });
      expect(bloqueados.totalItens).toBe(0);
    });

    it('nunca devolve o senhaHash', async () => {
      const pagina = await service.listarPagina({
        pagina: 1,
        itensPorPagina: 100,
      });
      for (const usuario of pagina.itens) {
        expect(usuario).not.toHaveProperty('senhaHash');
      }
    });
  });

  describe('resumo', () => {
    it('traz só id, nome, departamento e habilitações, em ordem alfabética', async () => {
      const lista = await service.resumo();
      expect(lista).toHaveLength(6);
      expect(lista[0]).toEqual({
        id: USUARIO_IDS.admin,
        nome: 'Administrador FAB',
        departamento: 'Coordenação',
        habilitacoes: [],
      });
      for (const item of lista) {
        expect(Object.keys(item).sort()).toEqual([
          'departamento',
          'habilitacoes',
          'id',
          'nome',
        ]);
      }
    });

    it('deixa de fora quem não está ativo e filtra pela busca', async () => {
      await service.alterarStatus(USUARIO_IDS.carlos, StatusUsuario.Inativo);
      try {
        const ids = (await service.resumo()).map((u) => u.id);
        expect(ids).not.toContain(USUARIO_IDS.carlos);
        expect((await service.resumo('docência')).map((u) => u.id)).toEqual([
          USUARIO_IDS.professor,
        ]);
      } finally {
        await service.alterarStatus(USUARIO_IDS.carlos, StatusUsuario.Ativo);
      }
    });
  });

  it('obterPorId: 404 para id que não existe', async () => {
    await expect(service.obterPorId('nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('criar', () => {
    it('guarda e-mail e CPF normalizados, e a conta consegue entrar', async () => {
      const criado = await service.criar({
        ...novo(0),
        email: '  Pessoa0@Escola.BR ',
        cpf: '862.883.667-57',
        habilitacoes: [
          EQUIPAMENTO_IDS.impressora3d,
          EQUIPAMENTO_IDS.impressora3d,
        ],
      });
      expect(criado).toMatchObject({
        email: 'pessoa0@escola.br',
        cpf: '86288366757',
        perfil: Perfil.Usuario,
        status: StatusUsuario.Ativo,
        habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
      });
      expect(criado).not.toHaveProperty('senhaHash');
      expect(
        await service.validarCredenciais('pessoa0@escola.br', 'senha-de-teste'),
      ).toMatchObject({ id: criado.id });
    });

    it('e-mail ou CPF repetido: 409', async () => {
      await expect(
        service.criar({ ...novo(1), email: 'ADMIN@fab.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.criar({ ...novo(1), cpf: '529.982.247-25' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('habilitação só para equipamento que existe e exige treinamento: 400', async () => {
      await expect(
        service.criar({ ...novo(2), habilitacoes: [EQUIPAMENTO_IDS.projetor] }),
      ).rejects.toThrow(
        new BadRequestException(
          'O equipamento "Projetor Epson PowerLite" não exige treinamento: não precisa de habilitação.',
        ),
      );
      await expect(
        service.criar({ ...novo(2), habilitacoes: ['eqp-fantasma'] }),
      ).rejects.toThrow('O equipamento "eqp-fantasma" não existe.');
      // Nada foi gravado nas tentativas que falharam.
      expect(await service.buscarPorEmail(novo(2).email)).toBeNull();
    });
  });
});
