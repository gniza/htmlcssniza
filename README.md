# FinCRM — Controle Financeiro Pessoal

CRM pessoal para organizar suas finanças: registre entradas, saídas e salários, acompanhe o saldo por mês e visualize seus gastos por categoria.

Projeto 100% front-end (HTML, CSS e JavaScript puro), sem backend. Todos os dados ficam salvos no `localStorage` do seu navegador.

## Funcionalidades

- **Dashboard** com saldo do mês, saldo total acumulado, gráfico de entradas x saídas dos últimos 6 meses e gráfico de saídas por categoria.
- **Transações**: cadastro, edição e exclusão de entradas e saídas, com busca e filtros por tipo, categoria e mês.
- **Salário**: tela dedicada para registrar salários recebidos, com histórico, último valor, média dos últimos 6 meses e total do ano.
- **Categorias**: crie e remova categorias personalizadas para entradas e saídas.
- **Backup**: exporte seus dados para um arquivo `.json` e importe novamente quando quiser (ou troque de navegador/computador).

## Como usar

Basta abrir o arquivo `index.html` em qualquer navegador — não é necessário instalar nada nem rodar um servidor.

```
git clone <este-repositorio>
cd htmlcssniza
# abra index.html no navegador
```

## Estrutura

```
index.html        # marcação e telas (dashboard, transações, salário, categorias, dados)
css/style.css      # estilos
js/storage.js      # persistência em localStorage
js/charts.js       # gráficos em canvas puro
js/app.js          # lógica de UI e renderização
```
