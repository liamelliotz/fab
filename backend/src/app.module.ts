import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { EmprestimosModule } from './emprestimos/emprestimos.module.js';
import { EquipamentosModule } from './equipamentos/equipamentos.module.js';
import { ManutencoesModule } from './manutencoes/manutencoes.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

/**
 * Módulo raiz do backend do FAB.
 *
 * ATENÇÃO (evita conflito de merge): todos os módulos do plano já estão registrados aqui.
 * Quem for criar uma rota ou um serviço edita só a pasta do próprio módulo, não este arquivo.
 */
@Module({
  imports: [
    // Carrega o .env e deixa as variáveis disponíveis em todo o app (via ConfigService),
    // sem precisar importar o ConfigModule de novo em cada módulo.
    ConfigModule.forRoot({ isGlobal: true }),

    // Limite de requisições: 100 por minuto por IP. Rotas sensíveis (como o login)
    // usam um limite menor com @Throttle(), definido no Card 5.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Habilita tarefas agendadas (@Cron). Usado no controle de atrasos (Card 25).
    ScheduleModule.forRoot(),

    // Módulos do domínio (um por pasta em src/).
    AuthModule,
    UsuariosModule,
    EquipamentosModule,
    EmprestimosModule,
    ManutencoesModule,
    DashboardModule,
    RelatoriosModule,
  ],
  providers: [
    // Ativa o limite de requisições (ThrottlerModule) em todas as rotas.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
