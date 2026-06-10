export interface SelectedMaterial {
  itemId: string;
  name: string;
  quantity: number;
  costPerUnit: number;
}

/**
 * Calcula o custo total dos materiais selecionados.
 */
export function calculateMaterialsCost(materials: SelectedMaterial[]): number {
  return materials.reduce((acc, m) => acc + (m.quantity * m.costPerUnit), 0);
}

/**
 * Calcula o custo da mão de obra com base em horas e valor por hora.
 */
export function calculateLaborCost(laborHours: string | number, hourlyRate: string | number): number {
  const hours = Number(laborHours) || 0;
  const rate = Number(hourlyRate) || 0;
  return hours * rate;
}

/**
 * Converte e limpa o valor de custos extras.
 */
export function parseExtraCost(additionalCosts: string | number): number {
  if (typeof additionalCosts === 'number') {
    return additionalCosts || 0;
  }
  const cleanString = (additionalCosts || '0').toString().replace(',', '.');
  return Number(cleanString) || 0;
}

/**
 * Calcula o custo total somando materiais, mão de obra e custos extras.
 */
export function calculateTotalCost(
  materialsCost: number,
  laborCost: number,
  extraCost: number
): number {
  return materialsCost + laborCost + extraCost;
}

/**
 * Calcula o preço de venda sugerido com base no custo total e margem de lucro.
 * Fórmula de Margem de Contribuição: Preço Sugerido = Custo Total / (1 - Margem %)
 */
export function calculateSuggestedPrice(totalCost: number, marginPercent: number): number {
  const marginDecimal = marginPercent / 100;
  if (marginDecimal >= 1) {
    return totalCost;
  }
  return totalCost / (1 - marginDecimal);
}

/**
 * Calcula o lucro líquido a partir do preço sugerido e custo total.
 */
export function calculateNetProfit(suggestedPrice: number, totalCost: number): number {
  return suggestedPrice - totalCost;
}
