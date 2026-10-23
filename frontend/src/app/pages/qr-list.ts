import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SavedQr } from '../qr/design';
import { QrApi } from '../qr/qr-api';
import { QrDownload } from '../qr/qr-download';
import { QrPreview } from '../qr/qr-preview';

/** Página de inicio: los QR guardados, para volver a descargarlos, editarlos o borrarlos. */
@Component({
  selector: 'app-qr-list',
  imports: [DatePipe, RouterLink, QrDownload, QrPreview],
  template: `
    <div class="page-header">
      <h1>Mis QR</h1>
      <!-- Con la lista vacía el único botón para crear es el del aviso. Sin servidor no hay aviso, pero se puede descargar. -->
      @if (qrs()?.length || error()) {
        <a class="button" routerLink="/nuevo">Nuevo QR</a>
      }
    </div>

    @if (error()) {
      <p class="message message--error" role="alert">{{ error() }}</p>
    }

    @if (qrs(); as qrs) {
      @if (qrs.length === 0) {
        <div class="empty card">
          <p>
            Todavía no tienes ningún QR. Crea uno a partir de un enlace, personalízalo y guárdalo para descargarlo
            cuando quieras.
          </p>
          <a class="button" routerLink="/nuevo">Crear un QR</a>
        </div>
      } @else {
        <ul class="qr-grid">
          @for (qr of qrs; track qr.id) {
            <li class="card qr-card">
              <a class="qr-card__preview" [routerLink]="['/qr', qr.id]" [attr.aria-label]="'Editar ' + qr.name">
                <app-qr-preview [value]="qr.value" [design]="qr.design" [label]="''" />
              </a>
              <h2 class="qr-card__name">{{ qr.name }}</h2>
              <p class="qr-card__value" [title]="qr.value">{{ qr.value }}</p>
              <p class="qr-card__date">Modificado el {{ qr.updatedAt | date: "d 'de' MMMM 'de' y, HH:mm" }}</p>
              <app-qr-download [name]="qr.name" [value]="qr.value" [design]="qr.design" />
              <div class="actions">
                <a class="button button--secondary" [routerLink]="['/qr', qr.id]">Editar</a>
                <button type="button" class="button button--danger" (click)="remove(qr)">Borrar</button>
              </div>
            </li>
          }
        </ul>
      }
    } @else if (!error()) {
      <p role="status">Cargando…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrList implements OnInit {
  private readonly api = inject(QrApi);

  protected readonly qrs = signal<SavedQr[] | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.qrs.set(await this.api.list());
    } catch {
      this.error.set('No se han podido cargar los QR guardados. ¿Está el servidor en marcha?');
    }
  }

  protected async remove(qr: SavedQr): Promise<void> {
    if (!confirm(`¿Borrar «${qr.name}»? No se puede deshacer.`)) {
      return;
    }
    try {
      await this.api.remove(qr.id);
      this.qrs.update((qrs) => qrs?.filter((item) => item.id !== qr.id) ?? null);
    } catch {
      this.error.set(`No se ha podido borrar «${qr.name}».`);
    }
  }
}
