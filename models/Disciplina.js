const mongoose = require('mongoose');

const disciplinaSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: true,
        unique: true
    }
});

module.exports = mongoose.model('Disciplina', disciplinaSchema);