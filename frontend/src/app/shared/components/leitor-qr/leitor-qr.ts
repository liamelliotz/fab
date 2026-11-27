import { Component, ElementRef, OnDestroy, output, signal, viewChild } from '@angular/core';

type Estado = 'fechado' | 'abrindo' | 'lendo' | 'erro';

/**
 * LEITOR DE QR PELA CÂMERA (webcam do computador ou câmera do celular).
 * Lê o QR que o professor mostra no celular e emite o texto lido em `(lido)`.
 * O decodificador (jsQR) só é baixado quando a câmera é aberta. Sem câmera ou sem permissão,
 * explica o motivo e o código continua podendo ser digitado.
 */
@Component({
  selector: 'app-leitor-qr',
  standalone: true,
  templateUrl: './leitor-qr.html',
  styleUrl: './leitor-qr.css',
})
export class LeitorQr implements OnDestroy {
  readonly lido = output<string>();
  readonly estado = signal<Estado>('fechado');
  readonly mensagem = signal('');

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream?: MediaStream;
  private quadro = 0;
  private canvas?: HTMLCanvasElement;

  async abrir(): Promise<void> {
    if (this.estado() === 'abrindo' || this.estado() === 'lendo') return;
    this.mensagem.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.falhar('Este navegador não dá acesso à câmera. A câmera só funciona em localhost ou HTTPS.');
      return;
    }
    this.estado.set('abrindo');
    try {
      const [{ default: jsQR }, stream] = await Promise.all([
        import('jsqr'),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
      ]);
      this.stream = stream;
      this.estado.set('lendo');
      // Espera o <video> aparecer no template
      await new Promise((r) => setTimeout(r));
      const video = this.video()?.nativeElement;
      if (!video) return this.fechar();
      video.srcObject = stream;
      await video.play();
      this.canvas = document.createElement('canvas');
      const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      const ler = () => {
        if (this.estado() !== 'lendo' || !ctx) return;
        if (video.readyState >= 2 && video.videoWidth) {
          this.canvas!.width = video.videoWidth;
          this.canvas!.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
          const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (qr?.data) {
            navigator.vibrate?.(80);
            this.fechar();
            this.lido.emit(qr.data);
            return;
          }
        }
        this.quadro = requestAnimationFrame(ler);
      };
      this.quadro = requestAnimationFrame(ler);
    } catch (e) {
      const nome = (e as DOMException)?.name;
      this.falhar(
        nome === 'NotAllowedError'
          ? 'O acesso à câmera foi negado. Libere a câmera no ícone de cadeado do navegador ou digite o código.'
          : nome === 'NotFoundError' || nome === 'OverconstrainedError'
            ? 'Nenhuma câmera encontrada neste computador. Digite o código ou use um leitor USB.'
            : 'Não foi possível abrir a câmera. Digite o código ou use um leitor USB.',
      );
    }
  }

  fechar(): void {
    // No servidor (pré-renderização) não existe câmera nem animação de quadros
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.quadro);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    if (this.estado() !== 'erro') this.estado.set('fechado');
  }

  private falhar(msg: string): void {
    this.fechar();
    this.mensagem.set(msg);
    this.estado.set('erro');
  }

  ngOnDestroy(): void {
    this.fechar();
  }
}
