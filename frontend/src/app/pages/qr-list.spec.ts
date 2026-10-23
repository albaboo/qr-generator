import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { defaultDesign, SavedQr } from '../qr/design';
import { QrApi } from '../qr/qr-api';
import { QrList } from './qr-list';

describe('QrList', () => {
  let fixture: ComponentFixture<QrList>;
  let list: ReturnType<typeof vi.fn>;
  const saved: SavedQr = {
    id: 'abc',
    name: 'Web',
    value: 'https://example.com',
    design: defaultDesign(),
    createdAt: '2026-10-16T10:00:00.000Z',
    updatedAt: '2026-10-16T10:00:00.000Z',
  };

  beforeEach(() => {
    list = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: QrApi, useValue: { list } }] });
  });

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(QrList);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function createLinks(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('a[href="/nuevo"]')).map((link) => link.textContent?.trim() ?? '');
  }

  it('sin QR guardados muestra un único botón para crear', async () => {
    list.mockResolvedValue([]);
    expect(createLinks(await render())).toEqual(['Crear un QR']);
  });

  it('con QR guardados muestra «Nuevo QR» junto al título', async () => {
    list.mockResolvedValue([saved]);
    const element = await render();
    expect(createLinks(element)).toEqual(['Nuevo QR']);
    expect(element.querySelector('.qr-card__name')?.textContent).toBe('Web');
  });

  it('si el servidor falla avisa y deja crear igualmente', async () => {
    list.mockRejectedValue(new Error('sin red'));
    const element = await render();
    expect(element.textContent).toContain('¿Está el servidor en marcha?');
    expect(createLinks(element)).toEqual(['Nuevo QR']);
  });
});
