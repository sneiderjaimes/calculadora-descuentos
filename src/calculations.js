export function roundClientPeso(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

export function calculatePercentDiscount(targetPrice, discountPct) {
  if (discountPct >= 100) {
    return {
      posPrice: 0,
      warning: "El descuento debe ser menor al 100%.",
    };
  }

  const denominator = 1 - discountPct / 100;

  return {
    posPrice: denominator > 0 ? roundClientPeso(targetPrice / denominator) : 0,
    warning: "",
  };
}

export function calculateFixedDiscount(targetPrice, fixedDiscount) {
  return {
    posPrice: targetPrice + fixedDiscount,
    warning: "",
  };
}

export function calculateVariableDiscount(targetPrice, currentPosPrice, observedDiscount) {
  const rateResult = calculateHiddenRate(currentPosPrice, observedDiscount);

  if (rateResult.warning) {
    return {
      posPrice: 0,
      hiddenRate: 0,
      estimatedDiscount: 0,
      warning: rateResult.warning,
    };
  }

  const hiddenRate = rateResult.hiddenRate;
  const denominator = 1 - hiddenRate;
  const posPrice = denominator > 0 ? roundClientPeso(targetPrice / denominator) : 0;
  const estimatedDiscount = roundClientPeso(posPrice * hiddenRate);

  return {
    posPrice,
    hiddenRate,
    estimatedDiscount,
    warning: "",
  };
}

export function calculateHiddenRate(currentPosPrice, observedDiscount) {
  if (!currentPosPrice && !observedDiscount) {
    return {
      hiddenRate: 0,
      warning: "Ingresa el precio actual del POS y el descuento que muestra.",
    };
  }

  if (currentPosPrice <= 0) {
    return {
      hiddenRate: 0,
      warning: "El precio actual del POS debe ser mayor que cero.",
    };
  }

  if (observedDiscount < 0) {
    return {
      hiddenRate: 0,
      warning: "El descuento en pesos no puede ser negativo.",
    };
  }

  if (observedDiscount >= currentPosPrice) {
    return {
      hiddenRate: 0,
      warning: "El descuento debe ser menor que el precio actual.",
    };
  }

  return {
    hiddenRate: observedDiscount / currentPosPrice,
    warning: "",
  };
}

export function calculateStackedDiscounts(targetPrice, discounts) {
  if (targetPrice <= 0) {
    return {
      posPrice: 0,
      warning: "",
      steps: [],
      activeCount: 0,
    };
  }

  const activeDiscounts = [];

  for (let index = 0; index < discounts.length; index += 1) {
    const discount = discounts[index];

    if (discount.type === "fixed") {
      if (discount.value > 0) {
        activeDiscounts.push({
          type: "fixed",
          index,
          value: discount.value,
        });
      }
      continue;
    }

    if (discount.type === "percent") {
      if (discount.value >= 100) {
        return {
          posPrice: 0,
          warning: `El porcentaje del descuento ${index + 1} debe ser menor al 100%.`,
          steps: [],
          activeCount: activeDiscounts.length,
        };
      }

      if (discount.value > 0) {
        activeDiscounts.push({
          type: "percent",
          index,
          rate: discount.value / 100,
        });
      }
      continue;
    }

    if (discount.type === "fromCurrent") {
      const hasCurrent = discount.currentPosPrice > 0;
      const hasObserved = discount.observedDiscount > 0;

      if (!hasCurrent && !hasObserved) {
        return {
          posPrice: 0,
          warning: `Completa el precio actual y el descuento en pesos del descuento ${index + 1}.`,
          steps: [],
          activeCount: activeDiscounts.length,
        };
      }

      const rateResult = calculateHiddenRate(
        discount.currentPosPrice,
        discount.observedDiscount,
      );

      if (rateResult.warning) {
        return {
          posPrice: 0,
          warning: `Descuento ${index + 1}: ${rateResult.warning}`,
          steps: [],
          activeCount: activeDiscounts.length,
        };
      }

      if (rateResult.hiddenRate > 0) {
        activeDiscounts.push({
          type: "fromCurrent",
          index,
          rate: rateResult.hiddenRate,
          currentPosPrice: discount.currentPosPrice,
          observedDiscount: discount.observedDiscount,
        });
      }
    }
  }

  let runningPrice = targetPrice;
  const steps = [];

  for (let i = activeDiscounts.length - 1; i >= 0; i -= 1) {
    const discount = activeDiscounts[i];
    const before = runningPrice;

    if (discount.type === "fixed") {
      runningPrice += discount.value;
      steps.push({
        type: "fixed",
        index: discount.index,
        before,
        value: discount.value,
        after: runningPrice,
      });
      continue;
    }

    const denominator = 1 - discount.rate;
    runningPrice = denominator > 0 ? runningPrice / denominator : 0;
    steps.push({
      type: discount.type,
      index: discount.index,
      before,
      rate: discount.rate,
      after: runningPrice,
    });
  }

  return {
    posPrice: roundClientPeso(runningPrice),
    warning: "",
    steps,
    activeCount: activeDiscounts.length,
  };
}
