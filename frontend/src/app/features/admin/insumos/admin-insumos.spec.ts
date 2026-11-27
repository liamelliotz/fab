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
  it('admin abre os insumos dentro do Inventário (o endereço antigo redireciona)', async () => {
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    const harness = await RouterTestingHarness.create('/admin/insumos');
    expect(TestBed.inject(Router).url).toBe('/admin/inventario/insumos');
    expect(harness.routeNativeElement?.textContent).toContain('Filamento PLA 1,75 mm');
    expect(harness.routeNativeElement?.textContent).toContain('A repor');
    // As duas partes do inventário aparecem como abas
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/inventario/equipamentos"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/inventario/insumos"]')).not.toBeNull();
  });
  it('professor não entra mesmo alterando fab_role para admin', async () => {
    TestBed.inject(AuthService).entrarComoDemo('usr-professor');
    sessionStorage.setItem('fab_role', 'admin');
    const harness = await RouterTestingHarness.create('/admin/insumos');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/insumos"]')).toBeNull();
  });
  it('professor: endereços antigos levam ao Inventário e os pedidos de insumo ficam em Meus pedidos', async () => {
    TestBed.inject(AuthService).entrarComoDemo('usr-professor');
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create('/materiais');
    expect(router.url).toBe('/inventario/equipamentos');
    await harness.navigateByUrl('/insumos');
    expect(router.url).toBe('/inventario/insumos');
    expect(harness.routeNativeElement?.textContent).toContain('Disponíveis para pedido');
    await harness.navigateByUrl('/meus-emprestimos?aba=insumos');
    expect(harness.routeNativeElement?.textContent).toContain('Minhas requisições');
    expect(harness.routeNativeElement?.textContent).toContain('REQ-');
  });
  it('coordenação vê as requisições de insumo em Solicitações', async () => {
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    const harness = await RouterTestingHarness.create('/admin/solicitacoes?aba=insumos');
    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Aguardando aprovação');
    expect(texto).toContain('Papel A4 75 g');
  });
});
