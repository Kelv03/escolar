const Aluno = require('../models/Aluno');
const Disciplina = require('../models/Disciplina');
const Matricula = require('../models/Matricula');

// Função para listar alunos (rota GET /)
exports.listarAlunos = async (req, res) => {
    try {
        const alunos = await Aluno.find().populate('disciplina');
        res.render('index', { alunos });
    } catch (error) {
        console.error("Erro ao carregar página inicial com alunos:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao carregar dados dos alunos.' };
        res.status(500).redirect('/');
    }
};

// Função para cadastrar aluno (rota POST /alunos)
exports.cadastrarAluno = async (req, res) => {
    const { matricula, nome, disciplina } = req.body;

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
            disciplina: novaDisciplina._id,
            status: "Pendente"
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
};

// Função para listar alunos na tabela (rota GET /tabela)
exports.listarAlunosTabela = async (req, res) => {
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
};

// Função para detalhar um aluno (rota GET /alunos/:id)
exports.detalharAluno = async (req, res) => {
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
};

// Função para exibir formulário de edição de aluno (rota GET /alunos/editar/:id)
exports.exibirFormularioEdicaoAluno = async (req, res) => {
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
};

// Função para processar edição de aluno (rota POST /alunos/editar/:id)
exports.editarAluno = async (req, res) => {
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
};

// Função para excluir aluno (rota GET /alunos/excluir/:id)
exports.excluirAluno = async (req, res) => {
    try {
        await Aluno.findByIdAndDelete(req.params.id);
        req.session.message = { tipo: 'success', texto: 'Aluno excluído com sucesso!' };
        res.redirect('/tabela');
    } catch (error) {
        console.error("Erro ao excluir aluno:", error);
        req.session.message = { tipo: 'danger', texto: 'Erro ao excluir aluno. Tente novamente.' };
        res.status(500).redirect('/tabela');
    }
};