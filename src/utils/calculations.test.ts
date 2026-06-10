import { describe, it, expect } from 'vitest';
import {
  calculateMaterialsCost,
  calculateLaborCost,
  parseExtraCost,
  calculateTotalCost,
  calculateSuggestedPrice,
  calculateNetProfit,
  SelectedMaterial
} from './calculations';

describe('Cálculos Matemáticos de Orçamento', () => {
  
  describe('calculateMaterialsCost', () => {
    it('deve retornar 0 para uma lista de materiais vazia', () => {
      expect(calculateMaterialsCost([])).toBe(0);
    });

    it('deve calcular corretamente a soma dos materiais', () => {
      const materials: SelectedMaterial[] = [
        { itemId: '1', name: 'Resina', quantity: 2, costPerUnit: 150 },
        { itemId: '2', name: 'Pigmento', quantity: 0.5, costPerUnit: 80 }
      ];
      // 2 * 150 + 0.5 * 80 = 300 + 40 = 340
      expect(calculateMaterialsCost(materials)).toBe(340);
    });
  });

  describe('calculateLaborCost', () => {
    it('deve retornar 0 se horas ou taxa forem nulas/vazias', () => {
      expect(calculateLaborCost('', '')).toBe(0);
      expect(calculateLaborCost(10, 0)).toBe(0);
      expect(calculateLaborCost(0, 50)).toBe(0);
    });

    it('deve calcular a multiplicação correta de horas e taxa', () => {
      expect(calculateLaborCost(15, 60)).toBe(900);
      expect(calculateLaborCost('8.5', '50')).toBe(425);
    });
  });

  describe('parseExtraCost', () => {
    it('deve converter corretamente strings com vírgula para número', () => {
      expect(parseExtraCost('150,50')).toBe(150.5);
    });

    it('deve converter corretamente strings com ponto para número', () => {
      expect(parseExtraCost('99.99')).toBe(99.99);
    });

    it('deve retornar 0 para valores inválidos ou vazios', () => {
      expect(parseExtraCost('')).toBe(0);
      expect(parseExtraCost('abc')).toBe(0);
    });

    it('deve retornar o próprio número se já for do tipo number', () => {
      expect(parseExtraCost(75.25)).toBe(75.25);
    });
  });

  describe('calculateTotalCost', () => {
    it('deve somar corretamente os três valores de custo', () => {
      expect(calculateTotalCost(340, 900, 150.5)).toBe(1390.5);
      expect(calculateTotalCost(0, 0, 0)).toBe(0);
    });
  });

  describe('calculateSuggestedPrice', () => {
    it('deve sugerir o mesmo preço de custo se a margem for 0%', () => {
      expect(calculateSuggestedPrice(1000, 0)).toBe(1000);
    });

    it('deve calcular corretamente o preço sugerido com margem de lucro', () => {
      // Preço = 700 / (1 - 0.3) = 700 / 0.7 = 1000
      expect(calculateSuggestedPrice(700, 30)).toBe(1000);
      // Preço = 150 / (1 - 0.5) = 150 / 0.5 = 300
      expect(calculateSuggestedPrice(150, 50)).toBe(300);
    });

    it('deve evitar divisão por zero se a margem for 100% ou maior', () => {
      expect(calculateSuggestedPrice(500, 100)).toBe(500);
      expect(calculateSuggestedPrice(500, 120)).toBe(500);
    });
  });

  describe('calculateNetProfit', () => {
    it('deve retornar a diferença correta de lucro líquido', () => {
      expect(calculateNetProfit(1000, 700)).toBe(300);
      expect(calculateNetProfit(500, 500)).toBe(0);
    });
  });

});
