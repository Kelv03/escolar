const mongoose = require('mongoose');

const matriculaSchema = new mongoose.Schema({
    aluno: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno' },
    disciplina: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina' },
    status: {
        type: String,
        enum: ['Pendente', 'Concluída', 'Cancelada'],
        default: 'Pendente'
    }
});

module.exports = mongoose.model('Matricula', matriculaSchema);