import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogoDirective } from './dialogo.directive';

@Component({
  standalone: true,
  imports: [DialogoDirective],
  template: `
    <button id="abrir" type="button" (click)="aberto.set(true)">Abrir</button>
    @if (aberto()) {
      <div role="dialog" aria-modal="true" appDialogo (fecharDialogo)="aberto.set(false)">
        <button id="primeiro" type="button">Primeiro</button>
        <button id="ultimo" type="button">Último</button>
      </div>
    }
  `,
})
class Hospedeiro {
  readonly aberto = signal(false);
}

function tecla(alvo: Element, key: string, shiftKey = false): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  alvo.dispatchEvent(evento);
  return evento;
}

describe('DialogoDirective', () => {
  function abrir() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const botao = fixture.nativeElement.querySelector('#abrir') as HTMLButtonElement;
    document.body.appendChild(fixture.nativeElement);
    botao.focus();
    botao.click();
    fixture.detectChanges();
    return { fixture, botao };
  }

  it('leva o foco para o primeiro botão ao abrir', () => {
    const { fixture } = abrir();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#primeiro'));
  });

  it('prende o Tab dentro do diálogo nos dois sentidos', () => {
    const { fixture } = abrir();
    const primeiro = fixture.nativeElement.querySelector('#primeiro') as HTMLElement;
    const ultimo = fixture.nativeElement.querySelector('#ultimo') as HTMLElement;

    ultimo.focus();
    expect(tecla(ultimo, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(primeiro);

    expect(tecla(primeiro, 'Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(ultimo);
  });

  it('fecha com Esc e devolve o foco para quem abriu', () => {
    const { fixture, botao } = abrir();
    tecla(fixture.nativeElement.querySelector('#primeiro'), 'Escape');
    fixture.detectChanges();
    expect(fixture.componentInstance.aberto()).toBe(false);
    expect(document.activeElement).toBe(botao);
  });
});
