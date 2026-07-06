import "./style.css";
import {
  calculateHiddenRate,
  calculateStackedDiscounts,
} from "./calculations.js";

document.querySelector("#app").innerHTML = `
  <div class="app">
    <div class="container">
      <header class="header">
        <div>
          <h1>Calculadora POS</h1>
        </div>
        <button class="clear-btn" id="clearBtn">Limpiar</button>
      </header>

      <section class="card">
        <span class="step">Paso 1</span>
        <h2>Precio final para el cliente</h2>

        <div class="money-input money-input-main">
          <span>$</span>
          <input id="targetPrice" type="tel" inputmode="numeric" placeholder="0" />
        </div>
      </section>

      <section class="card">
        <span class="step">Paso 2</span>
        <h2>Descuentos que aplica el POS</h2>

        <div class="discounts-list" id="discountsList"></div>
        <button class="add-discount-btn" id="addDiscountBtn">Agregar otro descuento</button>

        <p class="warning" id="warningText"></p>
      </section>

      <section class="card result-card">
        <span class="step">Resultado</span>

        <div class="result-box" id="resultBox">
          <p class="result-kicker">PRECIO A DIGITAR</p>
          <p class="result-price" id="posPrice">$0</p>
        </div>

        <div class="steps-panel" id="stepsPanel" hidden>
          <p class="steps-title">Como se calculo</p>
          <ol class="steps-list" id="stepsList"></ol>
        </div>
      </section>
    </div>
  </div>
`;

const $ = (id) => document.getElementById(id);

const elements = {
  targetPrice: $("targetPrice"),
  discountsList: $("discountsList"),
  addDiscountBtn: $("addDiscountBtn"),
  posPrice: $("posPrice"),
  resultBox: $("resultBox"),
  warningText: $("warningText"),
  clearBtn: $("clearBtn"),
  stepsPanel: $("stepsPanel"),
  stepsList: $("stepsList"),
};

let discounts = [createDiscount()];
let lastPosPriceText = "$0";
let hasMounted = false;

function createDiscount() {
  return {
    type: "percent",
    value: 0,
    currentPosPrice: 0,
    observedDiscount: 0,
  };
}

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toInt(value) {
  const clean = digitsOnly(String(value || ""));
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

function formatMoneyDetail(value) {
  if (!Number.isFinite(value)) return "0";
  const hasCents = !Number.isInteger(value);
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value) {
  if (!Number.isFinite(value)) return "0,00";
  return value.toFixed(2).replace(".", ",");
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

function typeLabel(type) {
  if (type === "fixed") return "Descuento fijo";
  if (type === "percent") return "Descuento porcentual";
  return "descuento variable";
}

function fieldMarkup(discount, index) {
  if (discount.type === "fixed") {
    return `
      <div class="field">
        <label class="label">Monto del descuento</label>
        <div class="money-input compact-input">
          <span>$</span>
          <input
            class="discount-money-input"
            data-index="${index}"
            data-field="value"
            type="tel"
            inputmode="numeric"
            placeholder="0"
            value="${discount.value ? formatMoney(discount.value) : ""}"
          />
        </div>
      </div>
    `;
  }

  if (discount.type === "percent") {
    return `
      <div class="field">
        <label class="label">Porcentaje que descuenta</label>
        <div class="percent-input compact-input">
          <input
            class="discount-percent-input"
            data-index="${index}"
            data-field="value"
            type="tel"
            inputmode="numeric"
            placeholder="0"
            value="${discount.value || ""}"
          />
          <span>%</span>
        </div>
      </div>
    `;
  }

  const rateResult = calculateHiddenRate(
    discount.currentPosPrice,
    discount.observedDiscount,
  );
  const rateText = rateResult.warning ? "0,00%" : `${formatPct(rateResult.hiddenRate * 100)}%`;

  return `
    <div class="money-grid">
      <div class="field">
        <label class="label">Precio actual en POS</label>
        <div class="money-input compact-input">
          <span>$</span>
          <input
            class="discount-money-input"
            data-index="${index}"
            data-field="currentPosPrice"
            type="tel"
            inputmode="numeric"
            placeholder="0"
            value="${discount.currentPosPrice ? formatMoney(discount.currentPosPrice) : ""}"
          />
        </div>
      </div>

      <div class="field">
        <label class="label">Descuento en pesos</label>
        <div class="money-input compact-input">
          <span>$</span>
          <input
            class="discount-money-input"
            data-index="${index}"
            data-field="observedDiscount"
            type="tel"
            inputmode="numeric"
            placeholder="0"
            value="${discount.observedDiscount ? formatMoney(discount.observedDiscount) : ""}"
          />
        </div>
      </div>
    </div>

    <div class="info-plain variable-rate">
      <p class="info-label">Porcentaje calculado</p>
      <p class="info-value info-value-small" data-rate-index="${index}">${rateText}</p>

    </div>
  `;
}

function renderDiscounts() {
  elements.discountsList.innerHTML = discounts
    .map((discount, index) => {
      const isOnlyDiscount = discounts.length === 1;
      const types = ["percent", "fromCurrent", "fixed"];

      return `
        <article class="discount-item">
          <div class="discount-header">
            <p class="group-title">Descuento ${index + 1}</p>
            <button
              class="remove-discount-btn"
              data-index="${index}"
              ${isOnlyDiscount ? "disabled" : ""}
              aria-label="Eliminar descuento ${index + 1}"
            >
              Eliminar
            </button>
          </div>

          <div class="mode-row type-row">
            ${types
              .map(
                (type) => `
                  <button
                    class="mode-btn type-btn ${discount.type === type ? "active" : ""}"
                    data-index="${index}"
                    data-type="${type}"
                  >
                    ${typeLabel(type)}
                  </button>
                `,
              )
              .join("")}
          </div>

          <div class="discount-fields">
            ${fieldMarkup(discount, index)}
          </div>
        </article>
      `;
    })
    .join("");

  bindDiscountEvents();
}

function bindDiscountEvents() {
  elements.discountsList.querySelectorAll(".type-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = toInt(button.dataset.index);
      const nextType = button.dataset.type;

      if (discounts[index].type === nextType) return;

      discounts[index] = {
        ...createDiscount(),
        type: nextType,
      };
      renderDiscounts();
      updateValues();
    });
  });

  elements.discountsList.querySelectorAll(".remove-discount-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = toInt(button.dataset.index);
      if (discounts.length <= 1) return;

      discounts.splice(index, 1);
      renderDiscounts();
      updateValues();
    });
  });

  elements.discountsList.querySelectorAll(".discount-money-input").forEach((input) => {
    input.addEventListener("input", () => {
      const index = toInt(input.dataset.index);
      const field = input.dataset.field;
      const raw = sanitizeMoney(input.value);

      discounts[index][field] = toInt(raw);
      setMoneyInputValue(input, raw);
      updateRateText(index);
      updateValues();
    });
  });

  elements.discountsList.querySelectorAll(".discount-percent-input").forEach((input) => {
    input.addEventListener("input", () => {
      const index = toInt(input.dataset.index);
      const field = input.dataset.field;

      input.value = sanitizePercent(input.value);
      discounts[index][field] = toInt(input.value);
      updateValues();
    });
  });
}

function updateRateText(index) {
  const rateElement = elements.discountsList.querySelector(`[data-rate-index="${index}"]`);
  if (!rateElement) return;

  const discount = discounts[index];
  const result = calculateHiddenRate(discount.currentPosPrice, discount.observedDiscount);
  rateElement.textContent = result.warning ? "0,00%" : `${formatPct(result.hiddenRate * 100)}%`;
}

function renderSteps(steps) {
  if (!steps.length) {
    elements.stepsPanel.hidden = true;
    elements.stepsList.innerHTML = "";
    return;
  }

  elements.stepsPanel.hidden = false;
  elements.stepsList.innerHTML = steps
    .map((step) => {
      if (step.type === "fixed") {
        return `
          <li>
            Descuento ${step.index + 1}: $${formatMoney(step.before)} + $${formatMoney(step.value)}
            = $${formatMoney(step.after)}
          </li>
        `;
      }

      return `
        <li>
          Descuento ${step.index + 1}: $${formatMoney(step.before)} / ${formatPct(1 - step.rate)}
          = $${formatMoneyDetail(step.after)}
        </li>
      `;
    })
    .join("");
}

function updateValues() {
  const target = toInt(elements.targetPrice.dataset.raw || "");
  const result = calculateStackedDiscounts(target, discounts);
  const posPriceText = `$${formatMoney(result.posPrice)}`;

  elements.posPrice.textContent = posPriceText;
  elements.warningText.textContent = target > 0 ? result.warning : "";

  if (target <= 0) {
    renderSteps([]);
  } else if (result.warning) {
    renderSteps([]);
  } else if (result.activeCount === 0) {
    renderSteps([]);
  } else {
    renderSteps(result.steps);
  }

  if (hasMounted && posPriceText !== lastPosPriceText) {
    pulseResult();
  }

  lastPosPriceText = posPriceText;
  hasMounted = true;
}

function setupTargetInput(input) {
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
        // Algunos navegadores moviles pueden no permitirlo siempre.
      }
    });
  });
}

function clearAll() {
  elements.targetPrice.value = "";
  elements.targetPrice.dataset.raw = "";
  elements.warningText.textContent = "";
  discounts = [createDiscount()];
  renderDiscounts();
  updateValues();

  requestAnimationFrame(() => {
    elements.targetPrice.focus();
  });
}

elements.addDiscountBtn.addEventListener("click", () => {
  discounts.push(createDiscount());
  renderDiscounts();
  updateValues();

  requestAnimationFrame(() => {
    const lastItem = elements.discountsList.querySelector(
      ".discount-item:last-child",
    );
    lastItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const input = lastItem?.querySelector("input");
    input?.focus();
  });
});

elements.clearBtn.addEventListener("click", clearAll);

setupTargetInput(elements.targetPrice);
renderDiscounts();
updateValues();
