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

    let allReports = [];
    let availableTechs = [];
    let currentCategoryFilter = 'Todas';

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
            
            console.log("DEBUG: Datos recibidos desde API:", allReports);
            
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
            const cat = r.categoria_normalizada || 'Sin Categoría';
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
                const c = r.categoria_normalizada || 'Sin Categoría';
                return c === currentCategoryFilter;
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay informes para esta categoría.</div>';
            return;
        }

        // Agrupar por técnico
        const byTec = {};
        filtered.forEach(r => {
            const tec = r.tecnico_normalizado || 'Sin Asignar';
            if (!byTec[tec]) byTec[tec] = [];
            byTec[tec].push(r);
        });

        const grid = document.createElement('div');
        grid.className = 'technicians-grid';

        for (const tec in byTec) {
            const col = document.createElement('div');
            col.className = 'technician-card';
            col.innerHTML = `<h3 class="technician-title">👷 ${tec.toUpperCase()}</h3>`;
            
            const list = document.createElement('div');
            list.className = 'requests-list';

            byTec[tec].forEach(req => {
                const urg = (req.urgencia || req.Urgencia || req['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
                let urgColor = '#00f5d4'; let borderColor = '#00f5d4';
                if (urg.includes('alta')) { urgColor = '#ff3366'; borderColor = '#ff3366'; }
                else if (urg.includes('media')) { urgColor = '#ffcc00'; borderColor = '#ffcc00'; }

                const estado = req.estado || req.Estado || req['ESTADO DE TICKET'] || 'Pendiente';
                const estadoClass = estado.toLowerCase().replace(' ', '-');

                // Opciones de reasignacion
                let optionsHtml = '';
                availableTechs.forEach(t => {
                    optionsHtml += `<option value="${t}" ${t.toLowerCase() === tec.toLowerCase() ? 'selected' : ''}>${t}</option>`;
                });

                const item = document.createElement('div');
                item.className = 'report-item';
                item.style.borderLeftColor = borderColor;
                item.innerHTML = `
                    <div class="report-header">
                        <div>
                            <span class="company-name">${req.empresa || req.Empresa || req.EMPRESA || 'Empresa Desconocida'}</span>
                            <span class="client-name">${req.nombre || req.Nombre || req['NOMBRE DE CLIENTE'] || req['NOMBRE CLIENTE'] || 'Cliente'}</span>
                        </div>
                        <span class="badge" style="background-color: ${urgColor}22; color: ${urgColor}">${urg.toUpperCase()}</span>
                    </div>
                    <p class="report-desc">${req.informe || req.Informe || req['DESCRIPCION SUCESO'] || 'Sin detalles.'}</p>
                    <div class="report-footer">
                        <span>📞 ${req.telefono || req['NUMERO DE CONTACTO'] || '-'}</span>
                        <span><span class="status ${estadoClass}">${estado}</span></span>
                    </div>
                    <div class="reassign-widget">
                        <span style="font-size:0.8rem; color:#a0a0b0;">Enviar a:</span>
                        <select id="sel-${req.id}">${optionsHtml}</select>
                        <button onclick="reassign('${req.id}')">Asignar</button>
                    </div>
                `;
                list.appendChild(item);
            });
            col.appendChild(list);
            grid.appendChild(col);
        }
        container.appendChild(grid);
    };

    // Reasignar global fn
    window.reassign = async (reportId) => {
        const select = document.getElementById(`sel-${reportId}`);
        const newTech = select.value;
        try {
            const res = await fetch('/api/reassign', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, newTechnician: newTech })
            });
            if (res.ok) {
                // Refresh local
                const r = allReports.find(x => x.id === reportId);
                if(r) r.tecnico = newTech;
                renderMain();
            } else {
                alert("Error al reasignar");
            }
        } catch (e) { alert("Error de conexión"); }
    };

    // Init
    checkAuth();
});
