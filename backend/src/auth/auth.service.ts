import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StatusUsuario } from '../common/enums/index.js';
import type { UsuarioPublico } from '../usuarios/entities/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

/** `dados` do POST /auth/login. Igual ao AuthResponse do front (core/models/auth.model.ts). */
export interface RespostaLogin {
  tokenAcesso: string;
  tipoToken: 'Bearer';
  /** Validade do token, em segundos. */
  expiraEm: number;
  usuario: UsuarioPublico;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsuariosService) private readonly usuarios: UsuariosService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  /**
   * Confere e-mail e senha e devolve o token.
   * - e-mail ou senha errados: 401, com a MESMA mensagem (não revela se o e-mail existe);
   * - conta inativa ou bloqueada: 403.
   */
  async login(dto: LoginDto): Promise<RespostaLogin> {
    const usuario = await this.usuarios.validarCredenciais(
      dto.email,
      dto.senha,
    );
    if (!usuario) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }
    if (usuario.status !== StatusUsuario.Ativo) {
      throw new ForbiddenException('Conta desativada. Procure a coordenação.');
    }

    const tokenAcesso = await this.jwt.signAsync({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    } satisfies JwtPayload);

    const { iat = 0, exp = 0 } = this.jwt.decode<JwtPayload>(tokenAcesso);
    return { tokenAcesso, tipoToken: 'Bearer', expiraEm: exp - iat, usuario };
  }

  /** Dados de quem está logado (GET /auth/me). */
  me(usuarioId: string): Promise<UsuarioPublico> {
    return this.usuarios.obterPorId(usuarioId);
  }
}
