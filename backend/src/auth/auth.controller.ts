import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MensagemResposta } from '../common/interceptors/mensagem-resposta.decorator.js';
import { AuthService } from './auth.service.js';
import { Public, UsuarioAtual } from './decorators/index.js';
import { LoginDto } from './dto/login.dto.js';
import { RecuperarSenhaDto, RedefinirSenhaDto } from './dto/senha.dto.js';
import {
  MENSAGEM_RECUPERACAO,
  RedefinicaoSenhaService,
} from './senha/redefinicao-senha.service.js';
import { ApiErros } from '../common/swagger/api-erros.decorator.js';

/** Tentativas de login por minuto, por IP. Protege contra adivinhação de senha. */
export const LIMITE_DE_LOGIN = { limit: 5, ttl: 60_000 };

/** Pedidos de "esqueci minha senha" por minuto, por IP. */
export const LIMITE_DE_RECUPERACAO = { limit: 3, ttl: 60_000 };

/** Tentativas de redefinir a senha por minuto, por IP. */
export const LIMITE_DE_REDEFINICAO = { limit: 10, ttl: 60_000 };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RedefinicaoSenhaService)
    private readonly senhas: RedefinicaoSenhaService,
  ) {}

  @Post('login')
  @ApiErros(400, 401, 403, 429)
  @Public()
  @Throttle({ default: LIMITE_DE_LOGIN })
  @HttpCode(HttpStatus.OK)
  @MensagemResposta('Login realizado.')
  @ApiOperation({ summary: 'Entra no sistema e devolve o token JWT.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiErros(401)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado.' })
  me(@UsuarioAtual('sub') usuarioId: string) {
    return this.authService.me(usuarioId);
  }

  @Post('recuperar-senha')
  @ApiErros(400, 429)
  @Public()
  @Throttle({ default: LIMITE_DE_RECUPERACAO })
  @HttpCode(HttpStatus.OK)
  @MensagemResposta(MENSAGEM_RECUPERACAO)
  @ApiOperation({
    summary:
      'Pede um link de redefinição. A resposta é sempre a mesma, exista o e-mail ou não.',
  })
  async recuperarSenha(@Body() dto: RecuperarSenhaDto): Promise<void> {
    await this.senhas.recuperar(dto.email);
  }

  @Post('redefinir-senha')
  @ApiErros(400, 429)
  @Public()
  @Throttle({ default: LIMITE_DE_REDEFINICAO })
  @HttpCode(HttpStatus.OK)
  @MensagemResposta('Senha redefinida. Entre com a nova senha.')
  @ApiOperation({
    summary: 'Troca a senha com o token do link (uso único, vale 30 min).',
  })
  async redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<void> {
    await this.senhas.redefinir(dto.token, dto.novaSenha);
  }
}
