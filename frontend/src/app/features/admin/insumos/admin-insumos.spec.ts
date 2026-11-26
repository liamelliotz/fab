import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

describe('Navegação de Insumos', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter(routes)] });
  });
  afterEach(() => localStorage.clear());
  it('admin abre a gestão de insumos e encontra o item no menu', async () => {
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    const harness = await RouterTestingHarness.create('/admin/insumos');
    expect(TestBed.inject(Router).url).toBe('/admin/insumos');
    expect(harness.routeNativeElement?.textContent).toContain('Filamento PLA 1,75 mm');
    expect(harness.routeNativeElement?.textContent).toContain('A repor');
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/insumos"]')).not.toBeNull();
  });
  it('professor não entra mesmo alterando fab_role para admin', async () => {
    TestBed.inject(AuthService).entrarComoDemo('usr-professor');
    sessionStorage.setItem('fab_role', 'admin');
    const harness = await RouterTestingHarness.create('/admin/insumos');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/insumos"]')).toBeNull();
  });
});
