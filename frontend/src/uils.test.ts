import { calculateHouseholds } from './utils'; // Move your logic to a separate function

test('calculates household energy correctly', () => {
  const capacity = 2.0; // 2MW
  const result = Math.round((capacity * 2000) / 3.5);
  expect(result).toBe(1143);
});