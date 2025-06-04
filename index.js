const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Usuario = require('./models/Usuario');
const Aluno = require('./models/Aluno');
const Disciplina = require('./models/Disciplina');
const Matricula = require('./models/Matricula');
const requireLogin = require('./middleware/requireLogin');

const alunoRoutes = require('./routes/alunoRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();
const port = 5555;
require('dotenv/config');

mongoose.connect('mongodb+srv://bkgr:kt0z1KPZRgypHZCA@cluster0.ed1695b.mongodb.net/kelibin?retryWrites=true&w=majority&appName=Cluster0')
.then(() => console.log('Conexão com o MongoDB estabelecida com sucesso!'))
.catch(err => console.error('Erro ao conectar ao MongoDB2:', err));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'um_segredo_muito_seguro_e_aleatorio_para_producao',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));


app.use((req, res, next) => {
    res.locals.message = req.session.message;
    delete req.session.message;
    next();
});


app.use(async (req, res, next) => {
    res.locals.user = req.session.userId;
    res.locals.userEmail = null;
    res.locals.userName = null; 

    if (req.session.userId) {
        try {
            const loggedInUser = await Usuario.findById(req.session.userId);
            if (loggedInUser) {
                res.locals.userEmail = loggedInUser.email;
                res.locals.userName = loggedInUser.nome; 
            }
        } catch (error) {
            console.error("Erro ao buscar usuário logado para locals:", error);
        }
    }
    next();
});

function redirectIfLoggedIn(req, res, next) {
    if (req.session.userId) {
        req.session.message = { tipo: 'info', texto: 'Você já está logado!' };
        return res.redirect('/');
    }
    next();
}



app.get('/cadastro', redirectIfLoggedIn, (req, res) => {
    res.render('cadastro', { mensagem: null });
});

app.post('/cadastro', async (req, res) => {
    const { nome, email, senha, confirmarSenha } = req.body;

    if (senha !== confirmarSenha) {
        req.session.message = { tipo: 'danger', texto: 'As senhas não coincidem.' };
        return res.redirect('/cadastro');
    }

    try {
        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) {
            req.session.message = { tipo: 'danger', texto: 'E-mail já cadastrado.' };
            return res.redirect('/cadastro');
        }

        const hashedPassword = await bcrypt.hash(senha, 10);
        const novoUsuario = new Usuario({ nome, email, senha: hashedPassword });
        await novoUsuario.save();

        req.session.message = { tipo: 'success', texto: 'Usuário cadastrado com sucesso! Faça login.' };
        res.redirect('/login');

    } catch (error) {
        console.error("Erro ao cadastrar usuário:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao cadastrar usuário. Tente novamente.' };
        res.redirect('/cadastro');
    }
});

app.get('/login', redirectIfLoggedIn, (req, res) => {
    res.render('login', { mensagem: null });
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const usuario = await Usuario.findOne({ email });
        if (usuario && await bcrypt.compare(senha, usuario.senha)) {
            req.session.userId = usuario._id;
            res.redirect('/');
        } else {
            req.session.message = { tipo: 'danger', texto: 'Usuário ou senha inválidos.' };
            res.redirect('/login');
        }
    } catch (error) {
        console.error("Erro durante o login:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro interno do servidor. Tente novamente.' };
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            return res.status(500).send("Erro ao fazer logout.");
        }
        res.redirect('/login');
    });
});


app.get('/', requireLogin, async (req, res) => {
    try {
        const alunos = await Aluno.find().populate('disciplina');
        res.render('index', { alunos });
    } catch (error) {
        console.error("Erro ao carregar página inicial com alunos:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar dados dos alunos.' };
        res.status(500).redirect('/');
    }
});

app.post('/alunos', requireLogin, async (req, res) => {
    const { matricula, nome, disciplina } = req.body;
    console.log("Dados recebidos para cadastro de aluno:", { matricula, nome, disciplina });

    try {
        let novaDisciplina = await Disciplina.findOne({ nome: disciplina });
        if (!novaDisciplina) {
            novaDisciplina = new Disciplina({ nome: disciplina });
            await novaDisciplina.save();
        }

        const novoAluno = new Aluno({
            matricula: matricula,
            nome: nome,
            disciplina: novaDisciplina._id
        });
        await novoAluno.save();

        const novaMatricula = new Matricula({
            aluno: novoAluno._id,
            disciplina: novaDisciplina._id
        });
        await novaMatricula.save();

        req.session.message = { tipo: 'success', texto: 'Aluno cadastrado com sucesso!' };
        res.redirect('/');
    } catch (error) {
        console.error("Erro ao cadastrar aluno:", error);
        let mensagemTexto = 'Erro ao cadastrar aluno. Tente novamente.';

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            mensagemTexto = `Erro de validação: ${messages.join(', ')}`;
        } else if (error.code === 11000) {
            if (error.keyPattern && (error.keyPattern.matricula || error.keyPattern.numeroMatricula || error.keyPattern.idExterno)) {
                 mensagemTexto = `Matrícula '${matricula}' já cadastrada. Por favor, use outra.`;
            } else {
                 mensagemTexto = 'Dado duplicado. Por favor, verifique as informações.';
            }
        }
        
        req.session.message = { tipo: 'danger', texto: mensagemTexto };
        res.redirect('/');
    }
});

app.get('/tabela', requireLogin, async (req, res) => {
    const searchTerm = req.query.nome;
    let alunos;
    let queryPerformed = false;

    try {
        if (searchTerm) {
            alunos = await Aluno.find({ nome: new RegExp(searchTerm, 'i') }).populate('disciplina');
            queryPerformed = true;
        } else {
            alunos = await Aluno.find().populate('disciplina');
            queryPerformed = true;
        }
        res.render('aluno', { alunos, queryPerformed, searchTerm: searchTerm || '' });
    } catch (error) {
        console.error("Erro ao buscar alunos para a tabela:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar a tabela de alunos.' };
        res.status(500).redirect('/tabela');
    }
});

app.get('/alunos/:id', requireLogin, async (req, res) => {
    try {
        const aluno = await Aluno.findById(req.params.id).populate('disciplina');
        if (!aluno) {
            req.session.message = { tipo: 'danger', texto: 'Aluno não encontrado.' };
            return res.status(404).redirect('/tabela');
        }
        res.render('detalharAluno', { aluno });
    } catch (error) {
        console.error("Erro ao detalhar aluno:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar detalhes do aluno.' };
        res.status(500).redirect('/tabela');
    }
});

app.get('/alunos/editar/:id', requireLogin, async (req, res) => {
    try {
        const aluno = await Aluno.findById(req.params.id).populate('disciplina');
        if (!aluno) {
            req.session.message = { tipo: 'danger', texto: 'Aluno não encontrado para edição.' };
            return res.status(404).redirect('/tabela');
        }
        res.render('editarAluno', { aluno });
    } catch (error) {
        console.error("Erro ao carregar formulário de edição:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar dados do aluno para edição.' };
        res.status(500).redirect('/tabela');
    }
});

app.post('/alunos/editar/:id', requireLogin, async (req, res) => {
    const { matricula, nome, disciplina } = req.body;
    const alunoId = req.params.id;

    try {
        let novaDisciplina = await Disciplina.findOne({ nome: disciplina });
        if (!novaDisciplina) {
            novaDisciplina = new Disciplina({ nome: disciplina });
            await novaDisciplina.save();
        }

        const aluno = await Aluno.findById(alunoId);
        if (!aluno) {
            req.session.message = { tipo: 'danger', texto: 'Aluno não encontrado.' };
            return res.status(404).redirect('/tabela');
        }

        if (aluno.matricula !== matricula) {
            const matriculaExistente = await Aluno.findOne({ matricula: matricula, _id: { $ne: alunoId } });
            if (matriculaExistente) {
                req.session.message = { tipo: 'danger', texto: `A matrícula '${matricula}' já está em uso por outro aluno.` };
                return res.redirect(`/alunos/editar/${alunoId}`);
            }
        }

        await Aluno.findByIdAndUpdate(alunoId, {
            matricula: matricula,
            nome: nome,
            disciplina: novaDisciplina._id
        });

        req.session.message = { tipo: 'success', texto: 'Aluno atualizado com sucesso!' };
        res.redirect('/tabela');
    } catch (error) {
        console.error("Erro ao editar aluno:", error);
        let mensagemTexto = 'Erro ao editar aluno. Tente novamente.';

        if (error.code === 11000) {
            if (error.keyPattern && (error.keyPattern.matricula || error.keyPattern.numeroMatricula || error.keyPattern.idExterno)) {
                mensagemTexto = `Matrícula '${req.body.matricula}' já cadastrada. Por favor, use outra.`;
            } else {
                mensagemTexto = 'Dado duplicado. Por favor, verifique as informações.';
            }
        } else if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            mensagemTexto = `Erro de validação: ${messages.join(', ')}`;
        }
        req.session.message = { tipo: 'danger', texto: mensagemTexto };
        res.status(500).redirect(`/alunos/editar/${alunoId}`);
    }
});

app.get('/alunos/excluir/:id', requireLogin, async (req, res) => {
    try {
        await Aluno.findByIdAndDelete(req.params.id);
        req.session.message = { tipo: 'success', texto: 'Aluno excluído com sucesso!' };
        res.redirect('/tabela');
    } catch (error) {
        console.error("Erro ao excluir aluno:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao excluir aluno. Tente novamente.' };
        res.status(500).redirect('/tabela');
    }
});



app.get('/usuarios', requireLogin, async (req, res) => {
    try {
        const usuarios = await Usuario.find({ _id: { $ne: req.session.userId } }).select('nome email');
        res.render('usuarios', { usuarios });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar lista de usuários.' };
        res.status(500).redirect('/');
    }
});

app.get('/usuarios/editar/:id', requireLogin, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            req.session.message = { tipo: 'danger', texto: 'Usuário não encontrado para edição.' };
            return res.status(404).redirect('/usuarios');
        }
        res.render('editarUsuario', { usuario: { _id: usuario._id, nome: usuario.nome || '', email: usuario.email } });
    } catch (error) {
        console.error("Erro ao carregar formulário de edição de usuário:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar dados do usuário para edição.' };
        res.status(500).redirect('/usuarios');
    }
});

app.post('/usuarios/editar/:id', requireLogin, async (req, res) => {
    const { nome, email, senha, confirmarSenha } = req.body;
    const userId = req.params.id;

    try {
        const usuario = await Usuario.findById(userId);
        if (!usuario) {
            req.session.message = { tipo: 'danger', texto: 'Usuário não encontrado.' };
            return res.status(404).redirect('/usuarios');
        }

        usuario.nome = nome;
        usuario.email = email;

        if (senha) {
            if (senha !== confirmarSenha) {
                req.session.message = { tipo: 'danger', texto: 'As novas senhas não coincidem.' };
                return res.redirect(`/usuarios/editar/${userId}`);
            }
            usuario.senha = senha;
        }

        await usuario.save();

        req.session.message = { tipo: 'success', texto: 'Usuário atualizado com sucesso!' };
        res.redirect('/usuarios');
    } catch (error) {
        console.error("Erro ao editar usuário:", error);
        let mensagemTexto = 'Erro ao editar usuário. Tente novamente.';
        if (error.code === 11000) {
            mensagemTexto = 'Este e-mail já está em uso por outro usuário.';
        } else if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            mensagemTexto = `Erro de validação: ${messages.join(', ')}`;
        }
        req.session.message = { tipo: 'danger', texto: mensagemTexto };
        res.redirect(`/usuarios/editar/${userId}`);
    }
});

app.get('/usuarios/excluir/:id', requireLogin, async (req, res) => {
    const userIdToDelete = req.params.id;
    try {
        if (req.session.userId.toString() === userIdToDelete.toString()) {
            req.session.message = { tipo: 'danger', texto: 'Você não pode excluir sua própria conta por aqui.' };
            return res.redirect('/usuarios');
        }

        const usuarioExcluido = await Usuario.findByIdAndDelete(userIdToDelete);
        if (!usuarioExcluido) {
            req.session.message = { tipo: 'danger', texto: 'Usuário não encontrado para exclusão.' };
            return res.status(404).redirect('/usuarios');
        }

        req.session.message = { tipo: 'success', texto: 'Usuário excluído com sucesso!' };
        res.redirect('/usuarios');
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao excluir usuário. Tente novamente.' };
        res.status(500).redirect('/usuarios');
    }
});



app.get('/minha-conta/detalhes', requireLogin, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.userId).select('-senha');
        if (!usuario) {
            req.session.message = { tipo: 'danger', texto: 'Sua conta não foi encontrada.' };
            return res.redirect('/logout');
        }
        res.render('detalhesMinhaConta', { usuario });
    } catch (error) {
        console.error("Erro ao carregar detalhes da conta:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar detalhes da sua conta.' };
        res.status(500).redirect('/');
    }
});

app.get('/minha-conta/editar', requireLogin, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.userId);
        if (!usuario) {
            req.session.message = { tipo: 'danger', texto: 'Sua conta não foi encontrada para edição.' };
            return res.redirect('/logout');
        }
        res.render('editarMinhaConta', { usuario: { _id: usuario._id, nome: usuario.nome || '', email: usuario.email } });
    } catch (error) {
        console.error("Erro ao carregar formulário de edição de conta:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar formulário da sua conta.' };
        res.status(500).redirect('/');
    }
});

app.post('/minha-conta/editar', requireLogin, async (req, res) => {
    const { nome, email, senha, confirmarSenha } = req.body;
    const userId = req.session.userId;

    try {
        const usuario = await Usuario.findById(userId);
        if (!usuario) {
            req.session.message = { tipo: 'danger', texto: 'Sua conta não foi encontrada.' };
            return res.redirect('/logout');
        }

        usuario.nome = nome;
        usuario.email = email;

        if (senha) {
            if (senha !== confirmarSenha) {
                req.session.message = { tipo: 'danger', texto: 'As novas senhas não coincidem.' };
                return res.redirect('/minha-conta/editar');
            }
            usuario.senha = senha;
        }

        await usuario.save();

        req.session.message = { tipo: 'success', texto: 'Sua conta foi atualizada com sucesso!' };
        res.redirect('/minha-conta/detalhes');
    } catch (error) {
        console.error("Erro ao editar sua conta:", error);
        let mensagemTexto = 'Erro ao editar sua conta. Tente novamente.';
        if (error.code === 11000) {
            mensagemTexto = 'Este e-mail já está em uso por outra conta.';
        } else if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            mensagemTexto = `Erro de validação: ${messages.join(', ')}`;
        }
        req.session.message = { tipo: 'danger', texto: mensagemTexto };
        res.redirect('/minha-conta/editar');
    }
});


app.use((req, res) => {
    res.status(404).send("Página não encontrada :-/");
});


app.listen(process.env.PORT, () => {
    console.log(`Servidor rodando na porta ${port}...`);
});