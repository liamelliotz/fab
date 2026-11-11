import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Perfil, StatusUsuario } from '../common/enums/index.js';
import { USUARIO_IDS } from '../common/seed/index.js';
import { UsuariosRepository } from '../usuarios/usuarios.repository.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthService } from './auth.service.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

describe('AuthService', () => {
  const jwt = new JwtService({
    secret: 'segredo-so-para-os-testes-com-mais-de-32-caracteres',
    signOptions: { expiresIn: '8h' },
  });
  let usuarios: UsuariosService;
  let auth: AuthService;

  beforeAll(async () => {
    const repositorio = new UsuariosRepository();
    await repositorio.onModuleInit(); // gera o hash das senhas do seed
    usuarios = new UsuariosService(repositorio);
    auth = new AuthService(usuarios, jwt);
  });

  it('login certo devolve token, validade em segundos e o usuário sem a senha', async () => {
    const resposta = await auth.login({
      email: 'admin@fab.com',
      senha: 'admin123',
    });
    expect(resposta.tipoToken).toBe('Bearer');
    expect(resposta.expiraEm).toBe(8 * 60 * 60);
    expect(resposta.usuario).toMatchObject({
      id: USUARIO_IDS.admin,
      perfil: Perfil.Admin,
    });
    expect(resposta.usuario).not.toHaveProperty('senhaHash');
    expect(resposta.usuario).not.toHaveProperty('senha');

    const payload = jwt.verify<JwtPayload>(resposta.tokenAcesso);
    expect(payload).toMatchObject({
      sub: USUARIO_IDS.admin,
      email: 'admin@fab.com',
      perfil: 'admin',
    });
  });

  it('aceita o e-mail com maiúsculas e espaços', async () => {
    const resposta = await auth.login({
      email: '  Professor@FAB.com ',
      senha: 'prof123',
    });
    expect(resposta.usuario.id).toBe(USUARIO_IDS.professor);
  });

  it('senha errada e e-mail inexistente dão o MESMO 401', async () => {
    const senhaErrada = auth.login({ email: 'admin@fab.com', senha: 'errada' });
    const emailErrado = auth.login({
      email: 'ninguem@fab.com',
      senha: 'admin123',
    });
    await expect(senhaErrada).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(emailErrado).rejects.toBeInstanceOf(UnauthorizedException);
    const mensagens = await Promise.all(
      [senhaErrada, emailErrado].map((p) => p.catch((e: Error) => e.message)),
    );
    expect(mensagens[0]).toBe(mensagens[1]);
  });

  it('conta inativa ou bloqueada não entra (403), mesmo com a senha certa', async () => {
    await usuarios.alterarStatus(USUARIO_IDS.carlos, StatusUsuario.Bloqueado);
    await expect(
      auth.login({ email: 'carlos@escola.br', senha: 'prof123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await usuarios.alterarStatus(USUARIO_IDS.carlos, StatusUsuario.Ativo);
  });

  it('me devolve o usuário logado, com as habilitações', async () => {
    const eu = await auth.me(USUARIO_IDS.professor);
    expect(eu.email).toBe('professor@fab.com');
    expect(eu.habilitacoes).toHaveLength(1);
    expect(eu).not.toHaveProperty('senhaHash');
  });
});
