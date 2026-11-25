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

  // ---------------------------------------------------------------------------------------
  // Card A4: edição, status, habilitações e as três travas
  // Cada teste usa dados novos (o seed é recarregado), para um não interferir no outro.
  // ---------------------------------------------------------------------------------------
  describe('edição e travas (A4)', () => {
    let s: UsuariosService;

    beforeEach(async () => {
      const usuarios = new UsuariosRepository();
      const equipamentos = new EquipamentosRepository();
      await usuarios.onModuleInit();
      await equipamentos.onModuleInit();
      s = new UsuariosService(usuarios, new EquipamentosService(equipamentos));
    });

    const admin = USUARIO_IDS.admin;

    it('atualizar muda só o que foi enviado e dá 404 para quem não existe', async () => {
      const antes = await s.obterPorId(USUARIO_IDS.ana);
      const depois = await s.atualizar(
        USUARIO_IDS.ana,
        { departamento: '  Mecânica ' },
        admin,
      );
      expect(depois).toMatchObject({
        departamento: 'Mecânica',
        nome: antes.nome,
        email: antes.email,
      });
      await expect(
        s.atualizar('nao-existe', { nome: 'X' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trava 1: ninguém muda o status da própria conta', async () => {
      await expect(
        s.alterarStatus(admin, StatusUsuario.Bloqueado, admin),
      ).rejects.toThrow(
        new ConflictException(
          'Você não pode alterar o status da sua própria conta.',
        ),
      );
    });

    it('trava 2: ninguém rebaixa o próprio perfil de admin', async () => {
      await expect(
        s.atualizar(admin, { perfil: Perfil.Usuario }, admin),
      ).rejects.toThrow(
        new ConflictException(
          'Você não pode rebaixar o seu próprio perfil de administrador.',
        ),
      );
      // Mudar outros campos de si mesmo continua liberado.
      await expect(
        s.atualizar(admin, { telefone: '96991110000' }, admin),
      ).resolves.toMatchObject({
        perfil: Perfil.Admin,
      });
    });

    it('trava 3: sempre resta pelo menos um admin ativo', async () => {
      const ultimo = new ConflictException(
        'É preciso manter pelo menos um administrador ativo.',
      );
      // O seed tem um único admin: tirá-lo de cena (por qualquer caminho) é barrado.
      await expect(
        s.alterarStatus(admin, StatusUsuario.Inativo),
      ).rejects.toThrow(ultimo);
      await expect(
        s.atualizar(admin, { perfil: Perfil.Usuario }),
      ).rejects.toThrow(ultimo);

      // Com um segundo admin ativo, o primeiro pode ser rebaixado ou bloqueado.
      await s.atualizar(USUARIO_IDS.carlos, { perfil: Perfil.Admin }, admin);
      await expect(
        s.alterarStatus(admin, StatusUsuario.Bloqueado, USUARIO_IDS.carlos),
      ).resolves.toMatchObject({
        status: StatusUsuario.Bloqueado,
      });
      // Agora o Carlos é o único admin ativo: ele não pode ser rebaixado.
      await expect(
        s.atualizar(USUARIO_IDS.carlos, { perfil: Perfil.Usuario }),
      ).rejects.toThrow(ultimo);
      // Reativar um admin nunca é barrado.
      await expect(
        s.alterarStatus(admin, StatusUsuario.Ativo, USUARIO_IDS.carlos),
      ).resolves.toMatchObject({
        status: StatusUsuario.Ativo,
      });
    });

    it('definirHabilitacoes substitui a lista e confere cada equipamento', async () => {
      const ana = await s.definirHabilitacoes(USUARIO_IDS.ana, [
        EQUIPAMENTO_IDS.osciloscopio,
        EQUIPAMENTO_IDS.osciloscopio,
      ]);
      expect(ana.habilitacoes).toEqual([EQUIPAMENTO_IDS.osciloscopio]);
      expect(
        (await s.definirHabilitacoes(USUARIO_IDS.ana, [])).habilitacoes,
      ).toEqual([]);

      await expect(
        s.definirHabilitacoes(USUARIO_IDS.ana, [EQUIPAMENTO_IDS.projetor]),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        s.definirHabilitacoes(USUARIO_IDS.ana, ['eqp-fantasma']),
      ).rejects.toThrow('O equipamento "eqp-fantasma" não existe.');
      await expect(
        s.definirHabilitacoes('nao-existe', []),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Nada mudou com as tentativas que falharam.
      expect((await s.obterPorId(USUARIO_IDS.ana)).habilitacoes).toEqual([]);
    });
  });
});
