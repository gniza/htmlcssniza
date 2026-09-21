/* Camada de persistência — tudo salvo em localStorage, sem backend. */

const STORAGE_KEY = "fincrm.data.v1";

const DEFAULT_POCKETS = [
  { id: "porquinho", nome: "Porquinho", tipo: "porquinho", taxaAnual: 10.65, fixed: true, saldoInicialTxId: null },
  { id: "especie", nome: "Dinheiro em espécie", tipo: "especie", taxaAnual: null, fixed: true, saldoInicialTxId: null },
];

const DEFAULT_DATA = {
  // transaction: { id, tipo: 'entrada'|'saida', descricao, valor, data: 'YYYY-MM-DD', categoria,
  //   contaId: 'corrente'|'porquinho'|'especie'|<metaId>, isSalario, isTransferencia, isSaldoInicial }
  transactions: [],
  categories: {
    entrada: ["Salário", "Freelance", "Investimentos", "Outros"],
    saida: ["Moradia", "Alimentação", "Transporte", "Contas", "Saúde", "Lazer", "Outros"],
  },
  pockets: DEFAULT_POCKETS,
};

function normalizePockets(pockets) {
  const list = Array.isArray(pockets) ? pockets : [];
  const withFixed = [...list];
  DEFAULT_POCKETS.forEach((fixedPocket) => {
    if (!withFixed.some((p) => p.id === fixedPocket.id)) {
      withFixed.unshift({ ...fixedPocket });
    }
  });
  return withFixed;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      categories: {
        entrada: parsed.categories?.entrada?.length ? parsed.categories.entrada : DEFAULT_DATA.categories.entrada,
        saida: parsed.categories?.saida?.length ? parsed.categories.saida : DEFAULT_DATA.categories.saida,
      },
      pockets: normalizePockets(parsed.pockets),
    };
  } catch (err) {
    console.error("Falha ao carregar dados, usando padrão.", err);
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const Store = {
  data: loadData(),

  persist() {
    saveData(this.data);
  },

  addTransaction(tx) {
    const record = { id: uid(), contaId: "corrente", ...tx };
    this.data.transactions.push(record);
    this.persist();
    return record;
  },

  updateTransaction(id, updates) {
    const idx = this.data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.data.transactions[idx] = { ...this.data.transactions[idx], ...updates };
    this.persist();
    return this.data.transactions[idx];
  },

  deleteTransaction(id) {
    this.data.transactions = this.data.transactions.filter((t) => t.id !== id);
    this.persist();
  },

  getTransactions() {
    return [...this.data.transactions].sort((a, b) => (a.data < b.data ? 1 : -1));
  },

  addCategory(tipo, nome) {
    nome = nome.trim();
    if (!nome) return false;
    const list = this.data.categories[tipo];
    if (list.some((c) => c.toLowerCase() === nome.toLowerCase())) return false;
    list.push(nome);
    this.persist();
    return true;
  },

  removeCategory(tipo, nome) {
    this.data.categories[tipo] = this.data.categories[tipo].filter((c) => c !== nome);
    this.persist();
  },

  getCategories(tipo) {
    return [...this.data.categories[tipo]];
  },

  /* ---------- COFRES (contas internas: porquinho, metas, espécie) ---------- */

  getPockets() {
    return [...this.data.pockets];
  },

  getPocket(id) {
    return this.data.pockets.find((p) => p.id === id) || null;
  },

  addPocket(pocket) {
    const record = { id: uid(), tipo: "meta", taxaAnual: 0, saldoInicialTxId: null, fixed: false, ...pocket };
    this.data.pockets.push(record);
    this.persist();
    return record;
  },

  updatePocket(id, updates) {
    const idx = this.data.pockets.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.pockets[idx] = { ...this.data.pockets[idx], ...updates };
    this.persist();
    return this.data.pockets[idx];
  },

  deletePocket(id) {
    const pocket = this.getPocket(id);
    if (!pocket || pocket.fixed) return false;
    this.data.pockets = this.data.pockets.filter((p) => p.id !== id);
    this.persist();
    return true;
  },

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.transactions)) {
      throw new Error("Arquivo de backup inválido.");
    }
    this.data = {
      transactions: parsed.transactions,
      categories: {
        entrada: parsed.categories?.entrada?.length ? parsed.categories.entrada : DEFAULT_DATA.categories.entrada,
        saida: parsed.categories?.saida?.length ? parsed.categories.saida : DEFAULT_DATA.categories.saida,
      },
      pockets: normalizePockets(parsed.pockets),
    };
    this.persist();
  },

  resetAll() {
    this.data = structuredClone(DEFAULT_DATA);
    this.persist();
  },
};
