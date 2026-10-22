import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { obterExpiracaoJwt, obterSegredoJwt } from './strategies/jwt.config.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    // UsuariosService: usado pelo JwtStrategy (e pelo login, no Card 5).
    UsuariosModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtService (assinar tokens) já configurado com o segredo e a validade do .env.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: obterSegredoJwt(config),
        signOptions: {
          expiresIn: obterExpiracaoJwt(config) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Proteção global: a partir daqui TODA rota da API pede token (use @Public() para liberar).
    // A ordem importa: primeiro confere o token, depois o perfil (@Roles).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
