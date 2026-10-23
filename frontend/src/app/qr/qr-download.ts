import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { QrDesign } from './design';
import { DEFAULT_PNG_SIZE, DownloadFormat, PNG_SIZES, downloadQr } from './download';

/** Elegir formato (y tamaño si es PNG) y descargar el QR. */
@Component({
  selector: 'app-qr-download',
  template: `
    <div class="qr-download">
      <label class="field field--inline">
        <span>Formato</span>
        <select [value]="format()" (change)="format.set(selected($event) === 'svg' ? 'svg' : 'png')">
          <option value="png">PNG</option>
          <option value="svg">SVG (vectorial)</option>
        </select>
      </label>
      @if (format() === 'png') {
        <label class="field field--inline">
          <span>Tamaño</span>
          <select [value]="pixels()" (change)="pixels.set(+selected($event))">
            @for (size of sizes; track size) {
              <option [value]="size">{{ size }} × {{ size }} px</option>
            }
          </select>
        </label>
      }
      <button type="button" class="button" [disabled]="busy() || !value().trim()" (click)="download()">
        Descargar
      </button>
    </div>
    @if (error()) {
      <p class="message message--error" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    .qr-download {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrDownload {
  readonly name = input.required<string>();
  readonly value = input.required<string>();
  readonly design = input.required<QrDesign>();

  protected readonly sizes = PNG_SIZES;
  protected readonly format = signal<DownloadFormat>('png');
  protected readonly pixels = signal(DEFAULT_PNG_SIZE);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected selected(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected async download(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await downloadQr(this.name(), this.value(), this.design(), this.format(), this.pixels());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se ha podido descargar el QR.');
    } finally {
      this.busy.set(false);
    }
  }
}
