/**
 * js/core.js
 * Núcleo de la aplicación: Manejo de Estado y Navegación.
 * NO CONTIENE callAPI - usa la función centralizada de config.js
 */

// Estado global de la aplicación
let globalData = {
    listas: {},
    proveedores: [],
    sucursales: [],
    usuarios: [],
    // Cache para optimizar peticiones repetidas
    cache: {
        proveedores: null,
        usuarios: null,
        timestamp: null
    }
};

// --- NAVEGACIÓN ---
function nav(vista) {
    // Ocultar todas las vistas y desactivar menús
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar a').forEach(el => el.classList.remove('active'));
    
    // Activar vista
    const vistaEl = document.getElementById('view-' + vista);
    if(vistaEl) vistaEl.classList.add('active');
    
    // En móvil, cerrar el menú al hacer clic
    toggleSidebar(false);

    // Carga diferida de datos (Lazy Loading)
    if(vista === 'proveedores') {
        if(typeof cargarProveedores === 'function') cargarProveedores();
    }
    
    if(vista === 'usuarios') {
        if(typeof cargarUsuarios === 'function') cargarUsuarios();
    }

    // Scroll al inicio para mejor UX
    window.scrollTo(0, 0);
}

// --- UTILIDADES UI ---
function toggleSidebar(forceState = null) {
    const sidebar = document.getElementById('sidebar');
    const menuOverlay = document.getElementById('overlay'); 
    
    if (forceState === false) {
        sidebar.classList.remove('active');
        if(menuOverlay) menuOverlay.classList.remove('active');
    } else {
        sidebar.classList.toggle('active');
        if(menuOverlay) menuOverlay.classList.toggle('active');
    }
}

/**
 * Utilidad para mostrar notificaciones toast (puede ser extendida)
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    // Aquí podrías integrar Toast de Bootstrap en el futuro
}

/**
 * Limpiar cache cuando sea necesario (ej: después de guardar cambios)
 */
function limpiarCache() {
    globalData.cache = {
        proveedores: null,
        usuarios: null,
        timestamp: null
    };
}