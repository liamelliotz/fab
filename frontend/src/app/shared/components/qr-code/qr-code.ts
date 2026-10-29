import { Component, computed, input } from '@angular/core';
import { gerarDesenhoQr } from '../../../core/utils/qrcode.utils';

/**
 * Desenha um QR Code (SVG, sem biblioteca externa).
 * Uso: <app-qr-code [valor]="'FAB:R:EMP-2026-0042:K7M4PX'" [tamanho]="160" />
 * O texto pode ter até 106 bytes.
 */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  templateUrl: './qr-code.html',
  styleUrl: './qr-code.css',
})
export class QrCode {
  readonly valor = input.required<string>();
  readonly tamanho = input(160);
  readonly rotulo = input('Código QR');

  protected readonly desenho = computed(() => gerarDesenhoQr(this.valor()));
}
