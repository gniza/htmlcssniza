/* Gráficos simples em canvas puro — sem dependências externas. */

const CHART_COLORS = ["#6c8cff", "#35c98f", "#ffb84d", "#ff6b6b", "#a78bfa", "#4ecdc4", "#f472b6", "#facc15"];

function drawBarChart(canvas, labels, incomeData, expenseData) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 500;
  const h = canvas.clientHeight || 220;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padding = { top: 10, right: 10, bottom: 28, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...incomeData, ...expenseData);
  const niceMax = Math.ceil(maxVal / 100) * 100 || 100;

  // grid lines
  ctx.strokeStyle = "#29334a";
  ctx.fillStyle = "#8b96ab";
  ctx.font = "11px sans-serif";
  ctx.lineWidth = 1;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = padding.top + chartH - (chartH * i) / steps;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    const val = (niceMax * i) / steps;
    ctx.fillText(formatCompact(val), 4, y + 4);
  }

  const groupWidth = chartW / labels.length;
  const barWidth = Math.min(22, groupWidth * 0.28);

  labels.forEach((label, i) => {
    const groupX = padding.left + groupWidth * i + groupWidth / 2;
    const incomeH = (incomeData[i] / niceMax) * chartH;
    const expenseH = (expenseData[i] / niceMax) * chartH;

    ctx.fillStyle = "#35c98f";
    ctx.fillRect(groupX - barWidth - 3, padding.top + chartH - incomeH, barWidth, incomeH);

    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(groupX + 3, padding.top + chartH - expenseH, barWidth, expenseH);

    ctx.fillStyle = "#8b96ab";
    ctx.textAlign = "center";
    ctx.fillText(label, groupX, h - 8);
    ctx.textAlign = "left";
  });
}

function drawDonutChart(canvas, entries) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 260;
  const h = canvas.clientHeight || 220;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 8;
  const innerRadius = radius * 0.6;

  const total = entries.reduce((s, e) => s + e.value, 0);

  if (total <= 0) {
    ctx.strokeStyle = "#29334a";
    ctx.lineWidth = radius - innerRadius;
    ctx.beginPath();
    ctx.arc(cx, cy, (radius + innerRadius) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#8b96ab";
    ctx.textAlign = "center";
    ctx.font = "13px sans-serif";
    ctx.fillText("Sem dados", cx, cy + 4);
    ctx.textAlign = "left";
    return;
  }

  let startAngle = -Math.PI / 2;
  entries.forEach((entry, i) => {
    const slice = (entry.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.arc(cx, cy, innerRadius, startAngle + slice, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    startAngle += slice;
  });

  ctx.fillStyle = "#e7ebf3";
  ctx.textAlign = "center";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(formatCurrency(total), cx, cy - 2);
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#8b96ab";
  ctx.fillText("total", cx, cy + 14);
  ctx.textAlign = "left";
}

function formatCompact(val) {
  if (val >= 1000) return (val / 1000).toFixed(1).replace(".0", "") + "k";
  return String(Math.round(val));
}
