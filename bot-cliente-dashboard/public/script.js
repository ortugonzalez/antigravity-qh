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
    const tabsContainer = document.getElementById('technician-tabs');
    const syncTimeLabel = document.getElementById('last-sync-time');

    let allReports = [];
    let availableTechs = [];
    
    let currentStateFilter = 'Todos'; 
    let currentTechFilter = 'Todos';
    let firstLoadDone = false;

    const ESTADOS = ['Pendiente', 'En Curso', 'Facturación', 'Cerrado'];

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
        
        setInterval(() => {
            if(!dashboardLayout.classList.contains('hidden')){
                fetchData(true); 
            }
        }, 60000);
    };

    const showToast = (msg, color = '#0086CE') => {
        toast.textContent = msg;
        toast.style.backgroundColor = color;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // --- DATA ---
    const fetchData = async (silent = false) => {
        try {
            if(!silent) refreshBtn.textContent = '⚡...';
            const res = await fetch('/api/bot-data');
            if (!res.ok) {
                if (res.status === 401) showLogin();
                throw new Error('Error');
            }
            const result = await res.json();
            allReports = result.data || [];
            availableTechs = result.technicians || [];
            
            const now = new Date();
            syncTimeLabel.textContent = `Última Sync: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
            
            updateSidebar();
            renderMain();
        } catch (e) {
            console.error("Error bg_sync:", e);
        } finally {
            refreshBtn.textContent = '⚡ Sincronizar';
        }
    };

    refreshBtn.addEventListener('click', () => fetchData(false));

    // V6 Generator: Generate simple local timestamp stamp
    const generateAuditLog = () => {
        const currentUser = currentUserSpan.textContent.toLowerCase();
        const now = new Date();
        const strDate = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}`;
        const strTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        return `Última act. por: ${currentUser} el ${strDate} - ${strTime}`;
    }

    // --- UI RENDERING ---
    const updateSidebar = () => {
        const counts = { 'Todos': allReports.length };
        
        ESTADOS.forEach(e => counts[e] = 0);

        allReports.forEach(r => {
            const st = r.estado_normalizado || r.estado || r.Estado || r['ESTADO DE TICKET'] || r['ESTADO TICKET'] || 'Pendiente';
            counts[st] = (counts[st] || 0) + 1;
        });

        catList.innerHTML = '';
        
         const liTodos = document.createElement('li');
         if ('Todos' === currentStateFilter) liTodos.classList.add('active');
         liTodos.innerHTML = `<span>Todos</span> <span class="count">${counts['Todos']}</span>`;
         liTodos.addEventListener('click', () => {
             currentStateFilter = 'Todos';
             currentCatTitle.textContent = 'Todos los Tickets';
             Array.from(catList.children).forEach(c => c.classList.remove('active'));
             liTodos.classList.add('active');
             renderMain();
         });
         catList.appendChild(liTodos);

        ESTADOS.forEach(est => {
            const li = document.createElement('li');
            if (est === currentStateFilter) li.classList.add('active');
            li.innerHTML = `<span>${est}</span> <span class="count">${counts[est]}</span>`;
            li.addEventListener('click', () => {
                currentStateFilter = est;
                currentCatTitle.textContent = `Tickets: ${est}`;
                Array.from(catList.children).forEach(c => c.classList.remove('active'));
                li.classList.add('active');
                renderMain();
            });
            catList.appendChild(li);
        });
    };

    const buildTabs = (techsInViewArray, byTec) => {
         tabsContainer.innerHTML = '';
         
         const btnTodos = document.createElement('button');
         btnTodos.className = `tab-btn ${currentTechFilter === 'Todos' ? 'active' : ''}`;
         const totalFiltered = techsInViewArray.reduce((acc, curr) => acc + (byTec[curr]?.length || 0), 0);
         btnTodos.innerHTML = `TODAS <span class="badge">${totalFiltered}</span>`;
         btnTodos.onclick = () => { currentTechFilter = 'Todos'; renderMain(); };
         tabsContainer.appendChild(btnTodos);
         
         techsInViewArray.forEach(t => {
             const btn = document.createElement('button');
             btn.className = `tab-btn ${currentTechFilter === t.toLowerCase() ? 'active' : ''}`;
             btn.innerHTML = `👷 ${t} <span class="badge">${byTec[t]?.length || 0}</span>`;
             btn.onclick = () => { currentTechFilter = t.toLowerCase(); renderMain(); };
             tabsContainer.appendChild(btn);
         });
    }

    const renderMain = () => {
        container.innerHTML = '';
        
        let filteredByState = allReports;
        if (currentStateFilter !== 'Todos') {
            filteredByState = allReports.filter(r => {
                const s = r.estado_normalizado || r.estado || r.Estado || r['ESTADO DE TICKET'] || r['ESTADO TICKET'] || 'Pendiente';
                return s === currentStateFilter;
            });
        }

        if (filteredByState.length === 0) {
            tabsContainer.innerHTML = ''; 
            container.innerHTML = '<div class="empty-state">No hay informes en este estado.</div>';
            return;
        }

        const byTec = {};
        const openUser = currentUserSpan.textContent.toLowerCase();
        
        filteredByState.forEach(r => {
            const rawTec = r.tecnico_normalizado || r.tecnico || r['Técnico'] || r.Tecnico || 'Sin Asignar';
            const tec = rawTec.toLowerCase();
            if (!byTec[tec]) byTec[tec] = [];
            byTec[tec].push(r);
        });

        const techsInView = Object.keys(byTec).sort();
        
        if (!firstLoadDone) {
             if (techsInView.includes(openUser)) {
                 currentTechFilter = openUser;
             }
             firstLoadDone = true;
        }

        if (currentTechFilter !== 'Todos' && !techsInView.includes(currentTechFilter)) {
             currentTechFilter = 'Todos';
        }

        buildTabs(techsInView, byTec);

        let finalFiltered = [];
        if (currentTechFilter === 'Todos') {
             finalFiltered = filteredByState;
        } else {
             finalFiltered = byTec[currentTechFilter] || [];
        }

        if (finalFiltered.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay informes para este técnico aquí.</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'technicians-grid';

        finalFiltered.forEach(req => {
            const urg = (req.urgencia || req.Urgencia || req['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
            let urgColor = '#00b4d8'; let borderColor = '#0086CE';
            if (urg.includes('alta')) { urgColor = '#ff3366'; borderColor = '#ff3366'; }
            else if (urg.includes('media')) { urgColor = '#ffcc00'; borderColor = '#ffcc00'; }

            const estadoActual = req.estado_normalizado || req.estado || req.Estado || req['ESTADO DE TICKET'] || req['ESTADO TICKET'] || 'Pendiente';
            const ticketId = req.id.length > 10 ? req.id.substring(0,5) : req.id; 
            
            let itemClasses = 'report-item';
            if (estadoActual.toLowerCase() === 'facturación' || estadoActual.toLowerCase() === 'facturacion') itemClasses += ' facturacion';
            if (estadoActual.toLowerCase() === 'cerrado') itemClasses += ' cerrado';

            let statusHtml = '';
            ESTADOS.forEach(est => {
                const sel = (est.toLowerCase() === estadoActual.toLowerCase()) ? 'selected' : '';
                statusHtml += `<option value="${est}" ${sel}>${est}</option>`;
            });
            if(!ESTADOS.some(e => e.toLowerCase() === estadoActual.toLowerCase())) {
                 statusHtml += `<option value="${estadoActual}" selected>⚠️ ${estadoActual} (Mover)</option>`;
            }
            
            const rawTec = req.tecnico_normalizado || req.tecnico || req['Técnico'] || req.Tecnico || 'Sin Asignar';
            let techHtml = '';
            availableTechs.forEach(t => {
                techHtml += `<option value="${t}" ${t.toLowerCase() === rawTec.toLowerCase() ? 'selected' : ''}>${t}</option>`;
            });

            const notas = req.notas_internas || '';
            const catDisplay = req.categoria_normalizada || req['TIPO DE SERVICIO'] || 'Sin Cat.';
            // V6: Extract existing log
            const auditStr = req.ultima_actualizacion_log || '';
            
            const item = document.createElement('div');
            item.className = itemClasses;
            item.style.borderLeftColor = itemClasses.includes('facturacion') || itemClasses.includes('cerrado') ? '' : borderColor;
            item.innerHTML = `
                <div class="report-header">
                    <div class="header-left">
                        <span class="company-name"><span class="ticket-id">#${ticketId}</span> ${req.empresa || req.Empresa || req.EMPRESA || 'Empresa Desconocida'}</span>
                        <span class="client-name">📞 ${req.telefono || req['NUMERO DE CONTACTO'] || '-'} · 👤 ${req.nombre || req.Nombre || req['NOMBRE DE CLIENTE'] || req['NOMBRE CLIENTE'] || 'Cliente'}</span>
                    </div>
                    <div class="badges-container">
                        <span class="badge" style="background-color: rgba(255,255,255,0.1); color: #fff;">👷 ${rawTec.toUpperCase()}</span>
                        <span class="badge" style="background-color: rgba(255,255,255,0.1); color: #ccc;">📦 ${catDisplay}</span>
                        <span class="badge" style="background-color: ${urgColor}22; color: ${urgColor}">${urg.toUpperCase()}</span>
                    </div>
                </div>
                <p class="report-desc">📝 ${req.informe || req.Informe || req['DESCRIPCION SUCESO'] || 'Sin descripción detallada.'}</p>
                
                <div class="management-grid">
                    <div class="widget-box">
                        <label>📍 Reasignar Tarea</label>
                        <select id="sel-${req.id}" class="select-styled">${techHtml}</select>
                        <button class="action-btn" onclick="reassign('${req.id}')">Transferir Manual</button>
                    </div>
                    
                    <div class="widget-box">
                        <label>🚦 Estado y Notas</label>
                        <select id="stat-${req.id}" class="select-styled">${statusHtml}</select>
                        <textarea id="not-${req.id}" class="notes-area" placeholder="Agrega notas de seguimiento internas aquí...">${notas}</textarea>
                        <span class="audit-trail">${auditStr}</span>
                        <button class="action-btn" style="margin-top:8px" onclick="updateTicket('${req.id}')">💾 Guardar Estado</button>
                    </div>
                </div>
            `;
            grid.appendChild(item);
        });
        container.appendChild(grid);
    };

    window.reassign = async (reportId) => {
        const newTech = document.getElementById(`sel-${reportId}`).value;
        const auditLogStr = generateAuditLog(); // V6: Create audit str
        try {
            const res = await fetch('/api/reassign', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, newTechnician: newTech, auditLog: auditLogStr })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === reportId);
                if(r) { 
                    r.tecnico_normalizado = newTech; 
                    r.tecnico = newTech; 
                    r.ultima_actualizacion_log = auditLogStr;
                }
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
        const auditLogStr = generateAuditLog(); // V6: Create audit str
        
        try {
            const res = await fetch('/api/update-ticket', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, estado: nuevoEstado, notas: nuevasNotas, auditLog: auditLogStr })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === reportId);
                if(r) { 
                    r.estado_normalizado = nuevoEstado;
                    r.estado = nuevoEstado;
                    r.notas_internas = nuevasNotas;
                    r.ultima_actualizacion_log = auditLogStr;
                }
                renderMain(); 
                const renderId = r.id.length > 10 ? r.id.substring(0,3) : r.id;
                showToast(`Ticket #${renderId} Actualizado en Server (y n8n)`);
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
