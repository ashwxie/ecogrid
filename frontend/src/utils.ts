export const calculateHouseholds = (capacityMW: number): number => {
  return Math.round((capacityMW * 2000) / 3.5);
};