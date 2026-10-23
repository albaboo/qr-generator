import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QrDesign } from './design';
import { renderQrSvg, svgDataUrl } from './render';

/**
 * Muestra un QR como imagen: el mismo SVG que se descarga, pasado a data URL. Así no se inserta marcado en la
 * página y lo que se ve es exactamente lo que se guarda.
 */
@Component({
  selector: 'app-qr-preview',
  template: `
    @let result = image();
    @if (result.url) {
      <img class="qr-preview" [src]="result.url" [alt]="label()" />
    } @else {
      <p class="qr-preview qr-preview--empty" role="status">{{ result.error }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .qr-preview {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      margin: 0;
    }
    /* Cuadros grises detrás: solo se ven donde el QR no tiene fondo. */
    img.qr-preview {
      background: repeating-conic-gradient(var(--color-checker) 0 25%, transparent 0 50%) 0 0 / 1rem 1rem;
    }
    .qr-preview--empty {
      display: grid;
      place-items: center;
      padding: 1rem;
      text-align: center;
      border: 2px dashed var(--color-border);
      border-radius: var(--radius);
      color: var(--color-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrPreview {
  readonly value = input.required<string>();
  readonly design = input.required<QrDesign>();
  /** Texto alternativo para lectores de pantalla. */
  readonly label = input.required<string>();

  protected readonly image = computed(() => {
    const value = this.value();
    if (!value.trim()) {
      return { url: null, error: 'Escribe un enlace para ver el QR.' };
    }
    try {
      return { url: svgDataUrl(renderQrSvg(value, this.design())), error: null };
    } catch {
      return { url: null, error: 'El texto es demasiado largo para un QR con logo (máximo unos 1200 caracteres).' };
    }
  });
}
