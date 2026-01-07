import { calculateHouseholds } from './utils'; // Move your logic to a separate function

test('calculates household energy correctly', () => {
  expect(calculateHouseholds(2.0)).toBe(1143);
});