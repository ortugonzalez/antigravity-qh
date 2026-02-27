document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const dashboardLayout = document.getElementById('dashboard-layout');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    const refreshBtn = document.getElementById('refresh-btn');
    const container = document.getElementById('reports-container');
    const companiesContainer = document.getElementById('companies-container');
    const catList = document.getElementById('categories-list');
    const currentCatTitle = document.getElementById('current-category-title');
    const currentUserSpan = document.getElementById('current-username');
    const toast = document.getElementById('toast');
    const estadosTitle = document.getElementById('estados-title');
    const navTickets = document.getElementById('nav-tickets');
    const navEmpresas = document.getElementById('nav-empresas');
    const headerControls = document.querySelector('.header-controls');
    const tabsContainer = document.getElementById('technician-tabs');
    const syncTimeLabel = document.getElementById('last-sync-time');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const timeFilter = document.getElementById('time-filter');
    const exportBtn = document.getElementById('export-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const notiBell = document.getElementById('noti-bell');
    const notiBadge = document.getElementById('noti-badge');
    const notiDropdown = document.getElementById('noti-dropdown');

    const closeMobileMenu = () => { /* deprecated */ };

    let isDarkTheme = true;
    themeToggle.addEventListener('click', () => {
        isDarkTheme = !isDarkTheme;
        if(isDarkTheme) {
            document.body.classList.remove('light-theme');
            themeToggle.textContent = '☀️';
        } else {
            document.body.classList.add('light-theme');
            themeToggle.textContent = '🌙';
        }
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.log('SW fail', e)));
    }
    
    let deferredPrompt;
    const installBtn = document.getElementById('install-pwa-btn');
    
    // Detect Safari iOS
    const isIos = () => {
        return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };
    const isInStandaloneMode = () => ('standalone' in window.navigator) && window.navigator.standalone;

    if (isIos() && !isInStandaloneMode()) {
        if(installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.innerHTML = '🍎 Guardar App (Safari iOS)';
            installBtn.addEventListener('click', () => {
                alert("Para Instalar la App en iPad/iPhone:\n\n1. Toca el botón ⬆️ (Compartir) en tu barra de herramientas Safari en el pie de página.\n2. Desliza hacia abajo y selecciona ➕ 'Agregar a Inicio'.");
            });
        }
    } else if (!isInStandaloneMode()) {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if(installBtn) installBtn.classList.remove('hidden');
        });
        if(installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') installBtn.classList.add('hidden');
                    deferredPrompt = null;
                }
            });
        }
    }

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
    const mBtnUpdate = document.getElementById('btn-update-status');
    const mBtnUnlock = document.getElementById('btn-unlock-ticket');

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

    const doLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    };
    if(logoutBtn) logoutBtn.addEventListener('click', doLogout);
    if(logoutBtnMobile) logoutBtnMobile.addEventListener('click', doLogout);

    const showLogin = () => {
        loginOverlay.classList.remove('hidden');
        dashboardLayout.classList.add('hidden');
    };
    
    const showDashboard = () => {
        loginOverlay.classList.add('hidden');
        dashboardLayout.classList.remove('hidden');
        if(['admin', 'hugo'].includes(currentUserSpan.textContent.toLowerCase())) exportBtn.classList.remove('hidden');
        fetchData();
        setupSSE();
    };

    exportBtn.onclick = () => {
        let csv = "ID,FECHA,EMPRESA,TECNICO,ESTADO,NOTAS,URGENCIA,INFORME\n";
        allReports.forEach(r => {
             const eStr = s => (s||'').toString().replace(/"/g, '""').replace(/\n/g, ' ');
             csv += `"${eStr(r.id)}","${eStr(r.fecha||r['FEHCA Y HORA']||'')}","${eStr(r.empresa||r.Empresa||'')}","${eStr(r.tecnico_normalizado)}","${eStr(r.estado_normalizado)}","${eStr(r.notas_internas)}","${eStr(r.urgencia||r.Urgencia||'')}","${eStr(r.informe||r.Informe||'')}"\n`;
        });
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'informes_export.csv'; a.click();
    };

    let evtSource = null;
    let sseAudioPlayed = false;
    const playDing = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            osc.stop(ctx.currentTime + 0.5);
        } catch(e){}
    };
    
    // Auto-habilita el audio despues de hacer clic manual por primera vez
    document.body.addEventListener('click', () => { sseAudioPlayed = true; }, { once: true });

    const setupSSE = () => {
        if(evtSource) return;
        evtSource = new EventSource('/api/events');
        evtSource.onmessage = (e) => {
            if(dashboardLayout.classList.contains('hidden')) return;
            const data = JSON.parse(e.data);
            if(data.type === 'update') {
               if(sseAudioPlayed) playDing();
               fetchData(true);
            }
        };
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
            window.allReclamos = result.reclamos || [];
            
            const now = new Date();
            syncTimeLabel.textContent = `Última Sync: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
            
            updateSidebar();
            renderMain();
            
            // Si el modal esta abierto, repintarlo silenciosamente
            if (currentOpenReportId && !ticketModal.classList.contains('hidden')) {
                const rep = allReports.find(r => r.id === currentOpenReportId);
                if (rep) populateModalFilters(rep, true); // true = solo actualiza datos sin cerrar dropdowns
            }
            
            processNotifications();

        } catch (e) {
            console.error("Error bg_sync:", e);
        } finally {
            refreshBtn.textContent = '⚡ Sync';
        }
    };

    refreshBtn.addEventListener('click', () => fetchData(false));
    searchInput.addEventListener('input', () => renderMain());
    sortSelect.addEventListener('change', () => renderMain());

    const processNotifications = () => {
        const myName = currentUserSpan.textContent.toLowerCase();
        let unread = 0;
        let notiHtml = '';
        
        if (myName === 'octavio' && window.allReclamos && window.allReclamos.length > 0) {
            window.allReclamos.forEach(rec => {
                unread++;
                notiHtml += `<div class="noti-item" style="border-left-color:#ff3366" onclick="openReclamoView('${rec.id}'); notiDropdown.classList.add('hidden');"><b>🚨 RECLAMO</b>: ${rec.titulo} (de ${rec.autor})</div>`;
            });
        }
        
        allReports.filter(r => r.estado_normalizado !== 'Cerrado' && r.estado !== 'Cerrado').forEach(r => {
            let isRelevant = false; let reason = '';
            const tId = r.id.length>6 ? r.id.substring(0,5) : r.id;
            
            if (r.history_array && r.history_array.length > 0) {
                const recentLog = r.history_array[0].toLowerCase();
                if (recentLog.includes('@' + myName) || recentLog.includes('@ ' + myName)) {
                    isRelevant = true; reason = 'Te mencionaron en el caso.';
                }
            }
            
            const isMine = (r.tecnico_normalizado || r.tecnico || '').toLowerCase() === myName;
            if (isMine && (r.estado_normalizado === 'Pendiente' || r.estado === 'Pendiente')) {
                isRelevant = true; reason = 'Nuevo caso Pendiente asignado a ti.';
            }

            if (isRelevant) {
                unread++;
                notiHtml += `<div class="noti-item" onclick="switchView('tickets'); openModal('${r.id}'); notiDropdown.classList.add('hidden');"><b>#${tId}</b>: ${reason}</div>`;
            }
        });

        if (unread > 0) {
            notiBadge.textContent = unread;
            notiBadge.classList.remove('hidden');
            notiDropdown.innerHTML = notiHtml;
        } else {
            notiBadge.classList.add('hidden');
            notiDropdown.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem; text-align:center;">No hay novedades</div>';
        }
    };
    notiBell.addEventListener('click', () => notiDropdown.classList.toggle('hidden'));

    // V7 Generator: Format string action
    const generateAuditStr = (actionDesc) => {
        const currentUser = currentUserSpan.textContent.toLowerCase();
        const now = new Date();
        const strDate = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}`;
        const strTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        return `[${strDate} - ${strTime}] ${currentUser.toUpperCase()}: ${actionDesc}`;
    }

    // --- V12 VIEWS LOGIC ---
    let currentMainView = 'tickets'; // 'tickets' o 'empresas'
    window.switchView = (view) => {
        currentMainView = view;
        closeMobileMenu();
        if(view === 'tickets') {
            navTickets.classList.add('active'); navEmpresas.classList.remove('active');
            container.classList.remove('hidden'); companiesContainer.classList.add('hidden');
            catList.classList.remove('hidden'); estadosTitle.classList.remove('hidden');
            headerControls.classList.remove('hidden'); tabsContainer.classList.remove('hidden');
            currentCatTitle.textContent = 'Todos los Tickets';
            renderMain();
        } else {
            navTickets.classList.remove('active'); navEmpresas.classList.add('active');
            container.classList.add('hidden'); companiesContainer.classList.remove('hidden');
            catList.classList.add('hidden'); estadosTitle.classList.add('hidden');
            headerControls.classList.add('hidden'); tabsContainer.classList.add('hidden');
            currentCatTitle.textContent = 'Directorio de Empresas';
            renderCompanies();
        }
    };

    const renderCompanies = () => {
        companiesContainer.innerHTML = '';
        const compMap = {};
        allReports.forEach(r => {
            const empName = r.empresa || r.Empresa || r.EMPRESA || 'Desconocido';
            if(!compMap[empName]) compMap[empName] = { count: 0, closed: 0, pending: 0, lastTick: null };
            compMap[empName].count++;
            
            const st = r.estado_normalizado || r.estado || 'Pendiente';
            if(st.toLowerCase() === 'cerrado') compMap[empName].closed++;
            else if(st.toLowerCase() === 'pendiente') compMap[empName].pending++;
            
            if(r.createdAt && (!compMap[empName].lastTick || r.createdAt > compMap[empName].lastTick)) {
                 compMap[empName].lastTick = r.createdAt;
            }
        });

        companiesContainer.innerHTML = '';
        const topPanel = document.createElement('div');
        topPanel.className = 'top-companies-panel';
        
        const sortedComps = Object.keys(compMap)
             .filter(emp => emp.toLowerCase() !== 'desconocido')
             .sort((a,b) => compMap[b].count - compMap[a].count);
             
        const top5 = sortedComps.slice(0, 5);
        let rank = 1;
        top5.forEach(emp => {
            const data = compMap[emp];
            topPanel.innerHTML += `
                <div class="top-pill">
                    <div class="top-pill-number">#${rank++}</div>
                    <div class="top-pill-name">🏢 ${emp}</div>
                    <div style="font-size:0.75rem; color:#a0a0b0; margin-top:5px; font-weight:800;">🔥 ${data.count} TOTALES | ⚠️ ${data.pending} PEND.</div>
                </div>
            `;
        });
        if(top5.length > 0) companiesContainer.appendChild(topPanel);

        const grid = document.createElement('div');
        grid.className = 'technicians-grid';
        Object.keys(compMap).sort().forEach(empName => {
            const data = compMap[empName];
            const card = document.createElement('div');
            card.className = 'company-card';
            let dateStr = 'Sin fecha';
            if(data.lastTick) {
                 const d = new Date(data.lastTick);
                 dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            }
            card.innerHTML = `
                <h3>🏢 ${empName}</h3>
                <p>Historial Total: <b>${data.count}</b> tickets</p>
                <p>Último: ${dateStr}</p>
                <div class="company-stats">
                    <span class="badge" style="background:rgba(255,51,102,0.2); color:#ff3366">${data.pending} Pendientes</span>
                    <span class="badge" style="background:rgba(158,158,158,0.2); color:#ccc">${data.closed} Cerrados</span>
                </div>
            `;
            // Click visual para filtrar en tickets
            card.onclick = () => {
                 searchInput.value = empName;
                 switchView('tickets');
            };
            grid.appendChild(card);
        });
        companiesContainer.appendChild(grid);
    };

    // --- UI RENDERING ---
    const updateSidebar = () => {
        if(currentMainView === 'empresas') renderCompanies();
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
             closeMobileMenu();
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
                closeMobileMenu();
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

    // V14 View Listener
    timeFilter.addEventListener('change', () => { renderMain(); renderCompanies(); });

    // V7 Simplificada
    const renderMain = () => {
        container.innerHTML = '';
        
        let filteredByState = allReports;
        
        // V14 Time Filter Logic
        const maxHours = timeFilter.value;
        if (maxHours !== 'all') {
            const msLimit = parseInt(maxHours) * 60 * 60 * 1000;
            const now = Date.now();
            filteredByState = filteredByState.filter(r => {
                if(!r.createdAt) return true; // keep edge cases
                return (now - r.createdAt) <= msLimit;
            });
        }

        if (currentStateFilter !== 'Todos') {
            filteredByState = filteredByState.filter(r => {
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

        // V9: Búsqueda Profunda
        const query = (searchInput.value || '').toLowerCase();
        if (query) {
             finalFiltered = finalFiltered.filter(r => {
                 const tEmp = (r.empresa || r.Empresa || r.EMPRESA || '').toLowerCase();
                 const tNom = (r.nombre || r.Nombre || r.NOMBRE || '').toLowerCase();
                 const tId = (r.id || '').toLowerCase();
                 
                 // Deep Search on Desc and History
                 const tDesc = (r.informe || r.Informe || r['DESCRIPCION SUCESO'] || r['Descripción Suceso'] || r.descripcion || r.Descripcion || '').toLowerCase();
                 const tHist = (r.history_array || []).join(' ').toLowerCase();
                 const tNotas = (r.notas_internas || '').toLowerCase();
                 
                 return tEmp.includes(query) || tNom.includes(query) || tId.includes(query) || tDesc.includes(query) || tHist.includes(query) || tNotas.includes(query);
             });
        }

        // V9: Ordenamiento
        const sortVal = sortSelect.value;
        finalFiltered.sort((a, b) => {
             if (sortVal === 'urgencia') {
                 const uA = (a.urgencia || a.Urgencia || a['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
                 const uB = (b.urgencia || b.Urgencia || b['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
                 const score = (u) => u.includes('alta') ? 3 : u.includes('media') ? 2 : 1;
                 return score(uB) - score(uA);
             } else if (sortVal === 'asc') {
                 return (a.createdAt || 0) - (b.createdAt || 0); // Antiguos primero
             } else {
                 return (b.createdAt || 0) - (a.createdAt || 0); // Recientes primero
             }
        });

        if (finalFiltered.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay informes para este técnico aquí.</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = currentStateFilter === 'Todos' ? 'kanban-board' : 'technicians-grid';

        const getCatGlobal = (r) => {
            const k = Object.keys(r).find(x => /categori|tipo/i.test(x));
            return k && typeof r[k] === 'string' ? r[k] : 'Sin Categoria';
        };

        const createItemNode = (req) => {
            const urg = (req.urgencia || req.Urgencia || req['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
            let urgColor = '#00b4d8'; let borderColor = '#0086CE'; let urgText = 'BAJA'; let urgIcon = '🟢';
            if (urg.includes('alta') || urg.includes('crític') || urg.includes('urgente')) { urgColor = '#ff3366'; borderColor = '#ff3366'; urgText = 'ALTA'; urgIcon = '🔴'; }
            else if (urg.includes('media') || urg.includes('normal')) { urgColor = '#ff9900'; borderColor = '#ff9900'; urgText = 'MEDIA'; urgIcon = '🟡'; }

            const estadoActual = req.estado_normalizado || req.estado || req.Estado || req['ESTADO DE TICKET'] || req['ESTADO TICKET'] || 'Pendiente';
            const ticketId = req.id.length > 10 ? req.id.substring(0,5) : req.id; 
            
            let itemClasses = 'report-item-mini';
            if (estadoActual.toLowerCase() === 'facturación' || estadoActual.toLowerCase() === 'facturacion') itemClasses += ' facturacion';
            if (estadoActual.toLowerCase() === 'cerrado') itemClasses += ' cerrado';

            // V13 Prettier SLA Badges
            let SLA_Html = '';
            if (estadoActual.toLowerCase() === 'pendiente' && req.createdAt) {
                 const hoursPassed = (Date.now() - req.createdAt) / (1000 * 60 * 60);
                 if (hoursPassed < 2) {
                     itemClasses += ' sla-blue';
                     borderColor = '#00b4d8';
                     SLA_Html = `<span class="badge" style="background:#00b4d8; color:#fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.8rem; padding: 5px 10px;">⏱️ SLA: < 2Hs</span>`;
                 } else if (hoursPassed < 12) {
                     itemClasses += ' sla-yellow';
                     borderColor = '#ffcc00';
                     SLA_Html = `<span class="badge" style="background:#ffcc00; color:#000; border: 1px solid rgba(0,0,0,0.3); font-size: 0.8rem; padding: 5px 10px;">⚠️ SLA: < 12Hs</span>`;
                 } else {
                     itemClasses += ' sla-red';
                     borderColor = '#ff3366';
                     SLA_Html = `<span class="badge" style="background:#ff3366; color:#fff; border: 1px solid rgba(255,255,255,0.4); font-size: 0.8rem; padding: 5px 10px; font-weight: 900;">🔥 SLA VENCIDO (> 12Hs)</span>`;
                 }
            }

            const rawTec = req.tecnico_normalizado || req.tecnico || req['Técnico'] || req.Tecnico || 'Sin Asignar';
            
            const catDisplay = req.categoria_normalizada || getCatGlobal(req);
            
            const descCorta = req.informe || req.Informe || req['DESCRIPCION SUCESO'] || req['Descripción Suceso'] || req.descripcion || req.Descripcion || 'Sin descripción...';
            
            const rawClient = req.nombre || req.Nombre || req.NOMBRE || req.Contacto || req.contacto || 'Cliente n/a';
            const rawPhone = req['Número'] || req.Número || req.numero || req.Numero || req['NUMERO DE CONTACTO'] || req.telefono || req.Telefono || req.TELEFONO || '---';
            const rawEmail = req['E-mail'] || req.email || req.Email || req.EMAIL || '';
            
            // V14 Has Notes Indicator
            const hasNotes = (req.notas_internas && req.notas_internas.trim().length > 0) || (req.history_array && req.history_array.length > 0);
            
            const isMyTicket = rawTec.toLowerCase() === openUser;
            if (isMyTicket) itemClasses += ' my-ticket-glow';

            const item = document.createElement('div');
            item.className = itemClasses;
            item.style.borderLeftColor = itemClasses.includes('facturacion') || itemClasses.includes('cerrado') ? '' : borderColor;
            
            // Kanban Drag logic
            item.setAttribute('draggable', 'true');
            item.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', req.id);
                item.style.opacity = '0.5';
            };
            item.ondragend = () => { item.style.opacity = '1'; };

            // Target Event click
            item.onclick = () => openModal(req.id);

            item.innerHTML = `
                <div class="mini-header">
                    <span class="mini-id">#${ticketId} ${hasNotes ? '💬' : ''}</span>
                    ${isMyTicket ? '<span class="badge" style="background:#0086CE; color:#fff; font-size:0.65rem;">⭐ MÍO</span>' : ''}
                </div>
                <div class="mini-title">${req.empresa || req.Empresa || req.EMPRESA || 'Desconocido'}</div>
                <div style="font-size: 0.8rem; color: #a0a0b0; margin-bottom: 5px;">👤 ${rawClient} | 📞 ${rawPhone} ${rawEmail ? '| ✉️ '+rawEmail : ''}</div>
                <div class="mini-tech">👷 ${rawTec.toUpperCase()}</div>
                <div class="mini-desc-text" style="font-size: 0.8rem; color: #a0a0b0; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3;">
                    ${descCorta}
                </div>
                <div class="mini-badges">
                    <span class="badge" style="background:${urgColor}20; border: 1px solid ${urgColor}; color:${urgColor}; margin-right:5px;">${urgIcon} PRIORIDAD ${urgText}</span>
                    ${SLA_Html}
                    <span class="badge" style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #a0a0b0; margin-left:5px;"><span style="opacity:0.6">📁</span> ${catDisplay}</span>
                </div>
            `;
            return item;
        };

        const renderCol = (estadoName, repsList) => {
             const col = document.createElement('div');
             col.className = 'kanban-col';
             col.innerHTML = `<h3>${estadoName} <span class="badge" style="background:rgba(255,255,255,0.1)">${repsList.length}</span></h3>`;
             const dz = document.createElement('div');
             dz.className = 'kanban-dropzone';
             dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag-over'); };
             dz.ondragleave = e => { dz.classList.remove('drag-over'); };
             dz.ondrop = async e => {
                 e.preventDefault(); dz.classList.remove('drag-over');
                 const reqId = e.dataTransfer.getData('text/plain');
                 if(!reqId) return;
                 const auditLogStr = generateAuditStr(`Movió ticket a [${estadoName}] vía Kanban Drop.`);
                 try {
                     const res = await fetch('/api/update-ticket', {
                         method: 'POST', headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify({ reportId: reqId, estado: estadoName, auditLog: auditLogStr })
                     });
                     if(res.ok) {
                         const r = allReports.find(x => x.id === reqId);
                         if(r) {
                             r.estado_normalizado = estadoName; r.estado = estadoName;
                             if(!r.history_array) r.history_array = [];
                             r.history_array.unshift(auditLogStr);
                         }
                         renderMain();
                         showToast(`Movido a ${estadoName}`);
                     }
                 } catch(err){}
             };
             
             repsList.forEach(req => dz.appendChild(createItemNode(req)));
             col.appendChild(dz);
             return col;
        };

        if (currentStateFilter === 'Todos') {
             ESTADOS.forEach(est => {
                 const reps = finalFiltered.filter(r => {
                      const st = r.estado_normalizado || r.estado || r.Estado || r['ESTADO DE TICKET'] || r['ESTADO TICKET'] || 'Pendiente';
                      return st === est;
                 });
                 grid.appendChild(renderCol(est, reps));
             });
        } else {
             finalFiltered.forEach(req => grid.appendChild(createItemNode(req)));
        }

        container.appendChild(grid);
        
        // V15.1 Drag to scroll Kanban
        setTimeout(() => {
            const slider = document.querySelector('.kanban-board');
            if(!slider) return;
            let isDown = false, startX, scrollLeft;
            slider.addEventListener('mousedown', (e) => {
                isDown = true; slider.classList.add('active');
                startX = e.pageX - slider.offsetLeft;
                scrollLeft = slider.scrollLeft;
            });
            slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
            slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
            slider.addEventListener('mousemove', (e) => {
                if(!isDown) return;
                e.preventDefault();
                const x = e.pageX - slider.offsetLeft;
                slider.scrollLeft = scrollLeft - (x - startX) * 2;
            });
        }, 100);
    };

    // V7 MODAL LOGIC
    window.openModal = (reportId) => {
        const req = allReports.find(r => r.id === reportId);
        if(!req) return;
        currentOpenReportId = reportId;

        const ticketId = req.id.length > 10 ? req.id.substring(0,5) : req.id; 
        mId.textContent = `#${ticketId}`;
        mEmpresa.textContent = req.empresa || req.Empresa || req.EMPRESA || 'Desconocido';
        
        const rawClient = req.nombre || req.Nombre || req.NOMBRE || req.Contacto || req.contacto || 'Cliente n/a';
        const rawPhone = req['Número'] || req.Número || req.numero || req.Numero || req['NUMERO DE CONTACTO'] || req.telefono || req.Telefono || req.TELEFONO || '---';
        const rawEmail = req['E-mail'] || req.email || req.Email || req.EMAIL || '';
        
        const getCatGlobalModal = (r) => {
            const k = Object.keys(r).find(x => /categori|tipo/i.test(x));
            return k && typeof r[k] === 'string' ? r[k] : 'Sin Categoria';
        };
        const rawCat = req.categoria_normalizada || getCatGlobalModal(req);
        const rawDesc = req.informe || req.Informe || req.INFORME || req['DESCRIPCION SUCESO'] || req['Descripción Suceso'] || req.descripcion || req.Descripcion || 'Sin descripción detallada.';
        
        let contactoHtml = `<div style="margin-bottom:8px;">👤 <b style="color:#fff;">${rawClient}</b></div>`;
        contactoHtml += `<div style="display:flex; gap:10px; flex-wrap:wrap;">`;
        if(rawPhone !== '---') {
             contactoHtml += `<button class="secondary-btn" style="padding:4px 10px; font-size:0.8rem; border-radius:15px; display:flex; gap:5px; align-items:center;" onclick="navigator.clipboard.writeText('${rawPhone}'); showToast('📱 Teléfono copiado');" title="Copiar Teléfono">📞 ${rawPhone}</button>`;
        } else {
             contactoHtml += `<span style="opacity:0.5; align-self:center;">📞 Sin teléfono</span>`;
        }
        if(rawEmail) {
             contactoHtml += `<button class="secondary-btn" style="padding:4px 10px; font-size:0.8rem; border-radius:15px; display:flex; gap:5px; align-items:center;" onclick="navigator.clipboard.writeText('${rawEmail}'); showToast('📧 Email copiado');" title="Copiar Email">✉️ ${rawEmail}</button>`;
        }
        contactoHtml += `</div>`;
        
        mContacto.innerHTML = contactoHtml;
        mCategoria.textContent = rawCat;
        mDesc.textContent = rawDesc;
        
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
        const isClosed = estadoActual.toLowerCase() === 'cerrado';

        // Solo repintar selects si NO es una actualizacion de background silenciosa
        if (!softUpdate) {
            
            mStatusSelect.disabled = isClosed;
            mTechSelect.disabled = isClosed;
            mNotes.disabled = isClosed;
            mNotes.value = ''; // Ensure text area is empty
            
            if (isClosed) {
                mBtnUpdate.classList.add('hidden');
                mBtnUnlock.classList.remove('hidden');
            } else {
                mBtnUpdate.classList.remove('hidden');
                mBtnUnlock.classList.add('hidden');
            }

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

    mBtnUpdate.onclick = async () => {
        mBtnUpdate.textContent = "Guardando...";
        const nuevoEstado = mStatusSelect.value;
        const nuevasNotas = mNotes.value.trim();
        const nuevoTech = mTechSelect.value;
        
        // V14 Unified Action Desc
        let actionDesc = `Modificó ticket.`;
        const reqLocal = allReports.find(x => x.id === currentOpenReportId);
        
        const oldState = reqLocal.estado_normalizado || reqLocal.estado || 'Pendiente';
        const oldTech = reqLocal.tecnico_normalizado || reqLocal.tecnico || 'Sin Asignar';
        
        if (oldState !== nuevoEstado) actionDesc += ` [Estado: ${nuevoEstado}].`;
        if (oldTech !== nuevoTech) actionDesc += ` [Asignado a: ${nuevoTech}].`;
        
        if (nuevasNotas !== '') {
             actionDesc += ` (Nota): "${nuevasNotas}"`;
        }
        
        const auditLogStr = generateAuditStr(actionDesc);
        
        try {
            const res = await fetch('/api/update-ticket', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: currentOpenReportId, estado: nuevoEstado, tecnico: nuevoTech, notas: nuevasNotas, auditLog: auditLogStr })
            });
            if (res.ok) {
                const r = reqLocal;
                if(r) { 
                    r.estado_normalizado = nuevoEstado; r.estado = nuevoEstado; 
                    r.notas_internas = ''; // CLEAR LOCAL STATE
                    r.tecnico = nuevoTech; r.tecnico_normalizado = nuevoTech;
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

    mBtnUnlock.onclick = async () => {
        mBtnUnlock.textContent = "🔓 Desbloqueando...";
        const actionDesc = "Reabrió el ticket [Estado: Pendiente].";
        const auditLogStr = generateAuditStr(actionDesc);
        try {
            const res = await fetch('/api/update-ticket', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: currentOpenReportId, estado: 'Pendiente', auditLog: auditLogStr })
            });
            if (res.ok) {
                const r = allReports.find(x => x.id === currentOpenReportId);
                if(r) { 
                    r.estado_normalizado = 'Pendiente'; r.estado = 'Pendiente';
                    if(!r.history_array) r.history_array = [];
                    r.history_array.unshift(auditLogStr);
                }
                populateModalFilters(r, false);
                renderMain(); 
                showToast(`Ticket Reabierto.`);
            }
        } catch (e) { showToast('Error', '#ff3366'); } 
        finally { mBtnUnlock.textContent = "🔓 Reabrir Ticket"; }
    };

    // Close modal on outside click
    ticketModal.addEventListener('click', (e) => {
        if(e.target === ticketModal) closeModal();
    });

    // RECLAMOS FRONTEND LOGIC
    const reclamoModal = document.getElementById('reclamo-modal');
    window.openReclamoModal = () => { reclamoModal.classList.remove('hidden'); closeMobileMenu && closeMobileMenu(); };
    window.closeReclamoModal = () => { 
        reclamoModal.classList.add('hidden'); 
        document.getElementById('reclamo-titulo').value = '';
        document.getElementById('reclamo-desc').value = '';
        document.getElementById('reclamo-file').value = '';
        document.getElementById('reclamo-preview').style.display = 'none';
        document.getElementById('reclamo-preview').src = '';
    };

    const reclamoFile = document.getElementById('reclamo-file');
    const reclamoPreview = document.getElementById('reclamo-preview');
    let reclamoBase64 = null;

    if(reclamoFile) {
        reclamoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width; let height = img.height;
                    if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    reclamoBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    reclamoPreview.src = reclamoBase64;
                    reclamoPreview.style.display = 'block';
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    const btnEnviarReclamo = document.getElementById('btn-enviar-reclamo');
    if(btnEnviarReclamo) {
        btnEnviarReclamo.onclick = async () => {
            const titulo = document.getElementById('reclamo-titulo').value.trim();
            const descripcion = document.getElementById('reclamo-desc').value.trim();
            if(!titulo || !descripcion) { showToast('Falta título o descripción', '#ff3366'); return; }
            btnEnviarReclamo.textContent = "Enviando...";
            try {
                const res = await fetch('/api/reclamo', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ titulo, descripcion, fotoBase64: reclamoBase64 })
                });
                if(res.ok) {
                    showToast('Reclamo Enviado!');
                    closeReclamoModal();
                } else { showToast('Error', '#ff3366'); }
            } catch(e) { showToast('Error de red', '#ff3366'); }
            btnEnviarReclamo.textContent = "Enviar Reclamo";
        };
    }

    window.openReclamoView = (id) => {
        const rec = window.allReclamos.find(x => x.id === id);
        if(!rec) return;
        document.getElementById('rv-titulo').textContent = rec.titulo;
        let html = `<p style="color:#a0a0b0; font-size:0.9rem;"><b>Técnico:</b> ${rec.autor.toUpperCase()}</p>`;
        html += `<p style="margin-top:10px; line-height:1.5;">${rec.descripcion}</p>`;
        if(rec.fotoBase64) html += `<img src="${rec.fotoBase64}" style="max-width:100%; max-height:400px; border-radius:8px; margin-top:15px; border:1px solid rgba(255,255,255,0.1);">`;
        document.getElementById('rv-body').innerHTML = html;
        document.getElementById('reclamo-view-modal').classList.remove('hidden');
    };

    // Init
    checkAuth();
});
