import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Materia, MateriaDetalle, Asistencia, AlumnoMateria, Profesor, Usuario } from '../models/models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private apiUrl = 'http://localhost:5091/api';

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  getMaterias(): Observable<MateriaDetalle[]> {
    return this.http.get<MateriaDetalle[]>(`${this.apiUrl}/materias`, { headers: this.getHeaders() });
  }

  crearMateria(data: { nombreMateria: string; horasPlanificadas: number; profesorId: number | null }): Observable<any> {
    return this.http.post(`${this.apiUrl}/materias`, data, { headers: this.getHeaders() });
  }

  editarMateria(id: number, data: { nombreMateria: string; horasPlanificadas: number; profesorId: number | null }): Observable<any> {
    return this.http.put(`${this.apiUrl}/materias/${id}`, data, { headers: this.getHeaders() });
  }

  eliminarMateria(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/materias/${id}`, { headers: this.getHeaders() });
  }

  getProfesores(): Observable<Profesor[]> {
    return this.http.get<Profesor[]>(`${this.apiUrl}/profesores`, { headers: this.getHeaders() });
  }

  crearProfesor(data: { correo: string; nombre: string; edad: number; contrasena: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/profesores`, data, { headers: this.getHeaders() });
  }

  getAlumnos(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/alumnos`, { headers: this.getHeaders() });
  }

  crearAlumno(data: { correo: string; nombre: string; edad: number; contrasena: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumnos`, data, { headers: this.getHeaders() });
  }

  editarAlumno(id: number, data: { nombre: string; edad: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/alumnos/${id}`, data, { headers: this.getHeaders() });
  }

  eliminarAlumno(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/alumnos/${id}`, { headers: this.getHeaders() });
  }

  getAsistencias(materiaId: number, anio: number, mes: number): Observable<Asistencia[]> {
    return this.http.get<Asistencia[]>(`${this.apiUrl}/asistencias/${materiaId}/${anio}/${mes}`,
      { headers: this.getHeaders() });
  }

  guardarAsistencia(asistencia: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/asistencias`, asistencia, { headers: this.getHeaders() });
  }

  eliminarAsistencia(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/asistencias/${id}`, { headers: this.getHeaders() });
  }

  getAlumnosPorMateria(materiaId: number): Observable<AlumnoMateria[]> {
    return this.http.get<AlumnoMateria[]>(`${this.apiUrl}/alumnos-materia/${materiaId}`,
      { headers: this.getHeaders() });
  }

  getAlumnosDisponibles(materiaId: number): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/alumnos-disponibles/${materiaId}`,
      { headers: this.getHeaders() });
  }

  inscribirAlumno(alumnoId: number, materiaId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno-materia`, { alumnoId, materiaId },
      { headers: this.getHeaders() });
  }

  desinscribirAlumno(alumnoId: number, materiaId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/alumno-materia/${alumnoId}/${materiaId}`,
      { headers: this.getHeaders() });
  }
}