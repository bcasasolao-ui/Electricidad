document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. CONFIGURACIÓN DE LA API REAL EN AZURE
    // ==========================================
    const API_BASE_URL = 'https://sistemapagostelefonia.azurewebsites.net/api/telefonia';

    let currentAccount = null;
    let currentMontoTotal = 0;

    // ==========================================
    // CONTROL DE ROLES (ADMIN / USUARIO)
    // ==========================================
    const roleSelector = document.getElementById('role-selector');
    
    roleSelector.addEventListener('change', (e) => {
        const selectedRole = e.target.value;
        document.body.setAttribute('data-role', selectedRole);
        
        if (selectedRole === 'admin') {
            cargarHistorialAdmin();
        }
    });

    // ==========================================
    // 2. CONTROL DE PESTAÑAS (TABS)
    // ==========================================
    const methodCards = document.querySelectorAll('.method-card');
    const tabContents = document.querySelectorAll('.tab-content');

    methodCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetTab = card.getAttribute('data-tab');
            methodCards.forEach(c => c.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            card.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    // ==========================================
    // 3. CONSULTA DE SALDO REAL (PETICIÓN GET)
    // ==========================================
    const formConsulta = document.getElementById('form-consulta');
    const resultadoSaldo = document.getElementById('resultado-saldo');
    const errorConsulta = document.getElementById('error-consulta');
    const formParcial = document.getElementById('form-pago-parcial');
    const restriccionParcial = document.getElementById('parcial-restriccion');

    formConsulta.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const contadorInput = document.getElementById('id-contador').value.trim();
        const correlativoInput = document.getElementById('correlativo').value.trim();
        const urlConsulta = `${API_BASE_URL}?contador=${contadorInput}&correlativo=${correlativoInput}`;

        document.getElementById('monto-luz').textContent = "Cargando...";
        errorConsulta.classList.add('hidden');
        resultadoSaldo.classList.add('hidden');

        fetch(urlConsulta)
            .then(response => {
                if (!response.ok) throw new Error(`Error en el servidor: ${response.status}`);
                return response.json();
            })
            .then(cuentaEncontrada => {
                errorConsulta.classList.add('hidden');
                currentAccount = cuentaEncontrada;
                
                const mesesAcumulados = cuentaEncontrada.recibos ? cuentaEncontrada.recibos.length : 0;
                currentMontoTotal = cuentaEncontrada.recibos ? cuentaEncontrada.recibos.reduce((sum, r) => sum + r.saldo_pendiente, 0) : 0;

                document.getElementById('nombre-titular').textContent = cuentaEncontrada.nombre_responsable || 'No disponible';
                document.getElementById('direccion-titular').textContent = cuentaEncontrada.direccion_inmueble || 'No disponible';
                document.getElementById('meses-acumulados').textContent = mesesAcumulados;
                document.getElementById('monto-luz').textContent = `Q ${currentMontoTotal.toFixed(2)}`;

                if (mesesAcumulados >= 2) {
                    formParcial.classList.remove('hidden');
                    restriccionParcial.classList.add('hidden');
                } else {
                    formParcial.classList.add('hidden');
                    restriccionParcial.classList.remove('hidden');
                }

                resultadoSaldo.classList.remove('hidden');
            })
            .catch(error => {
                console.error("Error al consultar saldo en Azure:", error);
                resultadoSaldo.classList.add('hidden');
                errorConsulta.classList.remove('hidden');
                currentAccount = null;
            });
    });

    // ==========================================
    // 4. MÁSCARAS DE ENTRADA (TARJETA)
    // ==========================================
    const inputCardNumber = document.getElementById('card-number');
    const inputCardExp = document.getElementById('card-exp');

    inputCardNumber.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let parts = [];
        for (let i = 0, len = value.length; i < len; i += 4) {
            parts.push(value.substring(i, i + 4));
        }
        e.target.value = parts.length > 0 ? parts.join(' ') : value;
    });

    inputCardExp.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (value.length > 2) {
            e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
    });

    // ==========================================
    // 5. PROCESAMIENTO E INSERTIÓN REAL (POST)
    // ==========================================
    const modal = document.getElementById('payment-modal');
    const modalLoader = document.getElementById('modal-loader');
    const modalSuccess = document.getElementById('modal-success');
    const modalMessage = document.getElementById('modal-message');
    const btnCloseModal = document.getElementById('btn-close-modal');

    function ejecutarTransaccionReal(montoFinal, canal) {
        modal.classList.remove('hidden');
        modalLoader.classList.remove('hidden');
        modalSuccess.classList.add('hidden');

        const transaccionData = {
            numero_contador: currentAccount.numero_contador,
            monto_pagado: montoFinal,
            canal_pago: canal,
            fecha_pago: new Date().toISOString()
        };

        fetch(`${API_BASE_URL}/pagar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaccionData)
        })
        .then(response => {
            if (!response.ok) throw new Error('No se pudo registrar el pago');
            return response.json();
        })
        .then(respuestaBackend => {
            modalLoader.classList.add('hidden');
            modalSuccess.classList.remove('hidden');
            
            document.getElementById('auth-code').textContent = respuestaBackend.codigo_autorizacion || 'EEG-REAL';
            document.getElementById('db-canal').textContent = respuestaBackend.canal_pago || canal;
            modalMessage.innerHTML = `Pago de <strong>Q ${montoFinal.toFixed(2)}</strong> procesado con éxito en Azure para el contador <strong>${currentAccount.numero_contador}</strong>.`;
        })
        .catch(error => {
            console.error("Error al procesar el pago:", error);
            modalLoader.classList.add('hidden');
            modal.classList.add('hidden');
            alert("Hubo un error al guardar el pago.");
        });
    }

    document.getElementById('form-pago-linea').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentAccount) return alert('Consulte un contador válido primero.');
        ejecutarTransaccionReal(currentMontoTotal, 'PASARELA_LINEA');
    });

    formParcial.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentAccount) return;
        const porcentaje = document.getElementById('porcentaje-pago').value;
        ejecutarTransaccionReal(currentMontoTotal * (porcentaje / 100), 'PASARELA_LINEA');
    });

    btnCloseModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        formConsulta.reset();
        document.getElementById('form-pago-linea').reset();
        resultadoSaldo.classList.add('hidden');
        currentAccount = null;
    });

    // ==========================================
    // LÓGICA EXCLUSIVA DEL PANEL DE ADMINISTRACIÓN
    // ==========================================
    const btnRefreshAdmin = document.getElementById('btn-refresh-admin');
    if(btnRefreshAdmin) {
        btnRefreshAdmin.addEventListener('click', cargarHistorialAdmin);
    }

    function cargarHistorialAdmin() {
        const tbody = document.querySelector('#tabla-pagos-admin tbody');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">Cargando registros desde Azure...</td></tr>`;

        // Simulamos o llamamos al GET general de pagos de la API
        fetch(`${API_BASE_URL}/pagos`) 
            .then(res => res.ok ? res.json() : throwError())
            .then(pagos => {
                tbody.innerHTML = '';
                if(pagos.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="text-center">No hay transacciones registradas aún.</td></tr>`;
                    return;
                }
                pagos.forEach(pago => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><strong>${pago.numero_contador}</strong></td>
                        <td style="color: var(--success-color); font-weight:600;">Q ${parseFloat(pago.monto_pagado).toFixed(2)}</td>
                        <td><span class="secure-badge" style="margin:0; padding:4px 8px;">${pago.canal_pago}</span></td>
                        <td>${new Date(pago.fecha_pago).toLocaleString()}</td>
                    `;
                    tbody.appendChild(row);
                });
            })
            .catch(() => {
                // Si tu backend no soporta un GET general, mostramos una fila limpia de fallback estético
                tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--warning-color);">⚠️ No se pudo conectar al endpoint GET global de Azure o no está configurado.</td></tr>`;
            });
    }
});