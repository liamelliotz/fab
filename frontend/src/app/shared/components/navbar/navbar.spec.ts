import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Navbar } from './navbar';

// Cria a navbar simulando um usuário logado com o perfil informado
function criarNavbar(perfil: string): { fixture: ComponentFixture<Navbar>; element: HTMLElement } {
  localStorage.setItem('fab_token', 'teste');
  localStorage.setItem('fab_role', perfil);
  const fixture = TestBed.createComponent(Navbar);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const rotulos = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('a.navbar__link .navbar__label')).map((el) =>
    el.textContent?.trim(),
  );

describe('Navbar', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    const { fixture } = criarNavbar('admin');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the 6 navigation links in the expected order for admin', () => {
    const { element } = criarNavbar('admin');
    expect(rotulos(element)).toEqual([
      'Dashboard',
      'Solicitações',
      'Empréstimos',
      'Relatórios',
      'Materiais',
      'Configurações',
    ]);
  });

  it('should hide admin-only links for regular users', () => {
    const { element } = criarNavbar('usuario');
    expect(rotulos(element)).toEqual(['Dashboard', 'Materiais', 'Configurações']);
  });

  it('should render the logout button', () => {
    const { element } = criarNavbar('usuario');
    expect(element.querySelector('button.navbar__sair')).not.toBeNull();
  });
});