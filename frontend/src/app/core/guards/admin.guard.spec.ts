import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

function token(perfil: string, exp = Math.floor(Date.now() / 1000) + 3600): string {
  return `e30.${btoa(JSON.stringify({ sub: 'u1', perfil, exp }))}.teste`;
}
function executar(guard = adminGuard) {
  return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
}
function iniciar(jwt: string | null, role = 'admin') {
  if (jwt) sessionStorage.setItem('fab_token', jwt);
  sessionStorage.setItem('fab_role', role);
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
}

describe('Guards e perfil do token', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('após restaurar sessão, fab_role=admin não promove usuário do token', () => {
    iniciar(token('usuario'));
    const auth = TestBed.inject(AuthService);
    expect(auth.perfilAtual()).toBe('usuario');
    const destino = executar();
    expect(TestBed.inject(Router).serializeUrl(destino as never)).toBe('/dashboard');
  });
  it('token admin funciona mesmo com fab_role=usuario', () => {
    iniciar(token('admin'), 'usuario');
    expect(executar()).toBe(true);
    expect(TestBed.inject(AuthService).perfilAtual()).toBe('admin');
  });
  for (const jwt of [null, 'malformado', token('admin', 1), `e30.${btoa('{"perfil":"admin"}')}.teste`]) {
    it(`recusa token ausente, inválido ou expirado: ${jwt?.slice(0, 15) ?? 'ausente'}`, () => {
      iniciar(jwt);
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(executar() as never)).toBe('/login');
      expect(router.serializeUrl(executar(authGuard) as never)).toBe('/login');
    });
  }
});
