import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { StatusUsuario } from '../../common/enums/index.js';
import { USUARIO_IDS } from '../../common/seed/index.js';
import { EquipamentosRepository } from '../../equipamentos/equipamentos.repository.js';
import { EquipamentosService } from '../../equipamentos/equipamentos.service.js';
import { UsuariosRepository } from '../../usuarios/usuarios.repository.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import {
  RedefinicaoSenhaService,
  VALIDADE_DO_LINK_MS,
  hashDoToken,
} from './redefinicao-senha.service.js';
import { TokensRedefinicaoRepository } from './tokens-redefinicao.repository.js';

describe('RedefinicaoSenhaService (card A5)', () => {
  let usuarios: UsuariosService;
  let tokens: TokensRedefinicaoRepository;
  let ambiente: Record<string, string>;
  let servico: RedefinicaoSenhaService;
  let logs: string[];

  const config = {
    get: (chave: string) => ambiente[chave],
  } as unknown as ConfigService;
  /** Pede o link e devolve o token que apareceu no log. */
  const pedirToken = async (email: string) => {
    await servico.recuperar(email);
    const link = logs.at(-1)?.match(/token=([\w-]+)/);
    return link?.[1] ?? '';
  };

  beforeEach(async () => {
    const repoUsuarios = new UsuariosRepository();
    await repoUsuarios.onModuleInit();
    usuarios = new UsuariosService(
      repoUsuarios,
      new EquipamentosService(new EquipamentosRepository()),
    );
    tokens = new TokensRedefinicaoRepository();
    ambiente = {
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:4200',
    };
    servico = new RedefinicaoSenhaService(usuarios, tokens, config);
    logs = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('gera o link no log e guarda só o hash do token', async () => {
    const token = await pedirToken('Professor@FAB.com');
    expect(logs.at(-1)).toContain(
      'http://localhost:4200/redefinir-senha?token=',
    );
    expect(token).toHaveLength(43); // 32 bytes em base64url

    const salvos = await tokens.listar();
    expect(salvos).toHaveLength(1);
    expect(salvos[0].tokenHash).toBe(hashDoToken(token));
    expect(JSON.stringify(salvos)).not.toContain(token);
    const validade =
      Date.parse(salvos[0].expiraEm) - Date.parse(salvos[0].criadoEm);
    expect(validade).toBe(VALIDADE_DO_LINK_MS);
  });

  it('e-mail inexistente ou conta inativa: nada é gerado e nada vai para o log', async () => {
    await servico.recuperar('ninguem@fab.com');
    await usuarios.alterarStatus(USUARIO_IDS.carlos, StatusUsuario.Inativo);
    const carlos = await usuarios.buscarPorId(USUARIO_IDS.carlos);
    await servico.recuperar(carlos!.email);
    expect(await tokens.listar()).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('em produção o link nunca vai para o log', async () => {
    ambiente.NODE_ENV = 'production';
    await servico.recuperar('professor@fab.com');
    expect(await tokens.listar()).toHaveLength(1);
    expect(logs).toEqual([]);
  });

  it('o token troca a senha uma única vez e a senha antiga para de funcionar', async () => {
    const token = await pedirToken('professor@fab.com');
    await servico.redefinir(token, 'nova-senha-123');
    expect(
      await usuarios.validarCredenciais('professor@fab.com', 'prof123'),
    ).toBeNull();
    expect(
      await usuarios.validarCredenciais('professor@fab.com', 'nova-senha-123'),
    ).not.toBeNull();

    await expect(servico.redefinir(token, 'outra-senha-456')).rejects.toThrow(
      'Este link já foi usado. Peça um novo.',
    );
    expect(
      await usuarios.validarCredenciais('professor@fab.com', 'outra-senha-456'),
    ).toBeNull();
  });

  it('token vencido (mais de 30 min) dá 400 e não troca a senha', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const token = await pedirToken('professor@fab.com');
    vi.setSystemTime(Date.now() + VALIDADE_DO_LINK_MS + 1000);
    await expect(servico.redefinir(token, 'nova-senha-123')).rejects.toThrow(
      'Este link expirou. Peça um novo.',
    );
    expect(
      await usuarios.validarCredenciais('professor@fab.com', 'prof123'),
    ).not.toBeNull();
  });

  it('token inventado dá 400', async () => {
    await expect(
      servico.redefinir('nao-existe', 'nova-senha-123'),
    ).rejects.toThrow('Link de redefinição inválido. Peça um novo.');
  });

  it('trocar a senha invalida os outros links pendentes do usuário', async () => {
    const primeiro = await pedirToken('professor@fab.com');
    const segundo = await pedirToken('professor@fab.com');
    await servico.redefinir(segundo, 'nova-senha-123');
    await expect(
      servico.redefinir(primeiro, 'outra-senha-456'),
    ).rejects.toThrow('já foi usado');
  });

  it('dois pedidos ao mesmo tempo com o mesmo token: só um passa', async () => {
    const token = await pedirToken('professor@fab.com');
    const resultados = await Promise.allSettled([
      servico.redefinir(token, 'senha-um-111'),
      servico.redefinir(token, 'senha-dois-222'),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
