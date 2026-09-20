/* Camada de persistência — tudo salvo em localStorage, sem backend. */

const STORAGE_KEY = "fincrm.data.v1";

const DEFAULT_DATA = {
  transactions: [], // { id, tipo: 'entrada'|'saida', descricao, valor, data: 'YYYY-MM-DD', categoria, isSalario: bool }
  categories: {
    entrada: ["Salário", "Freelance", "Investimentos", "Outros"],
    saida: ["Moradia", "Alimentação", "Transporte", "Contas", "Saúde", "Lazer", "Outros"],
  },
};

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
    const record = { id: uid(), ...tx };
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
    };
    this.persist();
  },

  resetAll() {
    this.data = structuredClone(DEFAULT_DATA);
    this.persist();
  },
};
