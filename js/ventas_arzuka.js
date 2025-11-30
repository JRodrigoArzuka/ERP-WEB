/**
 * js/ventas_arzuka.js
 * Lógica del Módulo de Ventas (Frontend)
 * Conecta el Dashboard, Formulario y Cálculos con Google Apps Script.
 */

// Variables Globales del Módulo
let clientesCache = [];

// --- 1. CARGA DEL DASHBOARD (LECTURA) ---
async function cargarVentasArzuka() {
    // UI: Mostrar estado de carga
    const tbody = document.getElementById('tablaVentasBody');
    const kpiTotal = document.getElementById('kpiVentasHoy');
    const kpiTickets = document.getElementById('kpiTicketsHoy');
    const kpiPendiente = document.getElementById('kpiPendienteHoy');
    
    if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Sincronizando ventas...</td></tr>';

    try {
        // 1. Llamar al Backend
        const respuesta = await callAPI('ventas', 'obtenerReporteVentasDia');

        if (respuesta.success) {
            // 2. Actualizar KPIs
            // Nota: Aseguramos formato moneda S/ 0.00
            kpiTotal.innerText = `S/ ${parseFloat(respuesta.kpis.total).toFixed(2)}`;
            kpiTickets.innerText = respuesta.kpis.tickets;
            kpiPendiente.innerText = `S/ ${parseFloat(respuesta.kpis.pendiente).toFixed(2)}`;

            // 3. Actualizar Tabla
            tbody.innerHTML = '';
            
            if (respuesta.ventas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay ventas registradas hoy.</td></tr>';
                return;
            }

            respuesta.ventas.forEach(venta => {
                // Definir color del estado
                let badgeColor = 'bg-secondary';
                if (venta.estado === 'Pagado') badgeColor = 'bg-success';
                if (venta.estado === 'Pendiente') badgeColor = 'bg-warning text-dark';
                if (venta.estado === 'Anulado') badgeColor = 'bg-danger';

                const fila = `
                    <tr>
                        <td class="fw-bold text-primary">${venta.ticket}</td>
                        <td>${venta.fecha}</td>
                        <td>${venta.cliente}</td>
                        <td class="fw-bold">S/ ${parseFloat(venta.total).toFixed(2)}</td>
                        <td><span class="badge ${badgeColor}">${venta.estado}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" title="Ver detalle"><i class="bi bi-eye"></i></button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', fila);
            });

        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error: ${respuesta.error}</td></tr>`;
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Fallo de conexión.</td></tr>';
    }
}

// --- 2. GESTIÓN DEL FORMULARIO DE NUEVA VENTA ---

async function abrirModalNuevaVenta() {
    // 1. Resetear formulario y variables
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('lblSaldoPendiente').innerText = '0.00';
    document.getElementById('divDelivery').classList.add('d-none');
    
    // Limpiar alertas de saldo
    const lblSaldo = document.getElementById('lblSaldoPendiente');
    lblSaldo.parentElement.className = 'alert alert-warning py-1 mb-0 small text-center fw-bold';

    // 2. Establecer fecha por defecto (HOY)
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('dateEntrega').value = hoy;

    // 3. Mostrar Modal
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    modal.show();

    // 4. Cargar Listas (Clientes, Configuración) desde el Backend
    try {
        // Solo cargamos si el select de eventos está vacío (para no recargar siempre)
        const selectEvento = document.getElementById('selTipoEvento');
        if (selectEvento.options.length <= 1) {
            
            const datos = await callAPI('ventas', 'obtenerDatosInicialesVentas');
            
            if(datos.success) {
                // Llenar Selects de Configuración
                llenarSelect('selTipoEvento', datos.config.Tipo_Evento);
                llenarSelect('selMetodoPago', datos.config.Metodo_Pago);
                
                // Llenar Datalist de Clientes
                clientesCache = datos.clientes; // Guardar en memoria
                const dataListClientes = document.getElementById('listaClientes');
                dataListClientes.innerHTML = '';
                
                datos.clientes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.nombre; 
                    // Truco: Guardamos ID en un atributo data para recuperarlo luego
                    opt.setAttribute('data-id', c.id); 
                    opt.label = `DNI: ${c.doc || 'S/D'} | Cel: ${c.cel || '-'}`;
                    dataListClientes.appendChild(opt);
                });

                // Vendedores (si hubiera select) - Por ahora usamos usuario logueado
                
            } else {
                alert("⚠️ Error cargando listas: " + datos.error);
            }
        }
    } catch (e) {
        console.error("Error cargando maestros:", e);
    }

    // 5. Agregar una línea vacía inicial para empezar a escribir rápido
    if(document.getElementById('bodyTablaVentas').children.length === 0) {
        agregarLineaProducto();
    }
}

function llenarSelect(idSelect, arrayDatos) {
    const sel = document.getElementById(idSelect);
    if(!sel || !arrayDatos) return;
    // Mantener la primera opción si es "Seleccione" o default
    // sel.innerHTML = ''; 
    // Mejor estrategia: Limpiar todo menos el primero si queremos, o limpiar todo.
    // En este caso, como tenemos valores default hardcodeados en HTML, limpiamos para no duplicar si se reabre.
    sel.innerHTML = ''; 
    
    arrayDatos.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.innerText = item;
        sel.appendChild(opt);
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
    const index = Date.now(); // ID único basado en tiempo

    const row = `
        <tr id="fila_${index}">
            <td>
                <input type="text" class="form-control form-control-sm desc-prod" placeholder="Descripción del producto">
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
    // Foco automático al nuevo input
    setTimeout(() => {
        const nuevoInput = document.querySelector(`#fila_${index} .desc-prod`);
        if(nuevoInput) nuevoInput.focus();
    }, 100);
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
    
    document.querySelectorAll('#bodyTablaVentas tr').forEach(fila => {
        const sub = parseFloat(fila.querySelector('.subtotal-prod').innerText) || 0;
        totalVenta += sub;
    });

    document.getElementById('lblTotalVenta').innerText = totalVenta.toFixed(2);
    calcularSaldo();
}

function calcularSaldo() {
    const total = parseFloat(document.getElementById('lblTotalVenta').innerText) || 0;
    const aCuenta = parseFloat(document.getElementById('txtACuenta').value) || 0;
    
    // Evitar saldo negativo visualmente si A Cuenta > Total (aunque backend lo manejaría)
    let saldo = total - aCuenta;
    
    const lblSaldo = document.getElementById('lblSaldoPendiente');
    lblSaldo.innerText = saldo.toFixed(2);
    
    // Estilos visuales
    const alertBox = lblSaldo.parentElement;
    if(saldo <= 0.01) { // Margen de error flotante
        alertBox.className = 'alert alert-success py-1 mb-0 small text-center fw-bold';
        lblSaldo.innerText = "0.00 (PAGADO)";
    } else {
        alertBox.className = 'alert alert-warning py-1 mb-0 small text-center fw-bold';
    }
}

// --- 4. GUARDAR VENTA (Comunicación con Backend) ---

async function guardarVenta() {
    const btn = document.querySelector('#modalNuevaVenta .modal-footer .btn-success');
    const originalText = btn.innerHTML;

    // A. Validaciones
    const clienteNombre = document.getElementById('txtClienteBuscar').value.trim();
    if(!clienteNombre) { alert("⚠️ Faltan datos del Cliente."); return; }
    
    const total = parseFloat(document.getElementById('lblTotalVenta').innerText);
    if(total <= 0) { alert("⚠️ El total de la venta no puede ser 0."); return; }

    // B. Recopilar Productos
    const items = [];
    let errorProductos = false;
    
    document.querySelectorAll('#bodyTablaVentas tr').forEach(fila => {
        const nombre = fila.querySelector('.desc-prod').value.trim();
        const cant = parseFloat(fila.querySelector('.cant-prod').value);
        const precio = parseFloat(fila.querySelector('.precio-prod').value);
        const subtotal = parseFloat(fila.querySelector('.subtotal-prod').innerText);

        // Ignorar filas vacías si el usuario agregó de más
        if(nombre === "" && precio === 0) return;

        if(!nombre || precio < 0) { errorProductos = true; return; }

        items.push({
            nombre: nombre,
            cantidad: cant,
            precio_unitario: precio,
            subtotal: subtotal,
            sku: 'MANUAL-' + Date.now() // SKU temporal para ítems manuales
        });
    });

    if(errorProductos || items.length === 0) {
        alert("⚠️ Revisa los productos. Faltan nombres o precios válidos.");
        return;
    }

    // C. Identificar Cliente (Busca en cache por nombre exacto)
    const clienteObj = clientesCache.find(c => c.nombre === clienteNombre);
    const idCliente = clienteObj ? clienteObj.id : 'NUEVO-' + Date.now();

    // D. Payload
    const payload = {
        cabecera: {
            id_cliente: idCliente,
            nombre_cliente: clienteNombre,
            id_vendedor: 'USER-WEB', // TODO: Tomar del localStorage
            observaciones: document.getElementById('txtObservaciones').value
        },
        totales: {
            total_venta: total,
            a_cuenta: parseFloat(document.getElementById('txtACuenta').value) || 0,
            saldo_pendiente: parseFloat(document.getElementById('lblSaldoPendiente').innerText) || 0
        },
        evento: {
            tipo: document.getElementById('selTipoEvento').value,
            fecha: document.getElementById('dateEntrega').value,
            turno: '' // Agregar select de turno si es necesario
        },
        entrega: {
            es_delivery: document.getElementById('chkDelivery').checked,
            direccion: document.getElementById('txtDireccion').value,
            referencia: document.getElementById('txtReferencia').value,
            link_maps: '',
            persona_recibe: clienteNombre,
            celular_contacto: '' 
        },
        detalle: items
    };

    // E. Enviar
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    
    try {
        const respuesta = await callAPI('ventas', 'registrarVenta', payload);
        
        if(respuesta.success) {
            alert(`✅ Venta Registrada!\nTicket: ${respuesta.data.id_ticket}`);
            bootstrap.Modal.getInstance(document.getElementById('modalNuevaVenta')).hide();
            
            // Recargar Dashboard para ver la nueva venta
            cargarVentasArzuka(); 
        } else {
            alert("❌ Error al guardar: " + respuesta.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}