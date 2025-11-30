/**
 * js/ventas_arzuka.js
 * Lógica del Módulo de Ventas (Frontend)
 * Maneja el Dashboard, Formulario de Venta y Cálculos.
 */

// Variables Globales del Módulo
let itemsVenta = [];
let clientesCache = [];
let productosCache = []; // Si tuvieras lista de productos predefinida

// --- 1. CARGA DEL DASHBOARD ---
async function cargarVentasArzuka() {
    // Mostrar estado de carga en la tabla
    const tbody = document.getElementById('tablaVentasBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando ventas...</td></tr>';

    // Llamar al Backend (Usamos una acción genérica que crearemos o reutilizaremos)
    // Nota: Por ahora simularemos la carga o pediremos datos si ya tienes ventas.
    // Para este ejemplo inicial, dejaremos la tabla lista para recibir datos reales.
    
    // Simulación visual de carga finalizada (En la sig. fase conectamos el reporte real)
    setTimeout(() => {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay ventas registradas hoy.</td></tr>';
        
        // Resetear KPIs a 0
        document.getElementById('kpiVentasHoy').innerText = "S/ 0.00";
        document.getElementById('kpiTicketsHoy').innerText = "0";
        document.getElementById('kpiPendienteHoy').innerText = "S/ 0.00";
    }, 800);
}

// --- 2. GESTIÓN DEL FORMULARIO DE NUEVA VENTA ---

async function abrirModalNuevaVenta() {
    // 1. Resetear formulario
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('lblSaldoPendiente').innerText = '0.00';
    document.getElementById('divDelivery').classList.add('d-none');
    itemsVenta = [];

    // 2. Establecer fechas por defecto
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('dateEntrega').value = hoy;

    // 3. Mostrar Modal
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    modal.show();

    // 4. Cargar Listas (Clientes, Configuración) desde el Backend
    try {
        const datos = await callAPI('ventas', 'obtenerDatosInicialesVentas');
        
        if(datos.success) {
            // Llenar Selects de Configuración
            llenarSelect('selTipoEvento', datos.config.Tipo_Evento);
            llenarSelect('selMetodoPago', datos.config.Metodo_Pago);
            
            // Llenar Datalist de Clientes
            clientesCache = datos.clientes; // Guardar en memoria para búsquedas
            const dataListClientes = document.getElementById('listaClientes');
            dataListClientes.innerHTML = '';
            datos.clientes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.nombre; // Lo que se escribe
                opt.setAttribute('data-id', c.id);
                opt.innerText = `Doc: ${c.doc} | Cel: ${c.cel}`; // Info extra visible
                dataListClientes.appendChild(opt);
            });
            
        } else {
            alert("⚠️ Error cargando listas: " + datos.error);
        }
    } catch (e) {
        console.error(e);
    }

    // 5. Agregar una línea de producto vacía inicial
    agregarLineaProducto();
}

function llenarSelect(idSelect, arrayDatos) {
    const sel = document.getElementById(idSelect);
    if(!sel || !arrayDatos) return;
    sel.innerHTML = '';
    arrayDatos.forEach(item => {
        sel.innerHTML += `<option value="${item}">${item}</option>`;
    });
}

function toggleDelivery() {
    const chk = document.getElementById('chkDelivery');
    const div = document.getElementById('divDelivery');
    if(chk.checked) div.classList.remove('d-none');
    else div.classList.add('d-none');
}

// --- 3. GESTIÓN DE PRODUCTOS (Tabla Dinámica) ---

function agregarLineaProducto() {
    const tbody = document.getElementById('bodyTablaVentas');
    const index = tbody.children.length; // Índice único para esta fila

    const row = `
        <tr id="fila_${index}">
            <td>
                <input type="text" class="form-control form-control-sm desc-prod" placeholder="Descripción del producto" list="listaProductos">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm text-center cant-prod" value="1" min="1" oninput="calcularFila(${index})">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm text-end precio-prod" placeholder="0.00" oninput="calcularFila(${index})">
            </td>
            <td class="text-end">
                <span class="fw-bold subtotal-prod">0.00</span>
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-link text-danger p-0" onclick="eliminarFila(${index})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `;
    
    tbody.insertAdjacentHTML('beforeend', row);
    // Poner foco en el nuevo input
    setTimeout(() => document.querySelector(`#fila_${index} .desc-prod`).focus(), 100);
}

function eliminarFila(index) {
    const fila = document.getElementById(`fila_${index}`);
    if(fila) fila.remove();
    calcularTotales();
}

function calcularFila(index) {
    const fila = document.getElementById(`fila_${index}`);
    if(!fila) return;

    const cant = parseFloat(fila.querySelector('.cant-prod').value) || 0;
    const precio = parseFloat(fila.querySelector('.precio-prod').value) || 0;
    const subtotal = cant * precio;

    fila.querySelector('.subtotal-prod').innerText = subtotal.toFixed(2);
    
    calcularTotales();
}

function calcularTotales() {
    let totalVenta = 0;
    
    // Sumar todas las filas visibles
    document.querySelectorAll('#bodyTablaVentas tr').forEach(fila => {
        const sub = parseFloat(fila.querySelector('.subtotal-prod').innerText) || 0;
        totalVenta += sub;
    });

    // Actualizar UI Total
    document.getElementById('lblTotalVenta').innerText = totalVenta.toFixed(2);
    
    // Calcular Saldo
    calcularSaldo();
}

function calcularSaldo() {
    const total = parseFloat(document.getElementById('lblTotalVenta').innerText) || 0;
    const aCuenta =