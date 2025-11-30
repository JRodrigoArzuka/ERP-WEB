/**
 * js/auth.js
 * Maneja el inicio de sesión y la seguridad
 */

// Verificar sesión al cargar cualquier página
document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    const loginOverlay = document.getElementById("login-overlay");

    if (!usuario) {
        // Si no hay usuario, mostrar Login
        if(loginOverlay) loginOverlay.style.display = "flex";
    } else {
        // Si hay usuario, ocultar Login y poner nombre en sidebar
        if(loginOverlay) loginOverlay.style.display = "none";
        actualizarInfoUsuario(usuario);
    }
});

async function iniciarSesion() {
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;
    const btn = document.getElementById("btnLogin");
    const errorMsg = document.getElementById("loginError");

    btn.disabled = true;
    btn.innerText = "Verificando...";
    errorMsg.innerText = "";

    try {
        const respuesta = await fetch(Config.URL_USUARIOS, {
            method: "POST",
            body: JSON.stringify({ 
                accion: "login", 
                payload: { usuario: user, password: pass } 
            })
        });
        const datos = await respuesta.json();

        if (datos.success) {
            // Guardar sesión
            localStorage.setItem("erp_usuario", JSON.stringify(datos.usuario));
            
            // Verificar si debe cambiar contraseña
            if (datos.usuario.cambiarPass) {
                alert("⚠️ Por seguridad, debes cambiar tu contraseña predeterminada.");
                // Aquí podrías abrir un modal de cambio de contraseña
            }

            location.reload(); // Recargar para entrar
        } else {
            errorMsg.innerText = "❌ " + datos.error;
        }
    } catch (e) {
        errorMsg.innerText = "Error de conexión: " + e.message;
    } finally {
        btn.disabled = false;
        btn.innerText = "Ingresar";
    }
}

function cerrarSesion() {
    if(confirm("¿Cerrar sesión?")) {
        localStorage.removeItem("erp_usuario");
        location.reload();
    }
}

function actualizarInfoUsuario(usuario) {
    const lblUser = document.getElementById("lblUsuarioActual");
    if(lblUser) lblUser.innerText = usuario.nombre + " (" + usuario.rol + ")";
    
    // Aquí aplicaremos lógica de permisos más adelante
    // Ej: Si rol != Admin, ocultar botón de Usuarios
}