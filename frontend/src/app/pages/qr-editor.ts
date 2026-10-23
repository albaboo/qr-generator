import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { designWarnings } from '../qr/contrast';
import {
  BORDER_WIDTH,
  BorderDesign,
  BorderStyle,
  EyeShape,
  LOGO_PADDING,
  LOGO_RADIUS,
  LOGO_SIZE,
  LogoDesign,
  ModuleShape,
  QUIET_ZONE,
  QrDesign,
  borderInnerRadiusRange,
  borderOuterRadiusRange,
  cornerRadiusRange,
  defaultDesign,
  normalizeDesign,
} from '../qr/design';
import { LOGO_ACCEPT, prepareLogo } from '../qr/logo-image';
import { QrApi } from '../qr/qr-api';
import { QrDownload } from '../qr/qr-download';
import { QrPreview } from '../qr/qr-preview';

interface Choice<T> {
  value: T;
  label: string;
}

/** Crear un QR (`/nuevo`), editar uno guardado (`/qr/:id`) o crear otro a partir de él (`/qr/:id/clonar`). */
@Component({
  selector: 'app-qr-editor',
  imports: [QrDownload, QrPreview, RouterLink],
  templateUrl: './qr-editor.html',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrEditor implements OnInit {
  private readonly api = inject(QrApi);
  private readonly router = inject(Router);

  /** Parámetro de la ruta: vacío al crear uno nuevo. */
  readonly id = input<string>();
  /** Dato de la ruta de clonar: el QR de `id` solo sirve de punto de partida y al guardar se crea otro. */
  readonly clone = input(false);

  /** El QR que se modifica al guardar; ninguno si se está creando (también al clonar). */
  protected readonly editingId = computed(() => (this.clone() ? undefined : this.id()));
  protected readonly title = computed(() => (this.clone() ? 'Clonar QR' : this.id() ? 'Editar QR' : 'Nuevo QR'));
  protected readonly saveLabel = computed(() => (this.clone() ? 'Crear copia' : 'Guardar'));

  protected readonly name = signal('');
  protected readonly value = signal('https://');
  protected readonly design = signal<QrDesign>(defaultDesign());
  /** El color de los ojos sigue al de los módulos mientras no se elija otro. */
  protected readonly eyeColorLinked = signal(true);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  protected readonly message = signal<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  protected readonly logoError = signal<string | null>(null);

  protected readonly warnings = computed(() => designWarnings(this.design()));
  protected readonly cornerRadius = computed(() => cornerRadiusRange(this.design()));
  protected readonly borderOuterRadius = computed(() => borderOuterRadiusRange(this.design()));
  protected readonly borderInnerRadius = computed(() => borderInnerRadiusRange(this.design()));
  protected readonly canSave = computed(
    () => this.name().trim() !== '' && this.value().trim() !== '' && !this.saving(),
  );

  protected readonly ranges = {
    quietZone: QUIET_ZONE,
    borderWidth: BORDER_WIDTH,
    logoSize: LOGO_SIZE,
    logoPadding: LOGO_PADDING,
    logoRadius: LOGO_RADIUS,
  };
  protected readonly logoAccept = LOGO_ACCEPT;
  protected readonly moduleShapes: Choice<ModuleShape>[] = [
    { value: 'square', label: 'Cuadrados' },
    { value: 'rounded', label: 'Redondeados' },
    { value: 'rounded-joined', label: 'Redondeados unidos' },
    { value: 'dot', label: 'Puntos' },
    { value: 'dot-joined', label: 'Puntos unidos' },
  ];
  protected readonly borderStyles: Choice<BorderStyle>[] = [
    { value: 'solid', label: 'Continua' },
    { value: 'double', label: 'Doble' },
    { value: 'dashed', label: 'Discontinua' },
    { value: 'dotted', label: 'De puntos' },
  ];
  protected readonly eyeShapes: Choice<EyeShape>[] = [
    { value: 'square', label: 'Cuadrados' },
    { value: 'rounded', label: 'Redondeados' },
    { value: 'circle', label: 'Círculos' },
  ];

  async ngOnInit(): Promise<void> {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    try {
      const qr = await this.api.get(id);
      this.name.set(this.clone() ? `Copia de ${qr.name}` : qr.name);
      this.value.set(qr.value);
      this.design.set(qr.design);
      this.eyeColorLinked.set(qr.design.eyeColor === qr.design.foreground);
      if (this.clone()) {
        this.message.set({
          kind: 'info',
          text: `Copia de «${qr.name}»: cambia lo que quieras y pulsa «Crear copia». El original no se modifica.`,
        });
      } else if (this.router.lastSuccessfulNavigation()?.extras.state?.['saved']) {
        this.message.set({ kind: 'success', text: 'Guardado.' });
      }
    } catch {
      this.message.set({ kind: 'error', text: 'No se ha encontrado este QR. Puede que se haya borrado.' });
    } finally {
      this.loading.set(false);
    }
  }

  /** Para el guard de salida: hay cambios sin guardar. */
  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  /** Al cerrar o recargar la pestaña con cambios sin guardar, el navegador pide confirmación. */
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
    }
  }

  protected setName(event: Event): void {
    this.name.set(text(event));
    this.touch();
  }

  protected setValue(event: Event): void {
    this.value.set(text(event));
    this.touch();
  }

  protected patch(changes: Partial<QrDesign>): void {
    this.design.update((design) => {
      const next = { ...design, ...changes };
      if (this.eyeColorLinked()) {
        next.eyeColor = next.foreground;
      }
      // Al quitar el borde o reducir la zona de silencio el radio puede quedarse por encima del nuevo máximo.
      return normalizeDesign(next);
    });
    this.touch();
  }

  protected patchBorder(changes: Partial<BorderDesign>): void {
    this.patch({ border: { ...this.design().border, ...changes } });
  }

  protected patchLogo(changes: Partial<LogoDesign>): void {
    this.patch({ logo: { ...this.design().logo, ...changes } });
  }

  protected linkEyeColor(linked: boolean): void {
    this.eyeColorLinked.set(linked);
    this.patch({});
  }

  protected swapColors(): void {
    const { foreground, background } = this.design();
    this.patch({
      foreground: background,
      background: foreground,
      eyeColor: this.eyeColorLinked() ? background : this.design().eyeColor,
    });
  }

  protected reset(): void {
    const image = this.design().logo.image;
    const design = defaultDesign();
    design.logo.image = image;
    this.eyeColorLinked.set(true);
    this.design.set(design);
    this.touch();
  }

  protected async uploadLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.logoError.set(null);
    try {
      this.patchLogo({ enabled: true, image: await prepareLogo(file) });
    } catch (error) {
      this.logoError.set(error instanceof Error ? error.message : 'No se ha podido usar esa imagen.');
    }
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    const input = { name: this.name().trim(), value: this.value().trim(), design: this.design() };
    try {
      const id = this.editingId();
      if (id) {
        await this.api.update(id, input);
      } else {
        const created = await this.api.create(input);
        this.dirty.set(false);
        // Otra ruta, así que se crea otro editor: le pasa el aviso de «Guardado» en el estado de la navegación.
        await this.router.navigate(['/qr', created.id], { replaceUrl: true, state: { saved: true } });
        return;
      }
      this.dirty.set(false);
      this.message.set({ kind: 'success', text: 'Guardado.' });
    } catch {
      this.message.set({ kind: 'error', text: 'No se ha podido guardar. ¿Está el servidor en marcha?' });
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const id = this.editingId();
    if (!id || !confirm(`¿Borrar «${this.name().trim() || 'este QR'}»? No se puede deshacer.`)) {
      return;
    }
    try {
      await this.api.remove(id);
      this.dirty.set(false);
      await this.router.navigate(['/']);
    } catch {
      this.message.set({ kind: 'error', text: 'No se ha podido borrar. ¿Está el servidor en marcha?' });
    }
  }

  protected number(event: Event): number {
    return Number(text(event));
  }

  protected text(event: Event): string {
    return text(event);
  }

  protected choice<T extends string>(event: Event, choices: Choice<T>[]): T {
    const value = text(event);
    return (choices.find((choice) => choice.value === value) ?? choices[0]).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected percent(fraction: number): string {
    return `${Math.round(fraction * 100)} %`;
  }

  private touch(): void {
    this.dirty.set(true);
    this.message.set(null);
  }
}

function text(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}
