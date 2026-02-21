document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const dashboardLayout = document.getElementById('dashboard-layout');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const container = document.getElementById('reports-container');
    const catList = document.getElementById('categories-list');
    const currentCatTitle = document.getElementById('current-category-title');
    const currentUserSpan = document.getElementById('current-username');
    const toast = document.getElementById('toast');

    let allReports = [];
    let availableTechs = [];
    let currentCategoryFilter = 'Todas';

    const ESTADOS = ['Pendiente', 'Abierto', 'En Curso', 'Facturación', 'Hecho', 'Cerrado'];

    // --- AUTHENTICATION ---
    const checkAuth = async () => {
        try {
            const res = await fetch('/api/check-auth');
            if (res.ok) {
                const data = await res.json();
                currentUserSpan.textContent = data.username.toUpperCase();
                showDashboard();
            } else {
                showLogin();
            }
        } catch (e) { showLogin(); }
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value.toLowerCase();
        const password = document.getElementById('login-pass').value;
        try {
            const res = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                loginError.classList.add('hidden');
                currentUserSpan.textContent = username.toUpperCase();
                showDashboard();
            } else {
                loginError.classList.remove('hidden');
            }
        } catch (e) {
            loginError.textContent = "Error de red";
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    });

    const showLogin = () => {
        loginOverlay.classList.remove('hidden');
        dashboardLayout.classList.add('hidden');
    };
    
    const showDashboard = () => {
        loginOverlay.classList.add('hidden');
        dashboardLayout.classList.remove('hidden');
        fetchData();
    };

    const showToast = (msg, color = '#0086CE') => {
        toast.textContent = msg;
        toast.style.backgroundColor = color;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // --- DATA ---
    const fetchData = async () => {
        try {
            refreshBtn.textContent = '⚡...';
            const res = await fetch('/api/bot-data');
            if (!res.ok) {
                if (res.status === 401) showLogin();
                throw new Error('Error al obtener datos');
            }
            const result = await res.json();
            allReports = result.data || [];
            availableTechs = result.technicians || [];
            
            updateSidebar();
            renderMain();
        } catch (e) {
            container.innerHTML = '<div class="empty-state">Error cargando datos.</div>';
        } finally {
            refreshBtn.textContent = '⚡ Sincronizar';
        }
    };

    refreshBtn.addEventListener('click', fetchData);

    // --- UI RENDERING ---
    const updateSidebar = () => {
        const counts = { 'Todas': allReports.length };
        allReports.forEach(r => {
            const cat = r.categoria_normalizada || r['TIPO DE SERVICIO'] || r.TIPO_DE_SERVICIO || r.categoria || r.CATEGORIA || r.Categoria || 'Sin Categoría';
            counts[cat] = (counts[cat] || 0) + 1;
        });

        catList.innerHTML = '';
        Object.keys(counts).forEach(cat => {
            const li = document.createElement('li');
            if (cat === currentCategoryFilter) li.classList.add('active');
            li.innerHTML = `<span>${cat}</span> <span class="count">${counts[cat]}</span>`;
            li.addEventListener('click', () => {
                currentCategoryFilter = cat;
                currentCatTitle.textContent = cat === 'Todas' ? 'Todas las Categorías' : cat;
                Array.from(catList.children).forEach(c => c.classList.remove('active'));
                li.classList.add('active');
                renderMain();
            });
            catList.appendChild(li);
        });
    };

    const renderMain = () => {
        container.innerHTML = '';
        let filtered = allReports;
        if (currentCategoryFilter !== 'Todas') {
            filtered = allReports.filter(r => {
                const c = r.categoria_normalizada || r['TIPO DE SERVICIO'] || r.TIPO_DE_SERVICIO || r.categoria || r.CATEGORIA || r.Categoria || 'Sin Categoría';
                return c === currentCategoryFilter;
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay informes para mostrar.</div>';
            return;
        }

        // Agrupar por técnico
        const byTec = {};
        filtered.forEach(r => {
            const tec = r.tecnico_normalizado || r.tecnico || r['Técnico'] || r.Tecnico || 'Sin Asignar';
            if (!byTec[tec]) byTec[tec] = [];
            byTec[tec].push(r);
        });

        const grid = document.createElement('div');
        grid.className = 'technicians-grid';

        for (const tec in byTec) {
            const col = document.createElement('div');
            col.className = 'technician-card';
            col.innerHTML = `<h3 class="technician-title">👷 ${tec}</h3>`;
            
            const list = document.createElement('div');
            list.className = 'requests-list';

            byTec[tec].forEach(req => {
                const urg = (req.urgencia || req.Urgencia || req['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
                let urgColor = '#00b4d8'; let borderColor = '#0086CE';
                if (urg.includes('alta')) { urgColor = '#ff3366'; borderColor = '#ff3366'; }
                else if (urg.includes('media')) { urgColor = '#ffcc00'; borderColor = '#ffcc00'; }

                const estadoActual = req.estado_normalizado || req.estado || req.Estado || req['ESTADO DE TICKET'] || req['ESTADO TICKET'] || 'Pendiente';
                const ticketId = req.row_number || req.id.substring(0,5);

                // Option selectores
                let statusHtml = '';
                ESTADOS.forEach(est => {
                    const sel = (est.toLowerCase() === estadoActual.toLowerCase()) ? 'selected' : '';
                    statusHtml += `<option value="${est}" ${sel}>${est}</option>`;
                });
                
                let techHtml = '';
                availableTechs.forEach(t => {
                    techHtml += `<option value="${t}" ${t.toLowerCase() === tec.toLowerCase() ? 'selected' : ''}>${t}</option>`;
                });

                const notas = req.notas_internas || '';
                
                const item = document.createElement('div');
                item.className = 'report-item';
                item.style.borderLeftColor = borderColor;
                item.innerHTML = `
                    <div class="report-header">
                        <div class="header-left">
                            <span class="company-name"><span class="ticket-id">#${ticketId}</span> ${req.empresa || req.Empresa || req.EMPRESA || 'Empresa Desconocida'}</span>
                            <span class="client-name">📞 ${req.telefono || req['NUMERO DE CONTACTO'] || '-'} · 👤 ${req.nombre || req.Nombre || req['NOMBRE DE CLIENTE'] || req['NOMBRE CLIENTE'] || 'Cliente'}</span>
                        </div>
                        <span class="badge" style="background-color: ${urgColor}22; color: ${urgColor}">${urg.toUpperCase()}</span>
                    </div>
                    <p class="report-desc">📝 ${req.informe || req.Informe || req['DESCRIPCION SUCESO'] || 'Sin descripción detallada.'}</p>
                    
                    <div class="management-grid">
                        <div class="widget-box">
                            <label>📍 Reasignar Tarea</label>
                            <select id="sel-${req.id}" class="select-styled">${techHtml}</select>
                            <button class="action-btn" onclick="reassign('${req.id}')">Transferir</button>
                        </div>
                        
                        <div class="widget-box">
                            <label>🚦 Estado y Notas</label>
                            <select id="stat-${req.id}" class="select-styled">${statusHtml}</select>
                            <textarea id="not-${req.id}" class="notes-area" placeholder="Agrega notas de seguimiento internas aquí...">${notas}</textarea>
                            <button class="action-btn" onclick="updateTicket('${req.id}')">💾 Guardar Estado</button>
                        </div>
                    </div>
                `;
                list.appendChild(item);
            });
            col.appendChild(list);
            grid.appendChild(col);
        }
        container.appendChild(grid);
    };

    window.reassign = async (reportId) => {
        const newTech = document.getElementById(`sel-${reportId}`).value;
        try {
            const res = await fetch('/api/reassign', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, newTechnician: newTech })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === reportId);
                if(r) { r.tecnico_normalizado = newTech; r.tecnico = newTech; }
                renderMain();
                showToast(`Ticket transferido a ${newTech.toUpperCase()}`);
            }
        } catch (e) { alert("Error"); }
    };

    window.updateTicket = async (reportId) => {
        const btn = event.target;
        btn.textContent = "Guardando...";
        
        const nuevoEstado = document.getElementById(`stat-${reportId}`).value;
        const nuevasNotas = document.getElementById(`not-${reportId}`).value;
        
        try {
            const res = await fetch('/api/update-ticket', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, estado: nuevoEstado, notas: nuevasNotas })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === reportId);
                if(r) { 
                    r.estado_normalizado = nuevoEstado;
                    r.estado = nuevoEstado;
                    r.notas_internas = nuevasNotas;
                }
                showToast(`Ticket #${r.row_number || r.id.substring(0,3)} Actualizado en Server (y n8n)`);
            } else {
                showToast('Error al actualizar', '#ff3366');
            }
        } catch (e) { 
            showToast('Error de conexión', '#ff3366');
        } finally {
            btn.textContent = "💾 Guardar Estado";
        }
    };

    // Init
    checkAuth();
});
