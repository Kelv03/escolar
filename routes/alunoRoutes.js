const express = require('express');
const router = express.Router();
const alunoController = require('../controllers/alunoController'); // Mantenha assim, sem .js
const requireLogin = require('../middleware/requireLogin'); // Middleware de autenticação

// Rota principal que lista alunos para o formulário de cadastro (GET /)
router.get('/', requireLogin, alunoController.listarAlunos);

// Rota para cadastrar um novo aluno (POST /alunos)
router.post('/alunos', requireLogin, alunoController.cadastrarAluno);

// Rota para listar alunos na tabela (GET /tabela)
router.get('/tabela', requireLogin, alunoController.listarAlunosTabela);

// Rota para detalhar um aluno específico (GET /alunos/:id)
router.get('/alunos/:id', requireLogin, alunoController.detalharAluno);

// Rota para exibir o formulário de edição de aluno (GET /alunos/editar/:id)
router.get('/alunos/editar/:id', requireLogin, alunoController.exibirFormularioEdicaoAluno);

// Rota para processar a edição de um aluno (POST /alunos/editar/:id)
router.post('/alunos/editar/:id', requireLogin, alunoController.editarAluno);

// Rota para excluir um aluno (GET /alunos/excluir/:id)
router.get('/alunos/excluir/:id', requireLogin, alunoController.excluirAluno);

module.exports = router;