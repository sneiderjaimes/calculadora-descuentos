import "./style.css";

document.querySelector("#app").innerHTML = `
  <div class="app">
    <div class="container">
      <header class="header">
        <div>
          <h1>Calculadora POS</h1>
          <p>Cálculo rápido y claro</p>
        </div>
        <button class="clear-btn" id="clearBtn">Borrar</button>
      </header>

      <section class="card">
        <span class="step">Paso 1</span>
        <h2>Precio sin descuentos</h2>

        <div class="money-input money-input-main">
          <span>$</span>
          <input id="basePrice" type="tel" inputmode="numeric" placeholder="0" />
        </div>

        <h3 class="group-title">Descuentos que aplica</h3>

        <div class="percent-row">
          <div class="field">
            <label class="label">POS</label>
            <div class="percent-input">
              <input id="posPct" type="tel" inputmode="numeric" placeholder="0" />
              <span>%</span>
            </div>
          </div>

          <div class="field">
            <label class="label">Tarjeta</label>
            <div class="percent-input">
              <input id="cardPct" type="tel" inputmode="numeric" placeholder="0" />
              <span>%</span>
            </div>
          </div>
        </div>

        <p class="warning" id="warningText"></p>
      </section>

      <section class="card">
        <span class="step">Paso 2</span>
        <h2>Elige una opción</h2>

        <div class="mode-row">
          <button class="mode-btn active" id="modeReal">Tengo el % real</button>
          <button class="mode-btn" id="modeFinal">Tengo el precio final</button>
        </div>

        <div id="realSection">
          <div class="field">
            <label class="label">Descuento real</label>
            <div class="percent-input">
              <input id="realPct" type="tel" inputmode="numeric" placeholder="0" />
              <span>%</span>
            </div>
          </div>

          <div class="info-plain">
            <p class="info-label">Precio final esperado</p>
            <p class="info-value" id="targetFinalPrice">$0</p>
            <p class="info-caption">Calculado automáticamente</p>
          </div>
        </div>

        <div id="finalSection" style="display: none;">
          <div class="field">
            <label class="label">Precio final esperado</label>
            <div class="money-input">
              <span>$</span>
              <input id="finalPrice" type="tel" inputmode="numeric" placeholder="0" />
            </div>
          </div>

          <div class="info-plain">
            <p class="info-label">Descuento real</p>
            <p class="info-value" id="computedRealPct">0,00%</p>
            <p class="info-caption">Calculado automáticamente</p>
          </div>
        </div>

        <p class="helper" id="helperText">
          Ingresa primero el precio sin descuentos para interpretar mejor el resultado.
        </p>
      </section>

      <section class="card result-card">
        <span class="step">Resultado</span>

        <div class="result-box" id="resultBox">
          <p class="result-kicker">PRECIO PARA EL POS</p>
          <p class="result-price" id="posPrice">$0</p>
          <p class="result-help">Este es el precio que debes digitar en el POS</p>
        </div>
      </section>
    </div>
  </div>
`;

const $ = (id) => document.getElementById(id);

const elements = {
  basePrice: $("basePrice"),
  posPct: $("posPct"),
  cardPct: $("cardPct"),
  realPct: $("realPct"),
  finalPrice: $("finalPrice"),
  targetFinalPrice: $("targetFinalPrice"),
  computedRealPct: $("computedRealPct"),
  posPrice: $("posPrice"),
  resultBox: $("resultBox"),
  helperText: $("helperText"),
  warningText: $("warningText"),
  clearBtn: $("clearBtn"),
  modeReal: $("modeReal"),
  modeFinal: $("modeFinal"),
  realSection: $("realSection"),
  finalSection: $("finalSection"),
};

let mode = "real";
let lastPosPriceText = "$0";
let hasMounted = false;

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toInt(value) {
  const clean = digitsOnly(value);
  return clean ? parseInt(clean, 10) : 0;
}

function sanitizeMoney(value) {
  return digitsOnly(value).slice(0, 10);
}

function sanitizePercent(value) {
  const clean = digitsOnly(value).slice(0, 3);
  if (!clean) return "";
  return String(clamp(parseInt(clean, 10), 0, 100));
}

function formatMoney(value) {
  const numeric = typeof value === "string" ? toInt(value) : value;
  if (!numeric || Number.isNaN(numeric)) return "0";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Math.round(numeric));
}

function formatPct(value) {
  if (!Number.isFinite(value)) return "0,00";
  return value.toFixed(2).replace(".", ",");
}

function roundCommercialPeso(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value + 0.5);
}

function setMoneyInputValue(input, digits) {
  input.value = digits ? formatMoney(digits) : "";
}

function pulseResult() {
  if (!elements.resultBox) return;

  elements.resultBox.style.transition = "transform 140ms ease, border-color 140ms ease";
  elements.resultBox.style.transform = "scale(1.01)";
  elements.resultBox.style.borderColor = "rgba(215, 177, 90, 0.30)";

  clearTimeout(pulseResult._timer);
  pulseResult._timer = setTimeout(() => {
    elements.resultBox.style.transform = "scale(1)";
    elements.resultBox.style.borderColor = "rgba(215, 177, 90, 0.20)";
  }, 150);
}

function updateHelperVisibility(base) {
  if (!elements.helperText) return;
  elements.helperText.style.display = base > 0 ? "none" : "block";
}

function updateWarningText(totalDiscountPct) {
  if (!elements.warningText) return;

  if (totalDiscountPct >= 100) {
    elements.warningText.textContent =
      "La suma de descuentos llegó a 100%. El precio para el POS se fijó en $0.";
    return;
  }

  elements.warningText.textContent = "";
}

function updateValues() {
  const base = toInt(elements.basePrice.dataset.raw || "");
  const pos = toInt(elements.posPct.value);
  const card = toInt(elements.cardPct.value);
  const totalDiscountPct = clamp(pos + card, 0, 100);

  const realPct = clamp(toInt(elements.realPct.value), 0, 100);
  const manualFinal = toInt(elements.finalPrice.dataset.raw || "");

  const targetFinalPrice =
    mode === "real"
      ? Math.max(0, roundCommercialPeso(base * (1 - realPct / 100)))
      : Math.max(0, manualFinal);

  const computedRealPctFromFinal =
    base > 0 ? clamp((1 - targetFinalPrice / base) * 100, 0, 100) : 0;

  const denominator = 1 - totalDiscountPct / 100;

  const posPrice =
    denominator <= 0
      ? 0
      : Math.max(0, roundCommercialPeso(targetFinalPrice / denominator));

  const posPriceText = `$${formatMoney(posPrice)}`;

  elements.targetFinalPrice.textContent = `$${formatMoney(targetFinalPrice)}`;
  elements.computedRealPct.textContent = `${formatPct(computedRealPctFromFinal)}%`;
  elements.posPrice.textContent = posPriceText;

  updateWarningText(totalDiscountPct);
  updateHelperVisibility(base);

  if (hasMounted && posPriceText !== lastPosPriceText) {
    pulseResult();
  }

  lastPosPriceText = posPriceText;
  hasMounted = true;
}

function setupMoneyInput(input) {
  input.dataset.raw = "";

  input.addEventListener("input", () => {
    const raw = sanitizeMoney(input.value);
    input.dataset.raw = raw;
    setMoneyInputValue(input, raw);
    updateValues();
  });

  input.addEventListener("focus", () => {
    requestAnimationFrame(() => {
      const length = input.value.length;
      try {
        input.setSelectionRange(length, length);
      } catch {
        // algunos navegadores móviles pueden no permitirlo siempre
      }
    });
  });
}

function setupPercentInput(input) {
  input.addEventListener("input", () => {
    input.value = sanitizePercent(input.value);
    updateValues();
  });
}

function setMode(nextMode) {
  mode = nextMode;

  const realActive = mode === "real";

  elements.modeReal.classList.toggle("active", realActive);
  elements.modeFinal.classList.toggle("active", !realActive);

  elements.realSection.style.display = realActive ? "block" : "none";
  elements.finalSection.style.display = realActive ? "none" : "block";

  updateValues();
}

function clearAll() {
  elements.basePrice.value = "";
  elements.basePrice.dataset.raw = "";

  elements.posPct.value = "";
  elements.cardPct.value = "";
  elements.realPct.value = "";

  elements.finalPrice.value = "";
  elements.finalPrice.dataset.raw = "";

  elements.warningText.textContent = "";
  setMode("real");
  updateValues();

  requestAnimationFrame(() => {
    elements.basePrice.focus();
  });
}

setupMoneyInput(elements.basePrice);
setupMoneyInput(elements.finalPrice);
setupPercentInput(elements.posPct);
setupPercentInput(elements.cardPct);
setupPercentInput(elements.realPct);

elements.modeReal.addEventListener("click", () => setMode("real"));
elements.modeFinal.addEventListener("click", () => setMode("final"));
elements.clearBtn.addEventListener("click", clearAll);

updateValues();