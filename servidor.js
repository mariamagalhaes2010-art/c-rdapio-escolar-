require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const aplicacao = express();
aplicacao.use(cors());
aplicacao.use(express.json());
aplicacao.use(express.static('.'));

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.URI_BANCO)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch((erro) => console.error('❌ Erro de conexão com MongoDB:', erro));

// MODELOS DO BANCO
const Opcao = mongoose.model('Opcao', new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  categoria: { type: String, required: true },
  votos: { type: Number, default: 0 }
}));

const Votante = mongoose.model('Votante', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  escolhas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Opcao' }],
  restricao: { type: String, default: '' },
  opiniao: { type: String, default: '' },
  horario: { type: String }
}));

const CardapioSemanal = mongoose.model('CardapioSemanal', new mongoose.Schema({
  dia: { type: String, required: true, unique: true },
  refeicao: { type: String, default: '' }
}));

// ROTAS DA API

// Buscar todos os dados
aplicacao.get('/api/dados', async (req, res) => {
  try {
    const opcoes = await Opcao.find();
    const votantes = await Votante.find().populate('escolhas');
    const cardapioSemanal = await CardapioSemanal.find();
    res.json({ opcoes, votantes, cardapioSemanal });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar dados do banco' });
  }
});

// Votar, registrar restrições alimentares e opinião
aplicacao.post('/api/votar', async (req, res) => {
  const { email, escolhasIds, restricao, opiniao } = req.body;

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
      { 
        escolhas: escolhasIds, 
        restricao: restricao || '', 
        opiniao: opiniao || '', 
        horario: horarioAtual 
      },
      { upsert: true, new: true }
    );

    res.json({ mensagem: 'Voto e informações registrados com sucesso!' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao registrar voto' });
  }
});

// Adicionar nova opção no Admin
aplicacao.post('/api/opcoes', async (req, res) => {
  try {
    const { nome, descricao, categoria } = req.body;
    const novaOpcao = new Opcao({ 
      nome, 
      descricao: descricao || '', 
      categoria: categoria || 'Prato Principal', 
      votos: 0 
    });
    await novaOpcao.save();
    res.status(201).json(novaOpcao);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao adicionar opção' });
  }
});

// Remover opção
aplicacao.delete('/api/opcoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Opcao.findByIdAndDelete(id);
    await Votante.updateMany({}, { $pull: { escolhas: id } });
    res.json({ mensagem: 'Item removido do cardápio!' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao remover item' });
  }
});

// Atualizar Cardápio Semanal
aplicacao.post('/api/semanal', async (req, res) => {
  try {
    const { dias } = req.body; // Array com { dia, refeicao }
    if (Array.isArray(dias)) {
      for (const item of dias) {
        await CardapioSemanal.findOneAndUpdate(
          { dia: item.dia },
          { refeicao: item.refeicao },
          { upsert: true, new: true }
        );
      }
    }
    res.json({ mensagem: 'Cardápio semanal salvo com sucesso!' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao salvar cardápio semanal' });
  }
});

// Zerar votação do dia
aplicacao.post('/api/zerar', async (req, res) => {
  try {
    await Opcao.updateMany({}, { votos: 0 });
    await Votante.deleteMany({});
    res.json({ mensagem: 'Votação do dia zerada!' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao zerar votação' });
  }
});

const PORTA = process.env.PORTA || 3000;
aplicacao.listen(PORTA, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORTA}`);
});