import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateFixedDiscount,
  calculatePercentDiscount,
  calculateStackedDiscounts,
  calculateVariableDiscount,
} from "../src/calculations.js";

describe("descuento por porcentaje", () => {
  const cases = [
    { targetPrice: 7000, discountPct: 30, expectedPosPrice: 10000 },
    { targetPrice: 38700, discountPct: 40, expectedPosPrice: 64500 },
    { targetPrice: 15990, discountPct: 15, expectedPosPrice: 18811 },
  ];

  for (const testCase of cases) {
    it(`calcula ${testCase.expectedPosPrice} para final ${testCase.targetPrice} con ${testCase.discountPct}%`, () => {
      const result = calculatePercentDiscount(testCase.targetPrice, testCase.discountPct);

      assert.equal(result.posPrice, testCase.expectedPosPrice);
      assert.equal(result.warning, "");
    });
  }
});

describe("descuento fijo en valor", () => {
  const cases = [
    { targetPrice: 7000, fixedDiscount: 3000, expectedPosPrice: 10000 },
    { targetPrice: 38700, fixedDiscount: 19350, expectedPosPrice: 58050 },
    { targetPrice: 84900, fixedDiscount: 10000, expectedPosPrice: 94900 },
  ];

  for (const testCase of cases) {
    it(`suma ${testCase.fixedDiscount} al final ${testCase.targetPrice}`, () => {
      const result = calculateFixedDiscount(testCase.targetPrice, testCase.fixedDiscount);
      const finalPrice = result.posPrice - testCase.fixedDiscount;

      assert.equal(result.posPrice, testCase.expectedPosPrice);
      assert.equal(finalPrice, testCase.targetPrice);
      assert.equal(result.warning, "");
    });
  }
});

describe("descuento variable mostrado en valor", () => {
  const cases = [
    {
      targetPrice: 8000,
      currentPosPrice: 12000,
      observedDiscount: 2400,
      expectedRate: 0.2,
      expectedPosPrice: 10000,
      expectedEstimatedDiscount: 2000,
    },
    {
      targetPrice: 38700,
      currentPosPrice: 62300,
      observedDiscount: 19350,
      expectedRate: 19350 / 62300,
      expectedPosPrice: 56135,
      expectedEstimatedDiscount: 17435,
    },
    {
      targetPrice: 7000,
      currentPosPrice: 10000,
      observedDiscount: 1500,
      expectedRate: 0.15,
      expectedPosPrice: 8235,
      expectedEstimatedDiscount: 1235,
    },
  ];

  for (const testCase of cases) {
    it(`detecta el porcentaje oculto desde ${testCase.currentPosPrice} - ${testCase.observedDiscount}`, () => {
      const result = calculateVariableDiscount(
        testCase.targetPrice,
        testCase.currentPosPrice,
        testCase.observedDiscount,
      );

      assert.equal(result.posPrice, testCase.expectedPosPrice);
      assert.equal(result.estimatedDiscount, testCase.expectedEstimatedDiscount);
      assert.equal(result.hiddenRate, testCase.expectedRate);
      assert.equal(result.warning, "");
    });
  }
});

describe("descuentos apilados", () => {
  it("deshace descuentos desde el ultimo hacia el primero", () => {
    const result = calculateStackedDiscounts(7000, [
      { type: "percent", value: 20 },
      { type: "fixed", value: 1000 },
    ]);

    assert.equal(result.posPrice, 10000);
    assert.equal(result.activeCount, 2);
    assert.deepEqual(
      result.steps.map((step) => step.type),
      ["fixed", "percent"],
    );
  });

  it("calcula porcentajes ocultos dentro de una pila", () => {
    const result = calculateStackedDiscounts(8000, [
      {
        type: "fromCurrent",
        currentPosPrice: 12000,
        observedDiscount: 2400,
      },
      { type: "fixed", value: 500 },
    ]);

    assert.equal(result.posPrice, 10625);
    assert.equal(result.warning, "");
    assert.equal(result.activeCount, 2);
  });

  it("rechaza porcentajes de 100% o mas", () => {
    const result = calculateStackedDiscounts(8000, [
      { type: "percent", value: 100 },
    ]);

    assert.equal(result.posPrice, 0);
    assert.match(result.warning, /menor al 100%/);
  });
});
