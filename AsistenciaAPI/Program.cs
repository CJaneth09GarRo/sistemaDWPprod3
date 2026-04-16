using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Npgsql;
using Dapper;

var builder = WebApplication.CreateBuilder(args);

// ============ CORS ============
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ============ JWT ============
var key = Encoding.UTF8.GetBytes("MiClaveSuperSecretaParaJWT2026Universidad123!");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanManageAttendance", policy =>
    {
        policy.RequireAssertion(context =>
        {
            var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
            if (string.IsNullOrWhiteSpace(role))
            {
                return false;
            }

            return role.Equals("Maestro", StringComparison.OrdinalIgnoreCase)
                || role.Equals("Administrador", StringComparison.OrdinalIgnoreCase)
                || role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        });
    });
});
builder.Services.AddSingleton<DapperContext>();

var app = builder.Build();

app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();

await PrepareDatabaseAsync(app.Services, app.Logger);

// ============ LOGIN ============
app.MapPost("/api/auth/login", async (LoginDto login, DapperContext db) =>
{
    try
    {
        var correo = NormalizeEmail(login.Correo);
        if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(login.Contrasena))
        {
            return Results.BadRequest(new { mensaje = "Correo y contraseña son obligatorios" });
        }

        var sql = @"SELECT id, correo, nombre, edad, rol, contrasenahash
                    FROM usuario
                    WHERE lower(correo) = @Correo";
        var usuario = await db.QueryFirstOrDefaultAsync<Usuario>(sql, new { Correo = correo });

        if (usuario is null)
        {
            return Results.Unauthorized();
        }

        // Verificar contraseña (texto plano)
        if (usuario.Contrasenahash != login.Contrasena)
        {
            return Results.Unauthorized();
        }

        var token = GenerarToken(usuario);
        return Results.Ok(new
        {
            token,
            usuario = new
            {
                usuario.Id,
                usuario.Nombre,
                usuario.Correo,
                usuario.Rol
            }
        });
    }
    catch (NpgsqlException)
    {
        return Results.Problem(
            detail: "No se pudo conectar con la base de datos.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Servicio de base de datos no disponible");
    }
    catch (Exception)
    {
        return Results.Problem(
            detail: "Ocurrió un error inesperado durante el inicio de sesión.",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno");
    }
});

// ============ REGISTRO ============
app.MapPost("/api/auth/registro", async (RegistroDto dto, DapperContext db) =>
{
    try
    {
        var correo = NormalizeEmail(dto.Correo);
        if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(dto.Nombre) || string.IsNullOrWhiteSpace(dto.Contrasena))
        {
            return Results.BadRequest(new { mensaje = "Correo, nombre y contraseña son obligatorios" });
        }

        if (dto.Contrasena.Length < 6)
        {
            return Results.BadRequest(new { mensaje = "La contraseña debe tener al menos 6 caracteres" });
        }

        var existe = await db.ExecuteScalarAsync<long>(
            "SELECT COUNT(1) FROM usuario WHERE lower(correo) = @Correo",
            new { Correo = correo });

        if (existe > 0)
        {
            return Results.BadRequest(new { mensaje = "El correo ya está registrado" });
        }

        var rolRegistro = NormalizePublicRole(dto.Rol);

        // Guardar contraseña directamente (texto plano)
        var sql = @"INSERT INTO usuario (correo, nombre, edad, rol, contrasenahash)
                    VALUES (@Correo, @Nombre, @Edad, @Rol, @Contrasena)";

        await db.ExecuteAsync(sql, new
        {
            Correo = correo,
            Nombre = dto.Nombre.Trim(),
            Edad = dto.Edad,
            Rol = rolRegistro,
            Contrasena = dto.Contrasena
        });

        return Results.Ok(new { mensaje = "Usuario registrado exitosamente" });
    }
    catch (NpgsqlException)
    {
        return Results.Problem(
            detail: "No se pudo conectar con la base de datos.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Servicio de base de datos no disponible");
    }
    catch (Exception)
    {
        return Results.Problem(
            detail: "Ocurrió un error inesperado durante el registro.",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno");
    }
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

// ============ MATERIAS ============
app.MapGet("/api/materias", async (DapperContext db) =>
{
    var materias = await db.QueryAsync<Materia>("SELECT * FROM materia ORDER BY nombre_materia");
    return Results.Ok(materias);
}).RequireAuthorization();

// ============ ASISTENCIAS ============

// Obtener asistencias por materia y mes
app.MapGet("/api/asistencias/{materiaId}/{anio}/{mes}", async (int materiaId, int anio, int mes, DapperContext db) =>
{
    var sql = @"
        SELECT 
            a.id,
            a.usuario_id AS UsuarioId,
            a.materia_id AS MateriaId,
            a.fecha,
            a.presente,
            a.horas_impartidas AS HorasImpartidas,
            a.horas_asistidas AS HorasAsistidas,
            a.observacion,
            u.nombre AS UsuarioNombre
        FROM asistencia a
        JOIN usuario u ON a.usuario_id = u.id
        WHERE a.materia_id = @MateriaId
          AND EXTRACT(YEAR FROM a.fecha) = @Anio
          AND EXTRACT(MONTH FROM a.fecha) = @Mes
        ORDER BY u.nombre, a.fecha";

    var result = await db.QueryAsync<AsistenciaDto>(sql, 
        new { MateriaId = materiaId, Anio = anio, Mes = mes });
    return Results.Ok(result);
}).RequireAuthorization();

// Registrar o actualizar asistencia
app.MapPost("/api/asistencias", async (AsistenciaRegistroDto dto, DapperContext db) =>
{
    var sql = @"
        INSERT INTO asistencia (usuario_id, materia_id, fecha, horas_impartidas, horas_asistidas, observacion, presente)
        VALUES (@UsuarioId, @MateriaId, @Fecha, @HorasImpartidas, @HorasAsistidas, @Observacion, @Presente)
        ON CONFLICT (usuario_id, materia_id, fecha)
        DO UPDATE SET 
            horas_impartidas = EXCLUDED.horas_impartidas,
            horas_asistidas = EXCLUDED.horas_asistidas,
            observacion = EXCLUDED.observacion,
            presente = EXCLUDED.presente";

    await db.ExecuteAsync(sql, dto);
    return Results.Ok(new { mensaje = "Asistencia registrada o actualizada" });
}).RequireAuthorization("CanManageAttendance");

// Eliminar asistencia
app.MapDelete("/api/asistencias/{id}", async (int id, DapperContext db) =>
{
    var filasAfectadas = await db.ExecuteAsync("DELETE FROM asistencia WHERE id = @Id", new { Id = id });
    
    if (filasAfectadas == 0)
    {
        return Results.NotFound(new { mensaje = "Asistencia no encontrada" });
    }
    
    return Results.Ok(new { mensaje = "Asistencia eliminada" });
    }).RequireAuthorization("CanManageAttendance");

// Obtener alumnos por materia
app.MapGet("/api/alumnos-materia/{materiaId}", async (int materiaId, DapperContext db) =>
{
    var sql = @"
        SELECT DISTINCT u.id, u.nombre, u.correo, u.rol
        FROM usuario u
        INNER JOIN asistencia a ON u.id = a.usuario_id
        WHERE u.rol = 'Alumno' AND a.materia_id = @MateriaId
        ORDER BY u.nombre";
    
    var result = await db.QueryAsync<Usuario>(sql, new { MateriaId = materiaId });
    return Results.Ok(result);
}).RequireAuthorization("CanManageAttendance");

app.Run();

// ============ FUNCIONES ============
string NormalizeEmail(string? email)
{
    return (email ?? string.Empty).Trim().ToLowerInvariant();
}

string NormalizePublicRole(string? role)
{
    var normalized = (role ?? string.Empty).Trim();
    if (normalized.Equals("Maestro", StringComparison.OrdinalIgnoreCase))
    {
        return "Maestro";
    }

    if (normalized.Equals("Secretario", StringComparison.OrdinalIgnoreCase))
    {
        return "Secretario";
    }

    // Bloquea escalamiento de privilegios por registro público.
    return "Alumno";
}

async Task PrepareDatabaseAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        var db = services.GetRequiredService<DapperContext>();
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_usuario_correo_lower ON usuario ((lower(correo)))");
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_asistencia_materia_fecha ON asistencia (materia_id, fecha)");
        await db.ExecuteScalarAsync<int>("SELECT 1");
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "No se pudo preparar la base de datos al iniciar la API");
    }
}

string GenerarToken(Usuario usuario)
{
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new Claim(ClaimTypes.Email, usuario.Correo),
        new Claim(ClaimTypes.Name, usuario.Nombre),
        new Claim(ClaimTypes.Role, usuario.Rol ?? "Usuario")
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("MiClaveSuperSecretaParaJWT2026Universidad123!"));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        issuer: null,
        audience: null,
        claims: claims,
        expires: DateTime.Now.AddHours(8),
        signingCredentials: creds);

    return new JwtSecurityTokenHandler().WriteToken(token);
}

// ============ CLASES ============
public class Usuario
{
    public int Id { get; set; }
    public string Correo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int Edad { get; set; }
    public string Rol { get; set; } = "Alumno";
    public string Contrasenahash { get; set; } = "";
}

public class Materia
{
    public int Id { get; set; }
    public string Nombre_materia { get; set; } = "";
    public int Horas_planificadas { get; set; }
}

public class LoginDto
{
    public string Correo { get; set; } = "";
    public string Contrasena { get; set; } = "";
}

public class RegistroDto
{
    public string Correo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int Edad { get; set; }
    public string Contrasena { get; set; } = "";
    public string Rol { get; set; } = "Alumno";
}

public class AsistenciaDto
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int MateriaId { get; set; }
    public DateTime Fecha { get; set; }
    public bool Presente { get; set; }
    public int HorasImpartidas { get; set; }
    public int HorasAsistidas { get; set; }
    public string Observacion { get; set; } = "";
    public string UsuarioNombre { get; set; } = "";
}

public class AsistenciaRegistroDto
{
    public int UsuarioId { get; set; }
    public int MateriaId { get; set; }
    public DateTime Fecha { get; set; }
    public bool Presente { get; set; }
    public int HorasImpartidas { get; set; }
    public int HorasAsistidas { get; set; }
    public string Observacion { get; set; } = "";
}

// ============ DapperContext ============
public class DapperContext
{
    private readonly string _connectionString;

    public DapperContext(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("PostgreSQL") ??
            "Host=localhost;Database=prdct3;Username=postgres;Password=password";
    }

    private NpgsqlConnection CreateConnection() => new NpgsqlConnection(_connectionString);

    public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.QueryAsync<T>(sql, param);
    }

    public async Task<T?> QueryFirstOrDefaultAsync<T>(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<T>(sql, param);
    }

    public async Task<int> ExecuteAsync(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.ExecuteAsync(sql, param);
    }

    public async Task<T> ExecuteScalarAsync<T>(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.ExecuteScalarAsync<T>(sql, param);
    }
}