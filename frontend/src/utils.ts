export const calculateHouseholds = (capacityMW: number): number => {
  // Household Calculation: $Capacity \times 2000 / 3.5$
  return Math.round((capacityMW * 2000) / 3.5);
};