import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Materia, Asistencia, AlumnoMateria } from '../models/models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  getMaterias(): Observable<Materia[]> {
    return this.http.get<Materia[]>(`${this.apiUrl}/materias`, { headers: this.getHeaders() });
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
}