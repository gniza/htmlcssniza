/* Importação de extrato bancário (Banco Inter: CSV e OFX), com revisão antes de confirmar.
 *
 * Formato real do CSV exportado pelo Inter (Conta digital → Extrato → Exportar):
 *   Extrato Conta Corrente
 *   Conta ;12345678
 *   Período ;01/01/2026 a 31/01/2026
 *   Saldo ;1.234,56
 *
 *   Data Lançamento;Histórico;Descrição;Valor;Saldo
 *   01/01/2026;PIX ENVIADO;Fulano de Tal;-150,00;1.084,56
 *
 * O preâmbulo (conta/período/saldo) não tem o mesmo número de colunas da
 * tabela, então o parser localiza a linha de cabeçalho pelo texto em vez de
 * assumir uma posição fixa.
 */

let extratoRows = [];

const CATEGORIA_KEYWORDS = {
  saida: [
    { categoria: "Alimentação", regex: /(ifood|restaurante|lanchonete|padaria|supermercado|mercado|a[çc]ougue|hortifruti)/i },
    { categoria: "Transporte", regex: /(uber|99app|combust[íi]vel|posto|estacionamento|ped[áa]gio)/i },
    { categoria: "Moradia", regex: /(aluguel|condom[íi]nio|imobili[áa]ria)/i },
    { categoria: "Contas", regex: /(energia|^luz|\bluz\b|\b[áa]gua\b|internet|telefone|celular|boleto)/i },
    { categoria: "Saúde", regex: /(farm[áa]cia|drogaria|hospital|cl[íi]nica|plano de sa[úu]de)/i },
    { categoria: "Lazer", regex: /(netflix|spotify|cinema|ingresso|steam|playstation|prime video)/i },
  ],
  entrada: [
    { categoria: "Salário", regex: /(sal[áa]rio|folha de pagamento)/i },
    { categoria: "Investimentos", regex: /(rendimento|dividendo|resgate)/i },
  ],
};

function guessCategoria(row) {
  const list = CATEGORIA_KEYWORDS[row.tipo] || [];
  for (const { categoria, regex } of list) {
    if (regex.test(row.descricao)) return { categoria, isSalario: categoria === "Salário" };
  }
  return { categoria: "Outros", isSalario: false };
}

function parseBrazilianNumber(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

function brDateToISO(str) {
  const [d, m, y] = str.split("/");
  return `${y}-${m}-${d}`;
}

function parseInterCSV(text) {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /data\s*lan[çc]amento/i.test(l) && /valor/i.test(l));
  if (headerIdx === -1) {
    throw new Error('Não encontrei o cabeçalho da tabela ("Data Lançamento ... Valor"). Confira se é um extrato CSV exportado do Inter.');
  }

  const headerCols = lines[headerIdx].split(";").map((c) => c.trim().toLowerCase());
  const idxData = headerCols.findIndex((c) => c.startsWith("data"));
  const idxHistorico = headerCols.findIndex((c) => c.includes("hist"));
  const idxDescricao = headerCols.findIndex((c) => c.includes("descri"));
  const idxValor = headerCols.findIndex((c) => c === "valor");

  if (idxData === -1 || idxValor === -1) {
    throw new Error("Não consegui identificar as colunas de data e valor no cabeçalho do CSV.");
  }

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(";");
    if (cols.length <= idxValor) continue;
    const dataStr = (cols[idxData] || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) continue; // fim da tabela / rodapé
    const valor = parseBrazilianNumber(cols[idxValor]);
    if (valor === null) continue;

    const historico = idxHistorico > -1 ? (cols[idxHistorico] || "").trim() : "";
    const descricaoCol = idxDescricao > -1 ? (cols[idxDescricao] || "").trim() : "";
    const descricao = [historico, descricaoCol].filter(Boolean).join(" · ") || "Lançamento importado";

    rows.push({ data: brDateToISO(dataStr), descricao, valor: Math.abs(valor), tipo: valor < 0 ? "saida" : "entrada" });
  }
  return rows;
}

function parseOFX(text) {
  const rows = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  blocks.forEach((block) => {
    const end = block.search(/<\/STMTTRN>/i);
    const chunk = end > -1 ? block.slice(0, end) : block;
    const get = (tag) => {
      const m = chunk.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dtposted = get("DTPOSTED");
    const trnamt = get("TRNAMT");
    const memo = get("MEMO");
    const name = get("NAME");
    if (!dtposted || !trnamt) return;

    const y = dtposted.slice(0, 4);
    const m = dtposted.slice(4, 6);
    const d = dtposted.slice(6, 8);
    const valor = parseFloat(trnamt.replace(",", "."));
    if (isNaN(valor) || !y || !m || !d) return;

    rows.push({
      data: `${y}-${m}-${d}`,
      descricao: [name, memo].filter(Boolean).join(" · ") || "Lançamento importado",
      valor: Math.abs(valor),
      tipo: valor < 0 ? "saida" : "entrada",
    });
  });
  return rows;
}

function parseExtrato(filename, text) {
  const isOfx = /\.ofx$/i.test(filename) || /<OFX>/i.test(text);
  return isOfx ? parseOFX(text) : parseInterCSV(text);
}

function isDuplicateTx(row, contaId) {
  return Store.data.transactions.some(
    (t) => (t.contaId || "corrente") === contaId && t.data === row.data && t.tipo === row.tipo && Math.abs(t.valor - row.valor) < 0.005
  );
}

// Tenta UTF-8 primeiro; se aparecer caractere de substituição (encoding errado), tenta Latin-1.
function readFileSmart(file, callback) {
  const readerUtf8 = new FileReader();
  readerUtf8.onload = () => {
    const text = String(readerUtf8.result);
    if (text.includes("�")) {
      const readerLatin1 = new FileReader();
      readerLatin1.onload = () => callback(String(readerLatin1.result));
      readerLatin1.readAsText(file, "ISO-8859-1");
    } else {
      callback(text);
    }
  };
  readerUtf8.readAsText(file, "UTF-8");
}

function initImportExtrato() {
  document.getElementById("importExtratoInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readFileSmart(file, (text) => {
      try {
        const parsed = parseExtrato(file.name, text);
        if (!parsed.length) {
          showToast("Não encontrei nenhum lançamento nesse arquivo.");
          return;
        }
        const contaId = document.getElementById("extratoConta").value || "corrente";
        extratoRows = parsed.map((row, i) => {
          const guess = guessCategoria(row);
          const dup = isDuplicateTx(row, contaId);
          return { id: i, ...row, categoria: guess.categoria, isSalario: guess.isSalario, dup, include: !dup };
        });
        renderExtratoPreview();
        showToast(`${parsed.length} lançamentos encontrados.`);
      } catch (err) {
        showToast("Erro ao ler o arquivo: " + err.message);
      }
    });
    e.target.value = "";
  });

  document.getElementById("extratoConta").addEventListener("change", () => {
    const contaId = document.getElementById("extratoConta").value;
    extratoRows.forEach((row) => {
      row.dup = isDuplicateTx(row, contaId);
      row.include = !row.dup;
    });
    renderExtratoPreview();
  });

  document.getElementById("extratoSelectAll").addEventListener("click", () => {
    extratoRows.forEach((r) => (r.include = true));
    renderExtratoPreview();
  });
  document.getElementById("extratoSelectNone").addEventListener("click", () => {
    extratoRows.forEach((r) => (r.include = false));
    renderExtratoPreview();
  });

  document.getElementById("extratoCancel").addEventListener("click", () => {
    extratoRows = [];
    document.getElementById("extratoPreviewPanel").hidden = true;
  });

  document.getElementById("extratoConfirm").addEventListener("click", () => {
    const contaId = document.getElementById("extratoConta").value || "corrente";
    const selecionados = extratoRows.filter((r) => r.include);
    if (!selecionados.length) {
      showToast("Nenhum lançamento selecionado.");
      return;
    }
    selecionados.forEach((row) => {
      Store.addTransaction({
        tipo: row.tipo,
        contaId,
        descricao: row.descricao,
        valor: row.valor,
        data: row.data,
        categoria: row.categoria,
        isSalario: !!row.isSalario,
        isImportado: true,
      });
      if (!Store.getCategories(row.tipo).includes(row.categoria)) {
        Store.addCategory(row.tipo, row.categoria);
      }
    });
    showToast(`${selecionados.length} lançamentos importados.`);
    extratoRows = [];
    document.getElementById("extratoPreviewPanel").hidden = true;
    renderAll();
  });
}

function renderExtratoPreview() {
  document.getElementById("extratoPreviewPanel").hidden = false;

  const included = extratoRows.filter((r) => r.include).length;
  const dupCount = extratoRows.filter((r) => r.dup).length;
  document.getElementById("extratoCount").textContent =
    `${extratoRows.length} encontrados · ${included} selecionados` + (dupCount ? ` · ${dupCount} possíveis duplicatas` : "");

  const tbody = document.getElementById("extratoTableBody");
  tbody.innerHTML = extratoRows
    .map((row) => {
      const cats = Store.getCategories(row.tipo);
      if (!cats.includes(row.categoria)) cats.push(row.categoria);
      return `
    <tr>
      <td data-label="Importar"><input type="checkbox" data-row-toggle="${row.id}" ${row.include ? "checked" : ""}></td>
      <td data-label="Data">${formatDate(row.data)}</td>
      <td data-label="Descrição">
        <input type="text" class="cell-input" data-row-desc="${row.id}" value="${escapeHtml(row.descricao)}">
        ${row.dup ? '<div class="pocket-rate muted">possível duplicata já importada</div>' : ""}
      </td>
      <td data-label="Tipo"><span class="type-tag ${row.tipo}">${row.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
      <td data-label="Valor" class="align-right tx-value ${row.tipo}">${row.tipo === "entrada" ? "+" : "-"} ${formatCurrency(row.valor)}</td>
      <td data-label="Categoria">
        <select class="cell-input" data-row-cat="${row.id}">
          ${cats.map((c) => `<option value="${escapeHtml(c)}" ${c === row.categoria ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
      </td>
    </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-row-toggle]").forEach((el) => {
    el.addEventListener("change", () => {
      extratoRows.find((r) => r.id === Number(el.dataset.rowToggle)).include = el.checked;
      renderExtratoPreview();
    });
  });
  tbody.querySelectorAll("[data-row-desc]").forEach((el) => {
    el.addEventListener("input", () => {
      extratoRows.find((r) => r.id === Number(el.dataset.rowDesc)).descricao = el.value;
    });
  });
  tbody.querySelectorAll("[data-row-cat]").forEach((el) => {
    el.addEventListener("change", () => {
      extratoRows.find((r) => r.id === Number(el.dataset.rowCat)).categoria = el.value;
    });
  });
}
