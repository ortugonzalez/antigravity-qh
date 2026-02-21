const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const path = require('path');
const crypto = require('crypto');
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

let currentReports = [];

// Base de datos simulada
const validUsers = {
    'admin': 'admin123',
    'franco': '1234',
    'hugo': '1234',
    'octavio': '1234'
};
const allTechnicians = ['Sin Asignar', 'franco', 'hugo', 'octavio'];

// Auth middleware
const checkAuth = (req, res, next) => {
    const user = req.cookies.auth_user;
    if (user && validUsers[user]) {
        req.user = user;
        next();
    } else {
        res.status(401).json({ status: 'error', message: 'No autorizado' });
    }
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (validUsers[username] && validUsers[username] === password) {
        res.cookie('auth_user', username, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
        res.json({ status: 'success', username });
    } else {
        res.status(401).json({ status: 'error', message: 'Credenciales inválidas' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_user');
    res.json({ status: 'success' });
});

app.get('/api/check-auth', (req, res) => {
    const user = req.cookies.auth_user;
    if (user && validUsers[user]) {
        res.json({ status: 'success', username: user });
    } else {
        res.status(401).json({ status: 'error' });
    }
});

app.post('/webhook/n8n-data', (req, res) => {
    let incoming = [];
    if (req.body.reports && Array.isArray(req.body.reports)) {
        incoming = req.body.reports; 
    } else if (req.body.report) {
        incoming = [req.body.report];
    } else if (Array.isArray(req.body)) {
        incoming = req.body;
    } else {
        incoming = [req.body];
    }
    
    incoming.forEach(item => {
        let data = item.report || item;
        // Asignar ID unico si no tiene para poder reasignarlo
        if (!data.id) {
            data.id = crypto.randomUUID();
        }
        currentReports.push(data);
    });
    
    console.log(`📥 Datos recibidos. Total en memoria: ${currentReports.length}`);
    res.json({ status: "success", received: true, total: currentReports.length });
});

app.get('/api/bot-data', checkAuth, (req, res) => {
    res.json({ status: "success", data: currentReports, technicians: allTechnicians });
});

app.post('/api/reassign', checkAuth, (req, res) => {
    const { reportId, newTechnician } = req.body;
    const report = currentReports.find(r => r.id === reportId);
    if (report) {
        report.tecnico = newTechnician;
        // Limpiamos llaves antiguas si existen
        delete report.Tecnico;
        delete report['Técnico'];
        res.json({ status: "success", report });
    } else {
        res.status(404).json({ status: "error", message: "Reporte no encontrado" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor V2 iniciado en http://0.0.0.0:${PORT}`);
    process.on('SIGTERM', () => {
        console.log('Recibida señal SIGTERM, apagando...');
        process.exit(0);
    });
});
