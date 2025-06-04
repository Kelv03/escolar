const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const requireLogin = require('../middleware/requireLogin'); 


router.get('/cadastro', usuarioController.redirectIfLoggedIn, usuarioController.exibirCadastro);
router.post('/cadastro', usuarioController.cadastrarUsuario);
router.get('/login', usuarioController.redirectIfLoggedIn, usuarioController.exibirLogin);
router.post('/login', usuarioController.logarUsuario);
router.get('/logout', usuarioController.logoutUsuario);


router.get('/usuarios', requireLogin, usuarioController.listarUsuarios); 
router.get('/usuarios/editar/:id', requireLogin, usuarioController.exibirFormularioEdicaoUsuario); 
router.post('/usuarios/editar/:id', requireLogin, usuarioController.editarUsuario); 
router.get('/usuarios/excluir/:id', requireLogin, usuarioController.excluirUsuario);


router.get('/minha-conta/detalhes', requireLogin, usuarioController.detalhesMinhaConta); 
router.get('/minha-conta/editar', requireLogin, usuarioController.exibirFormularioEdicaoMinhaConta); 
router.post('/minha-conta/editar', requireLogin, usuarioController.editarMinhaConta);

module.exports = router;