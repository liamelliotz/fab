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

/** Tentativas de login por minuto, por IP. Protege contra adivinhação de senha. */
export const LIMITE_DE_LOGIN = { limit: 5, ttl: 60_000 };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @Throttle({ default: LIMITE_DE_LOGIN })
  @HttpCode(HttpStatus.OK)
  @MensagemResposta('Login realizado.')
  @ApiOperation({ summary: 'Entra no sistema e devolve o token JWT.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado.' })
  me(@UsuarioAtual('sub') usuarioId: string) {
    return this.authService.me(usuarioId);
  }
}
