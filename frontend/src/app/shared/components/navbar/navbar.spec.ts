import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Navbar } from './navbar';

describe('Navbar', () => {
  let fixture: ComponentFixture<Navbar>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the 6 navigation links', () => {
    const links = element.querySelectorAll('.navbar__link');
    expect(links.length).toBe(6);
  });

  it('should render the links in the expected order', () => {
    const labels = Array.from(element.querySelectorAll('.navbar__label')).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Dashboard',
      'Solicitações',
      'Empréstimos',
      'Relatórios',
      'Materiais',
      'Configurações',
    ]);
  });
});