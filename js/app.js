/* Lógica de UI: navegação, formulários, filtros e renderização das views. */

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const state = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  filters: { search: "", type: "", category: "", month: "" },
};

function formatCurrency(val) {
  return (Number(val) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------- NAVIGATION ---------- */

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  renderAll();
}

/* ---------- MODALS ---------- */

function initModals() {
  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.openModal;
      if (type === "transacao") openTransacaoModal();
      if (type === "salario") openSalarioModal();
    });
  });
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModals());
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModals();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });
}

function closeModals() {
  document.querySelectorAll(".modal-overlay").forEach((m) => (m.hidden = true));
}

function populateCategorySelect(select, tipo) {
  select.innerHTML = Store.getCategories(tipo).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function openTransacaoModal(tx = null) {
  const form = document.getElementById("formTransacao");
  form.reset();
  document.getElementById("txId").value = tx?.id || "";
  document.getElementById("modalTransacaoTitle").textContent = tx ? "Editar transação" : "Nova transação";
  const tipo = tx?.tipo || "entrada";
  form.querySelector(`input[name="tipo"][value="${tipo}"]`).checked = true;
  populateCategorySelect(document.getElementById("txCategoria"), tipo);

  document.getElementById("txDescricao").value = tx?.descricao || "";
  document.getElementById("txValor").value = tx?.valor ?? "";
  document.getElementById("txData").value = tx?.data || todayISO();
  if (tx?.categoria) document.getElementById("txCategoria").value = tx.categoria;

  form.querySelectorAll('input[name="tipo"]').forEach((r) => {
    r.onchange = () => populateCategorySelect(document.getElementById("txCategoria"), r.value);
  });

  document.getElementById("modalTransacao").hidden = false;
}

function openSalarioModal() {
  const form = document.getElementById("formSalario");
  form.reset();
  document.getElementById("salDescricao").value = "Salário mensal";
  document.getElementById("salData").value = todayISO();
  document.getElementById("modalSalario").hidden = false;
}

function initForms() {
  document.getElementById("formTransacao").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("txId").value;
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const payload = {
      tipo,
      descricao: document.getElementById("txDescricao").value.trim(),
      valor: parseFloat(document.getElementById("txValor").value),
      data: document.getElementById("txData").value,
      categoria: document.getElementById("txCategoria").value,
      isSalario: false,
    };
    if (id) {
      Store.updateTransaction(id, payload);
      showToast("Transação atualizada.");
    } else {
      Store.addTransaction(payload);
      showToast("Transação adicionada.");
    }
    closeModals();
    renderAll();
  });

  document.getElementById("formSalario").addEventListener("submit", (e) => {
    e.preventDefault();
    Store.addTransaction({
      tipo: "entrada",
      descricao: document.getElementById("salDescricao").value.trim() || "Salário",
      valor: parseFloat(document.getElementById("salValor").value),
      data: document.getElementById("salData").value,
      categoria: "Salário",
      isSalario: true,
    });
    if (!Store.getCategories("entrada").includes("Salário")) {
      Store.addCategory("entrada", "Salário");
    }
    showToast("Salário registrado.");
    closeModals();
    renderAll();
  });

  document.querySelectorAll("[data-cat-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const tipo = form.dataset.catForm;
      const input = form.querySelector("input");
      if (Store.addCategory(tipo, input.value)) {
        input.value = "";
        renderCategorias();
        renderFilters();
      } else {
        showToast("Categoria inválida ou já existe.");
      }
    });
  });
}

/* ---------- DASHBOARD ---------- */

function initMonthPicker() {
  document.getElementById("prevMonth").addEventListener("click", () => {
    state.currentMonth--;
    if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    renderDashboard();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    state.currentMonth++;
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    renderDashboard();
  });
}

function renderDashboard() {
  document.getElementById("currentMonthLabel").textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;
  const key = monthKey(state.currentYear, state.currentMonth);
  const all = Store.getTransactions();
  const monthTx = all.filter((t) => t.data.startsWith(key));

  const income = monthTx.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const expense = monthTx.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
  const totalAll = all.reduce((s, t) => s + (t.tipo === "entrada" ? t.valor : -t.valor), 0);

  document.getElementById("cardIncome").textContent = formatCurrency(income);
  document.getElementById("cardExpense").textContent = formatCurrency(expense);
  document.getElementById("cardBalance").textContent = formatCurrency(income - expense);
  document.getElementById("cardTotal").textContent = formatCurrency(totalAll);

  // bar chart: últimos 6 meses
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  for (let i = 5; i >= 0; i--) {
    let m = state.currentMonth - i;
    let y = state.currentYear;
    while (m < 0) { m += 12; y--; }
    const k = monthKey(y, m);
    const txs = all.filter((t) => t.data.startsWith(k));
    labels.push(MONTH_NAMES[m].slice(0, 3));
    incomeData.push(txs.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0));
    expenseData.push(txs.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0));
  }
  drawBarChart(document.getElementById("chartBars"), labels, incomeData, expenseData);

  // donut: saídas por categoria no mês
  const byCategory = {};
  monthTx.filter((t) => t.tipo === "saida").forEach((t) => {
    byCategory[t.categoria] = (byCategory[t.categoria] || 0) + t.valor;
  });
  const entries = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, value]) => ({ categoria, value }));
  drawDonutChart(document.getElementById("chartDonut"), entries.map((e) => ({ value: e.value })));

  const legend = document.getElementById("donutLegend");
  legend.innerHTML = entries
    .map((e, i) => `<li><span class="dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>${escapeHtml(e.categoria)} — ${formatCurrency(e.value)}</li>`)
    .join("") || `<li>Sem saídas neste mês.</li>`;

  // recent transactions
  const recentList = document.getElementById("recentList");
  const recent = all.slice(0, 6);
  recentList.innerHTML = recent.length
    ? recent.map(renderTxRow).join("")
    : `<p class="empty-state">Nenhuma transação ainda. Clique em "Nova transação" para começar.</p>`;
  bindTxRowActions(recentList);
}

function renderTxRow(t) {
  const icon = t.tipo === "entrada" ? "↑" : "↓";
  return `
    <div class="tx-row" data-id="${t.id}">
      <div class="tx-row-left">
        <div class="tx-badge ${t.tipo}">${icon}</div>
        <div>
          <div class="tx-desc">${escapeHtml(t.descricao)}</div>
          <div class="tx-meta">${formatDate(t.data)} · ${escapeHtml(t.categoria)}</div>
        </div>
      </div>
      <div class="tx-value ${t.tipo}">${t.tipo === "entrada" ? "+" : "-"} ${formatCurrency(t.valor)}</div>
    </div>`;
}

function bindTxRowActions() {}

/* ---------- TRANSAÇÕES ---------- */

function renderFilters() {
  const catSelect = document.getElementById("filterCategory");
  const current = catSelect.value;
  const allCats = [...new Set([...Store.getCategories("entrada"), ...Store.getCategories("saida")])];
  catSelect.innerHTML = `<option value="">Todas as categorias</option>` + allCats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  catSelect.value = current;
}

function initFilters() {
  document.getElementById("filterSearch").addEventListener("input", (e) => { state.filters.search = e.target.value.toLowerCase(); renderTransacoes(); });
  document.getElementById("filterType").addEventListener("change", (e) => { state.filters.type = e.target.value; renderTransacoes(); });
  document.getElementById("filterCategory").addEventListener("change", (e) => { state.filters.category = e.target.value; renderTransacoes(); });
  document.getElementById("filterMonth").addEventListener("change", (e) => { state.filters.month = e.target.value; renderTransacoes(); });
  document.getElementById("clearFilters").addEventListener("click", () => {
    state.filters = { search: "", type: "", category: "", month: "" };
    document.getElementById("filterSearch").value = "";
    document.getElementById("filterType").value = "";
    document.getElementById("filterCategory").value = "";
    document.getElementById("filterMonth").value = "";
    renderTransacoes();
  });
}

function renderTransacoes() {
  let list = Store.getTransactions();
  const f = state.filters;
  if (f.search) list = list.filter((t) => t.descricao.toLowerCase().includes(f.search));
  if (f.type) list = list.filter((t) => t.tipo === f.type);
  if (f.category) list = list.filter((t) => t.categoria === f.category);
  if (f.month) list = list.filter((t) => t.data.startsWith(f.month));

  const tbody = document.getElementById("txTableBody");
  document.getElementById("txEmptyState").hidden = list.length !== 0;

  tbody.innerHTML = list
    .map(
      (t) => `
    <tr>
      <td data-label="Data">${formatDate(t.data)}</td>
      <td data-label="Descrição">${escapeHtml(t.descricao)}</td>
      <td data-label="Categoria">${escapeHtml(t.categoria)}</td>
      <td data-label="Tipo"><span class="type-tag ${t.tipo}">${t.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
      <td data-label="Valor" class="align-right tx-value ${t.tipo}">${t.tipo === "entrada" ? "+" : "-"} ${formatCurrency(t.valor)}</td>
      <td>
        <div class="row-actions">
          <button data-edit="${t.id}" title="Editar">✏️</button>
          <button data-delete="${t.id}" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tx = Store.data.transactions.find((t) => t.id === btn.dataset.edit);
      if (tx) openTransacaoModal(tx);
    });
  });
  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Excluir esta transação?")) {
        Store.deleteTransaction(btn.dataset.delete);
        showToast("Transação excluída.");
        renderAll();
      }
    });
  });
}

/* ---------- SALÁRIO ---------- */

function renderSalario() {
  const all = Store.getTransactions().filter((t) => t.isSalario);
  const currentYear = new Date().getFullYear();

  document.getElementById("cardLastSalary").textContent = formatCurrency(all[0]?.valor || 0);

  const last6 = all.slice(0, 6);
  const avg = last6.length ? last6.reduce((s, t) => s + t.valor, 0) / last6.length : 0;
  document.getElementById("cardAvgSalary").textContent = formatCurrency(avg);

  const yearTotal = all.filter((t) => t.data.startsWith(String(currentYear))).reduce((s, t) => s + t.valor, 0);
  document.getElementById("cardYearSalary").textContent = formatCurrency(yearTotal);

  const tbody = document.getElementById("salaryTableBody");
  document.getElementById("salaryEmptyState").hidden = all.length !== 0;
  tbody.innerHTML = all
    .map(
      (t) => `
    <tr>
      <td data-label="Data">${formatDate(t.data)}</td>
      <td data-label="Descrição">${escapeHtml(t.descricao)}</td>
      <td data-label="Valor" class="align-right tx-value entrada">+ ${formatCurrency(t.valor)}</td>
      <td>
        <div class="row-actions">
          <button data-edit="${t.id}" title="Editar">✏️</button>
          <button data-delete="${t.id}" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tx = Store.data.transactions.find((t) => t.id === btn.dataset.edit);
      if (tx) openTransacaoModal(tx);
    });
  });
  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Excluir este registro de salário?")) {
        Store.deleteTransaction(btn.dataset.delete);
        showToast("Registro excluído.");
        renderAll();
      }
    });
  });
}

/* ---------- CATEGORIAS ---------- */

function renderCategorias() {
  const renderList = (tipo, elId) => {
    const el = document.getElementById(elId);
    const inUse = new Set(Store.data.transactions.filter((t) => t.tipo === tipo).map((t) => t.categoria));
    el.innerHTML = Store.getCategories(tipo)
      .map((c) => `<li><span>${escapeHtml(c)}</span>${inUse.has(c) ? "" : `<button data-remove-cat="${tipo}|${escapeHtml(c)}">Remover</button>`}</li>`)
      .join("");
  };
  renderList("entrada", "catListEntrada");
  renderList("saida", "catListSaida");

  document.querySelectorAll("[data-remove-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [tipo, nome] = btn.dataset.removeCat.split("|");
      Store.removeCategory(tipo, nome);
      renderCategorias();
      renderFilters();
    });
  });
}

/* ---------- DADOS (backup) ---------- */

function initDados() {
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fincrm-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJSON(reader.result);
        showToast("Backup importado com sucesso.");
        renderAll();
      } catch (err) {
        showToast("Erro ao importar: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Isso vai apagar TODOS os seus dados financeiros salvos neste navegador. Continuar?")) {
      Store.resetAll();
      showToast("Todos os dados foram apagados.");
      renderAll();
    }
  });
}

/* ---------- HELPERS ---------- */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderAll() {
  renderFilters();
  renderDashboard();
  renderTransacoes();
  renderSalario();
  renderCategorias();
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initModals();
  initForms();
  initMonthPicker();
  initFilters();
  initDados();
  renderAll();

  // redesenha os gráficos ao rotacionar o aparelho / redimensionar a janela
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (document.getElementById("view-dashboard").classList.contains("active")) {
        renderDashboard();
      }
    }, 150);
  });
});
