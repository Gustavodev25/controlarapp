import { calculateFinancials } from '../utils/financial-math';

describe('financial math', () => {
  it('matches web simulator values for salary + vale scenario', () => {
    const result = calculateFinancials(13571.43, false, true, 'percentage', 40, []);

    expect(result.grossSalary).toBe(13571.43);
    expect(result.inss).toBe(951.63);
    expect(result.irrf).toBe(2561.72);
    expect(result.advance).toBe(5428.57);
    expect(result.netSalary).toBe(4629.51);
  });

  it('zeros INSS and IRRF when salary is exempt', () => {
    const result = calculateFinancials(10000, true, true, 'percentage', 40, []);

    expect(result.inss).toBe(0);
    expect(result.irrf).toBe(0);
    expect(result.advance).toBe(4000);
    expect(result.netSalary).toBe(6000);
  });
});
