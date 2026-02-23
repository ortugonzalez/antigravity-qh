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

    // Modal DOM
    const ticketModal = document.getElementById('ticket-modal');
    const mId = document.getElementById('modal-ticket-id');
    const mEmpresa = document.getElementById('modal-empresa');
    const mContacto = document.getElementById('modal-contacto');
    const mCategoria = document.getElementById('modal-categoria');
    const mDesc = document.getElementById('modal-descripcion');
    const mTechSelect = document.getElementById('modal-tech-select');
    const mStatusSelect = document.getElementById('modal-status-select');
    const mNotes = document.getElementById('modal-notes');
    const mHistory = document.getElementById('modal-history-list');
    const mBtnReassign = document.getElementById('btn-reassign');
    const mBtnUpdate = document.getElementById('btn-update-status');

    let allReports = [];
    let availableTechs = [];
    
    let currentStateFilter = 'Todos'; 
    let currentTechFilter = 'Todos';
    let firstLoadDone = false;
    let currentOpenReportId = null;

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
            
            // Si el modal esta abierto, repintarlo silenciosamente
            if (currentOpenReportId && !ticketModal.classList.contains('hidden')) {
                const rep = allReports.find(r => r.id === currentOpenReportId);
                if (rep) populateModalFilters(rep, true); // true = solo actualiza datos sin cerrar dropdowns
            }

        } catch (e) {
            console.error("Error bg_sync:", e);
        } finally {
            refreshBtn.textContent = '⚡ Sync';
        }
    };

    refreshBtn.addEventListener('click', () => fetchData(false));

    // V7 Generator: Format string action
    const generateAuditStr = (actionDesc) => {
        const currentUser = currentUserSpan.textContent.toLowerCase();
        const now = new Date();
        const strDate = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}`;
        const strTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        return `[${strDate} - ${strTime}] ${currentUser.toUpperCase()}: ${actionDesc}`;
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

    // V7 Simplificada
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
            
            let itemClasses = 'report-item-mini';
            if (estadoActual.toLowerCase() === 'facturación' || estadoActual.toLowerCase() === 'facturacion') itemClasses += ' facturacion';
            if (estadoActual.toLowerCase() === 'cerrado') itemClasses += ' cerrado';

            const rawTec = req.tecnico_normalizado || req.tecnico || req['Técnico'] || req.Tecnico || 'Sin Asignar';
            const catDisplay = req.categoria_normalizada || req['TIPO DE SERVICIO'] || 'Sin Cat.';
            
            const item = document.createElement('div');
            item.className = itemClasses;
            item.style.borderLeftColor = itemClasses.includes('facturacion') || itemClasses.includes('cerrado') ? '' : borderColor;
            
            // V7 Target Event click
            item.onclick = () => openModal(req.id);

            item.innerHTML = `
                <div class="mini-header">
                    <span class="mini-id">#${ticketId}</span>
                </div>
                <div class="mini-title">${req.empresa || req.Empresa || req.EMPRESA || 'Desconocido'}</div>
                <div class="mini-tech">👷 ${rawTec.toUpperCase()}</div>
                <div class="mini-badges">
                    <span class="badge" style="background-color: rgba(255,255,255,0.1); color: #ccc;">${catDisplay}</span>
                    <span class="badge" style="background-color: ${urgColor}22; color: ${urgColor}">${urg.toUpperCase()}</span>
                </div>
            `;
            grid.appendChild(item);
        });
        container.appendChild(grid);
    };

    // V7 MODAL LOGIC
    window.openModal = (reportId) => {
        const req = allReports.find(r => r.id === reportId);
        if(!req) return;
        currentOpenReportId = reportId;

        const ticketId = req.id.length > 10 ? req.id.substring(0,5) : req.id; 
        mId.textContent = `#${ticketId}`;
        mEmpresa.textContent = req.empresa || req.Empresa || req.EMPRESA || 'Desconocido';
        mContacto.textContent = `👤 ${req.nombre || 'Cliente'} - 📞 ${req.telefono || '-'}`;
        mCategoria.textContent = req.categoria_normalizada || req['TIPO DE SERVICIO'] || 'Sin Categoria';
        mDesc.textContent = req.informe || req.Informe || req['DESCRIPCION SUCESO'] || 'Sin descripción detallada.';
        
        populateModalFilters(req, false);
        
        ticketModal.classList.remove('hidden');
    };

    window.closeModal = () => {
        ticketModal.classList.add('hidden');
        currentOpenReportId = null;
    };

    const populateModalFilters = (req, softUpdate) => {
        const estadoActual = req.estado_normalizado || req.estado || req.Estado || req['ESTADO DE TICKET'] || req['ESTADO TICKET'] || 'Pendiente';
        const rawTec = req.tecnico_normalizado || req.tecnico || req['Técnico'] || req.Tecnico || 'Sin Asignar';
        const notas = req.notas_internas || '';

        // Solo repintar selects si NO es una actualizacion de background silenciosa, para no interrumpir al usuario mientras elige algo
        if (!softUpdate) {
            let statusHtml = '';
            ESTADOS.forEach(est => {
                const sel = (est.toLowerCase() === estadoActual.toLowerCase()) ? 'selected' : '';
                statusHtml += `<option value="${est}" ${sel}>${est}</option>`;
            });
            if(!ESTADOS.some(e => e.toLowerCase() === estadoActual.toLowerCase())) {
                 statusHtml += `<option value="${estadoActual}" selected>⚠️ ${estadoActual} (Mover)</option>`;
            }
            mStatusSelect.innerHTML = statusHtml;

            let techHtml = '';
            availableTechs.forEach(t => {
                techHtml += `<option value="${t}" ${t.toLowerCase() === rawTec.toLowerCase() ? 'selected' : ''}>${t}</option>`;
            });
            mTechSelect.innerHTML = techHtml;
            mNotes.value = notas;
        }

        // Historial siempre repintarlo, es seguro
        mHistory.innerHTML = '';
        const hArray = req.history_array || [];
        if(hArray.length === 0) {
            mHistory.innerHTML = '<span style="color:#666; font-size: 0.8rem">Sin historial.</span>';
        } else {
            hArray.forEach(log => {
                mHistory.innerHTML += `<div class="log-item">${log}</div>`;
            });
        }
    };

    mBtnReassign.onclick = async () => {
        const newTech = mTechSelect.value;
        const msg = `Reasignó el ticket a ${newTech.toUpperCase()}.`;
        const auditLogStr = generateAuditStr(msg); 
        mBtnReassign.textContent = "...";
        try {
            const res = await fetch('/api/reassign', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: currentOpenReportId, newTechnician: newTech, auditLog: auditLogStr })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === currentOpenReportId);
                if(r) { 
                    r.tecnico_normalizado = newTech; r.tecnico = newTech; 
                    if(!r.history_array) r.history_array = [];
                    r.history_array.unshift(auditLogStr);
                }
                populateModalFilters(r, false);
                renderMain();
                showToast(`Transferido a ${newTech.toUpperCase()}`);
            }
        } catch (e) { alert("Error"); }
        finally { mBtnReassign.textContent = "Transferir"; }
    };

    mBtnUpdate.onclick = async () => {
        mBtnUpdate.textContent = "Guardando...";
        const nuevoEstado = mStatusSelect.value;
        const nuevasNotas = mNotes.value.trim();
        
        // V8: Append notes to history log explicitly
        let actionDesc = `Actualizó estado a [${nuevoEstado}]`;
        if (nuevasNotas !== '') {
             actionDesc += ` (Nota): "${nuevasNotas}"`;
        }
        
        const auditLogStr = generateAuditStr(actionDesc);
        
        try {
            const res = await fetch('/api/update-ticket', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: currentOpenReportId, estado: nuevoEstado, notas: nuevasNotas, auditLog: auditLogStr })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === currentOpenReportId);
                if(r) { 
                    r.estado_normalizado = nuevoEstado; r.estado = nuevoEstado; r.notas_internas = nuevasNotas;
                    if(!r.history_array) r.history_array = [];
                    r.history_array.unshift(auditLogStr);
                }
                populateModalFilters(r, false);
                renderMain(); 
                showToast(`Cambios guardados.`);
            }
        } catch (e) { showToast('Error', '#ff3366'); } 
        finally { mBtnUpdate.textContent = "💾 Guardar Cambios"; }
    };

    // Close modal on outside click
    ticketModal.addEventListener('click', (e) => {
        if(e.target === ticketModal) closeModal();
    })

    // Init
    checkAuth();
});
