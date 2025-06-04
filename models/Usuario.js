const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    nome: { type: String, required: false } 
});

usuarioSchema.pre('save', async function (next) {
    if (this.isModified('senha')) {
        this.senha = await bcrypt.hash(this.senha, 10);
    }
    next();
});

module.exports = mongoose.model('Usuario', usuarioSchema);