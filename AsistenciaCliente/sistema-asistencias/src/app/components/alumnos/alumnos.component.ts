import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AsistenciaService } from '../../services/asistencia.service';
import { Usuario } from '../../models/models';

@Component({
  selector: 'app-alumnos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './alumnos.component.css',
  template: `
    <div class="alumnos-container">
      <div class="header-card">
        <div class="header-top">
          <div>
            <h2>👩‍🎓 Alumnos</h2>
            <p>Listado de alumnos registrados en el sistema</p>
          </div>
          <button class="btn-nuevo" (click)="abrirModalNuevo()">
            ➕ Nuevo Alumno
          </button>
        </div>
      </div>

      <div *ngIf="cargando" class="loading">Cargando alumnos...</div>

      <div class="tabla-wrapper" *ngIf="!cargando">
        <table class="tabla-alumnos" *ngIf="alumnos.length > 0">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Edad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of alumnos">
              <td><strong>{{a.nombre}}</strong></td>
              <td>{{a.correo}}</td>
              <td>{{a.edad}}</td>
              <td class="acciones-col">
                <button class="btn-editar-sm" (click)="abrirModalEditar(a)">✏️</button>
                <button class="btn-eliminar-sm" (click)="pedirConfirmacion(a.id)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="alumnos.length === 0" class="empty-state">
          <p>📭 No hay alumnos registrados.</p>
        </div>
      </div>

      <div *ngIf="error" class="error-message">{{error}}</div>

      <!-- Modal nuevo / editar alumno -->
      <div class="modal-overlay" *ngIf="modalAbierto" (click)="cerrarModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>{{ editandoId ? '✏️ Editar Alumno' : '👩‍🎓 Nuevo Alumno' }}</h3>

          <div class="field-group">
            <label>Nombre completo</label>
            <input type="text" [(ngModel)]="form.nombre" placeholder="Nombre" />
          </div>
          <div class="field-group" *ngIf="!editandoId">
            <label>Correo electrónico</label>
            <input type="email" [(ngModel)]="form.correo" placeholder="correo@ejemplo.com" />
          </div>
          <div class="field-group">
            <label>Edad</label>
            <input type="number" [(ngModel)]="form.edad" min="5" max="99" />
          </div>
          <div class="field-group" *ngIf="!editandoId">
            <label>Contraseña</label>
            <input type="password" [(ngModel)]="form.contrasena" placeholder="Mínimo 6 caracteres" />
          </div>

          <div *ngIf="errorModal" class="error-message">{{errorModal}}</div>

          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cerrarModal()">Cancelar</button>
            <button class="btn-confirmar" (click)="guardarAlumno()" [disabled]="guardando">
              {{ guardando ? 'Guardando...' : (editandoId ? 'Actualizar' : 'Crear alumno') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal confirmación eliminar -->
      <div class="modal-overlay" *ngIf="alumnoAEliminar !== null" (click)="cancelarEliminacion()">
        <div class="modal-card modal-confirm" (click)="$event.stopPropagation()">
          <div class="modal-icon">🗑️</div>
          <h3>¿Eliminar alumno?</h3>
          <p>Esta acción no se puede deshacer.</p>
          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cancelarEliminacion()">Cancelar</button>
            <button class="btn-confirmar" (click)="confirmarEliminacion()">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AlumnosComponent implements OnInit {
  alumnos: Usuario[] = [];
  cargando = false;
  error = '';

  modalAbierto = false;
  editandoId: number | null = null;
  guardando = false;
  errorModal = '';
  form = { nombre: '', correo: '', edad: 18, contrasena: '' };

  alumnoAEliminar: number | null = null;

  constructor(
    private authService: AuthService,
    private asistenciaService: AsistenciaService
  ) {}

  ngOnInit() {
    this.cargarAlumnos();
  }

  cargarAlumnos() {
    this.cargando = true;
    this.asistenciaService.getAlumnos().subscribe({
      next: data => { this.alumnos = data; this.cargando = false; },
      error: () => { this.error = '❌ Error al cargar alumnos'; this.cargando = false; }
    });
  }

  abrirModalNuevo() {
    this.editandoId = null;
    this.form = { nombre: '', correo: '', edad: 18, contrasena: '' };
    this.errorModal = '';
    this.modalAbierto = true;
  }

  abrirModalEditar(a: Usuario) {
    this.editandoId = a.id;
    this.form = { nombre: a.nombre, correo: a.correo, edad: a.edad, contrasena: '' };
    this.errorModal = '';
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }

  guardarAlumno() {
    if (!this.form.nombre.trim()) {
      this.errorModal = '❌ El nombre es obligatorio.';
      return;
    }

    if (this.editandoId !== null) {
      const id = this.editandoId;
      this.guardando = true;
      this.errorModal = '';

      // Optimistic update
      this.alumnos = this.alumnos.map(a => a.id === id
        ? { ...a, nombre: this.form.nombre.trim(), edad: this.form.edad }
        : a);
      this.cerrarModal();

      this.asistenciaService.editarAlumno(id, { nombre: this.form.nombre.trim(), edad: this.form.edad }).subscribe({
        next: () => { this.guardando = false; },
        error: (err) => {
          this.guardando = false;
          this.cargarAlumnos(); // revertir
          this.error = err?.error?.mensaje ?? '❌ Error al actualizar el alumno.';
        }
      });
    } else {
      if (!this.form.correo.trim() || !this.form.contrasena) {
        this.errorModal = '❌ Correo y contraseña son obligatorios.';
        return;
      }
      if (this.form.contrasena.length < 6) {
        this.errorModal = '❌ La contraseña debe tener al menos 6 caracteres.';
        return;
      }

      this.guardando = true;
      this.errorModal = '';

      // Optimistic insert with temp id
      const temporal: Usuario = { id: -1, nombre: this.form.nombre.trim(), correo: this.form.correo.trim(), edad: this.form.edad, rol: 'Alumno' };
      this.alumnos = [...this.alumnos, temporal];
      this.cerrarModal();

      this.asistenciaService.crearAlumno({
        nombre: this.form.nombre.trim(),
        correo: this.form.correo.trim(),
        edad: this.form.edad,
        contrasena: this.form.contrasena
      }).subscribe({
        next: () => { this.guardando = false; this.cargarAlumnos(); },
        error: (err) => {
          this.guardando = false;
          this.alumnos = this.alumnos.filter(a => a.id !== -1); // revertir
          this.error = err?.error?.mensaje ?? '❌ Error al crear el alumno.';
        }
      });
    }
  }

  pedirConfirmacion(id: number) {
    this.alumnoAEliminar = id;
  }

  cancelarEliminacion() {
    this.alumnoAEliminar = null;
  }

  confirmarEliminacion() {
    if (this.alumnoAEliminar === null) return;
    const id = this.alumnoAEliminar;
    this.alumnoAEliminar = null;

    // Optimistic remove
    const backup = [...this.alumnos];
    this.alumnos = this.alumnos.filter(a => a.id !== id);

    this.asistenciaService.eliminarAlumno(id).subscribe({
      next: () => {},
      error: (err) => {
        this.alumnos = backup; // revertir
        this.error = err?.error?.mensaje ?? '❌ Error al eliminar el alumno.';
      }
    });
  }
}
