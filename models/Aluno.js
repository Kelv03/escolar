const mongoose = require('mongoose');

const alunoSchema = new mongoose.Schema({
    matricula: {
        type: String,
        required: true,
        unique: true
    },
    nome: {
        type: String,
        required: true
    },
    disciplina: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Disciplina',
        required: true
    }
});

module.exports = mongoose.model('Aluno', alunoSchema);