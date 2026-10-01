require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const aplicacao = express();
aplicacao.use(cors());
aplicacao.use(express.json());
aplicacao.use(express.static('.')); // Serve os arquivos estáticos da página

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.URI_BANCO)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch((erro) => console.error('❌ Erro de conexão com MongoDB:', erro));

// MODELOS
const Opcao = mongoose.model('Opcao', new mongoose.Schema({
  nome: { type: String, required: true },
  emoji: { type: String, default: '🍽️' },
  votos: { type: Number, default: 0 }
}));

const Votante = mongoose.model('Votante', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  escolhas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Opcao' }],
  horario: { type: String }
}));

// ROTAS DA API
aplicacao.get('/api/dados', async (requisicao, resposta) => {
  try {
    const opcoes = await Opcao.find();
    const votantes = await Votante.find().populate('escolhas');
    resposta.json({ opcoes, votantes });
  } catch (erro) {
    resposta.status(500).json({ erro: 'Erro ao buscar dados do banco' });
  }
});

aplicacao.post('/api/votar', async (requisicao, resposta) => {
  const { email, escolhasIds } = requisicao.body;

  try {
    const votanteExistente = await Votante.findOne({ email });

    if (votanteExistente) {
      await Opcao.updateMany(
        { _id: { $in: votanteExistente.escolhas } },
        { $inc: { votos: -1 } }
      );
    }

    await Opcao.updateMany(
      { _id: { $in: escolhasIds } },
      { $inc: { votos: 1 } }
    );

    const horarioAtual = new Date().toLocaleString('pt-BR');

    await Votante.findOneAndUpdate(
      { email },
      { escolhas: escolhasIds, horario: horarioAtual },
      { upsert: true, new: true }
    );

    resposta.json({ mensagem: 'Voto registrado com sucesso!' });
  } catch (erro) {
    resposta.status(500).json({ erro: 'Erro ao registrar voto' });
  }
});

aplicacao.post('/api/opcoes', async (requisicao, resposta) => {
  try {
    const { nome, emoji } = requisicao.body;
    const novaOpcao = new Opcao({ nome, emoji, votos: 0 });
    await novaOpcao.save();
    resposta.status(201).json(novaOpcao);
  } catch (erro) {
    resposta.status(500).json({ erro: 'Erro ao adicionar opção' });
  }
});

aplicacao.delete('/api/opcoes/:id', async (requisicao, resposta) => {
  try {
    const { id } = requisicao.params;
    await Opcao.findByIdAndDelete(id);
    await Votante.updateMany({}, { $pull: { escolhas: id } });
    resposta.json({ mensagem: 'Opção removida!' });
  } catch (erro) {
    resposta.status(500).json({ erro: 'Erro ao remover opção' });
  }
});

aplicacao.post('/api/zerar', async (requisicao, resposta) => {
  try {
    await Opcao.updateMany({}, { votos: 0 });
    await Votante.deleteMany({});
    resposta.json({ mensagem: 'Votos zerados com sucesso!' });
  } catch (erro) {
    resposta.status(500).json({ erro: 'Erro ao zerar votos' });
  }
});

const PORTA = process.env.PORTA || 3000;
aplicacao.listen(PORTA, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORTA}`);
});