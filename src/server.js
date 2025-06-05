const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/payment', require('./routes/payment'));

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route de test
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'MVola Payment Demo Server',
        timestamp: new Date().toISOString()
    });
});

// Gestion d'erreur 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📱 Demo MVola: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
