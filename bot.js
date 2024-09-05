const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = express();


const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const TOKEN = 'MTI4MTA4NTg5ODg4MDA2MTQ5Mg.GN3_g6.vzUCTknPcxjz_yQoQftdvOIM3DApCrT1A0Vsks';
const PUBLIC_CHANNEL_ID = '1281086809572380745';
const CREDENTIALS_CHANNEL_ID = '1281093610493841450';
const SECRET_KEY = 'YOUR_SECRET_KEY_HERE'; // Chave secreta para assinar tokens

const usersFile = 'users.json';

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Função para garantir que o arquivo users.json exista
function ensureUsersFile() {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify({}));
    }
}

// Middleware de autenticação usando token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // Se não houver token

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403); // Se o token não for válido
        req.user = user;
        next();
    });
}

// Quando o bot estiver pronto
client.once('ready', () => {
    console.log('Bot está online!');
});

// Função para armazenar credenciais no canal privado
function storeCredentials(username, password) {
    const channel = client.channels.cache.get(CREDENTIALS_CHANNEL_ID);
    if (channel) {
        channel.send(`Credenciais: ${username}:${password}`);
    }
}

// Rota para cadastro
app.post('/register', (req, res) => {
    ensureUsersFile();

    const { username, password } = req.body;

    fs.readFile(usersFile, (err, data) => {
        if (err) return res.status(500).send('Erro ao ler arquivo de usuários');

        const users = JSON.parse(data);

        if (users[username]) {
            return res.status(400).send('Usuário já existe');
        }

        users[username] = password;

        fs.writeFile(usersFile, JSON.stringify(users, null, 2), (err) => {
            if (err) return res.status(500).send('Erro ao salvar usuário');

            storeCredentials(username, password); // Armazenar credenciais no canal privado

            res.status(200).send('Cadastro realizado com sucesso');
        });
    });
});

// Rota para login
app.post('/login', (req, res) => {
    ensureUsersFile();

    const { username, password } = req.body;

    fs.readFile(usersFile, (err, data) => {
        if (err) return res.status(500).send('Erro ao ler arquivo de usuários');

        const users = JSON.parse(data);

        if (users[username] === password) {
            const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
            res.json({ token });
        } else {
            res.status(401).send('Credenciais inválidas');
        }
    });
});

// Recebe requisição para postar mensagem
app.post('/post', authenticateToken, (req, res) => {
    const { username, content } = req.body;
    const channel = client.channels.cache.get(PUBLIC_CHANNEL_ID);
    if (channel) {
        channel.send(`${username}: ${content}`);
        res.status(200).send('Postagem criada');
    } else {
        res.status(500).send('Canal não encontrado');
    }
});

// Rota para obter postagens
app.get('/posts', authenticateToken, async (req, res) => {
    const channel = client.channels.cache.get(PUBLIC_CHANNEL_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 100 });
        res.json(messages.filter(msg => !msg.content.startsWith('Credenciais:')).map(msg => ({ user: msg.author.username, content: msg.content })));
    } else {
        res.status(500).send('Canal não encontrado');
    }
});

// Inicie o servidor web
app.listen(3000, () => {
    console.log('Servidor web rodando na porta 3000');
});

// Faça o bot se conectar ao Discord
client.login(TOKEN);