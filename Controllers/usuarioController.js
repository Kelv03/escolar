const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

// Middleware para não permitir que usuários logados acessem login/cadastro
exports.redirectIfLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        req.session.message = { tipo: 'info', texto: 'Você já está logado!' };
        return res.redirect('/');
    }
    next();
};

// Exibir formulário de cadastro
exports.exibirCadastro = (req, res) => {
    res.render('cadastro', { mensagem: null });
};

// Processar cadastro de novo usuário
exports.cadastrarUsuario = async (req, res) => {
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
};

// Exibir formulário de login
exports.exibirLogin = (req, res) => {
    res.render('login', { mensagem: null });
};

// Processar login do usuário
exports.logarUsuario = async (req, res) => {
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
};

// Logout do usuário
exports.logoutUsuario = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            return res.status(500).send("Erro ao fazer logout.");
        }
        res.redirect('/login');
    });
};

// Listar todos os usuários (gerenciamento)
exports.listarUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find({ _id: { $ne: req.session.userId } }).select('nome email');
        res.render('usuarios', { usuarios });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar lista de usuários.' };
        res.status(500).redirect('/');
    }
};

// Exibir formulário de edição de usuário (gerenciamento)
exports.exibirFormularioEdicaoUsuario = async (req, res) => {
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
};

// Processar edição de usuário (gerenciamento)
exports.editarUsuario = async (req, res) => {
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
};

// Excluir usuário (gerenciamento)
exports.excluirUsuario = async (req, res) => {
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
};

// Detalhes da própria conta (Minha Conta)
exports.detalhesMinhaConta = async (req, res) => {
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
};

// Exibir formulário de edição da própria conta (Minha Conta)
exports.exibirFormularioEdicaoMinhaConta = async (req, res) => {
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
};

// Processar edição da própria conta (Minha Conta)
exports.editarMinhaConta = async (req, res) => {
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
};