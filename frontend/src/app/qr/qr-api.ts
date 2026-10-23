import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QrDesign, SavedQr, normalizeDesign } from './design';

export interface QrInput {
  name: string;
  value: string;
  design: QrDesign;
}

/** Acceso a los QR guardados en el servidor (`/api/qrs`). */
@Injectable({ providedIn: 'root' })
export class QrApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/qrs';

  async list(): Promise<SavedQr[]> {
    const qrs = await firstValueFrom(this.http.get<SavedQr[]>(this.url));
    return qrs.map(normalize);
  }

  async get(id: string): Promise<SavedQr> {
    return normalize(await firstValueFrom(this.http.get<SavedQr>(`${this.url}/${encodeURIComponent(id)}`)));
  }

  async create(input: QrInput): Promise<SavedQr> {
    return normalize(await firstValueFrom(this.http.post<SavedQr>(this.url, input)));
  }

  async update(id: string, input: QrInput): Promise<SavedQr> {
    return normalize(await firstValueFrom(this.http.put<SavedQr>(`${this.url}/${encodeURIComponent(id)}`, input)));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.url}/${encodeURIComponent(id)}`));
  }
}

/** Los diseños guardados con versiones anteriores se completan con los valores por defecto de los campos nuevos. */
function normalize(qr: SavedQr): SavedQr {
  return { ...qr, design: normalizeDesign(qr.design) };
}
