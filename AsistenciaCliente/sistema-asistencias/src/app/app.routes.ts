import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegistroComponent } from './components/registro/registro.component';
import { PortadaComponent } from './components/portada/portada.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AsistenciaComponent } from './components/asistencia/asistencia.component';
import { MateriasComponent } from './components/materias/materias.component';
import { AlumnosComponent } from './components/alumnos/alumnos.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: PortadaComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'asistencia', component: AsistenciaComponent, canActivate: [AuthGuard] },
  { path: 'materias', component: MateriasComponent, canActivate: [AuthGuard] },
  { path: 'alumnos', component: AlumnosComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];