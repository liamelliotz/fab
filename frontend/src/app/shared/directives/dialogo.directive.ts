import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  inject,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** O que dá para focar com o Tab dentro de um diálogo. */
const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Comportamento de diálogo acessível para qualquer painel com `role="dialog"`.
 *
 * - Ao abrir, o foco vai para o elemento com `autofocus` ou para o primeiro campo/botão.
 * - O Tab fica preso dentro do diálogo (não "vaza" para a tela de trás).
 * - Esc emite `(fecharDialogo)`.
 * - Ao fechar, o foco volta para o botão que abriu o diálogo.
 *
 * Uso: `<div role="dialog" aria-modal="true" appDialogo (fecharDialogo)="fechar()">`.
 */
@Directive({ selector: '[appDialogo]', standalone: true })
export class DialogoDirective implements AfterViewInit, OnDestroy {
  readonly fecharDialogo = output<void>();

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly noNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private focoAnterior: HTMLElement | null = null;

  ngAfterViewInit(): void {
    if (!this.noNavegador) return;
    const painel = this.elemento.nativeElement;
    this.focoAnterior = document.activeElement as HTMLElement | null;
    if (!painel.hasAttribute('tabindex')) painel.setAttribute('tabindex', '-1');
    const alvo = painel.querySelector<HTMLElement>('[autofocus]') ?? this.focaveis()[0] ?? painel;
    alvo.focus();
  }

  ngOnDestroy(): void {
    if (!this.noNavegador) return;
    const anterior = this.focoAnterior;
    if (anterior && document.contains(anterior)) anterior.focus();
  }

  @HostListener('keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      this.fecharDialogo.emit();
      return;
    }
    if (evento.key !== 'Tab') return;

    const focaveis = this.focaveis();
    if (focaveis.length === 0) {
      evento.preventDefault();
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const atual = document.activeElement;
    if (evento.shiftKey && (atual === primeiro || atual === this.elemento.nativeElement)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && atual === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  private focaveis(): HTMLElement[] {
    return Array.from(this.elemento.nativeElement.querySelectorAll<HTMLElement>(FOCAVEIS));
  }
}
