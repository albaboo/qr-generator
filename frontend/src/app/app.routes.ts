import { CanDeactivateFn, Routes } from '@angular/router';
import { QrEditor } from './pages/qr-editor';
import { QrList } from './pages/qr-list';

/** Al salir del editor con cambios sin guardar, pide confirmación. */
const confirmUnsaved: CanDeactivateFn<QrEditor> = (editor) =>
  !editor.hasUnsavedChanges() || confirm('Hay cambios sin guardar. ¿Salir de todos modos?');

export const routes: Routes = [
  { path: '', component: QrList, title: 'Mis QR' },
  { path: 'nuevo', component: QrEditor, title: 'Nuevo QR', canDeactivate: [confirmUnsaved] },
  { path: 'qr/:id', component: QrEditor, title: 'Editar QR', canDeactivate: [confirmUnsaved] },
  { path: '**', redirectTo: '' },
];
