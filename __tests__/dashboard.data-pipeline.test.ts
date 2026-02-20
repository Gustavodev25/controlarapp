import { getDashboardLoadPlan } from '../utils/dashboardDataPipeline';

describe('dashboard data pipeline plan', () => {
  it('initial trigger fetches month data and credit overview', () => {
    const plan = getDashboardLoadPlan({
      trigger: 'initial',
      hasUser: true,
      hasInitialLoad: false,
      lastMonthKeyLoaded: null,
      selectedMonthKey: '2026-02',
    });

    expect(plan.fetchMonthScopedData).toBe(true);
    expect(plan.fetchCreditOverviewData).toBe(true);
    expect(plan.markInitialLoad).toBe(true);
    expect(plan.updateLastMonthKey).toBe('2026-02');
  });

  it('month change does not trigger heavy credit overview recompute', () => {
    const plan = getDashboardLoadPlan({
      trigger: 'month_change',
      hasUser: true,
      hasInitialLoad: true,
      lastMonthKeyLoaded: '2026-01',
      selectedMonthKey: '2026-02',
    });

    expect(plan.fetchMonthScopedData).toBe(true);
    expect(plan.fetchCreditOverviewData).toBe(false);
    expect(plan.updateLastMonthKey).toBe('2026-02');
  });

  it('month change is a no-op when the same month is already loaded', () => {
    const plan = getDashboardLoadPlan({
      trigger: 'month_change',
      hasUser: true,
      hasInitialLoad: true,
      lastMonthKeyLoaded: '2026-02',
      selectedMonthKey: '2026-02',
    });

    expect(plan.fetchMonthScopedData).toBe(false);
    expect(plan.fetchCreditOverviewData).toBe(false);
  });

  it('refresh trigger fetches both pipelines', () => {
    const plan = getDashboardLoadPlan({
      trigger: 'refresh',
      hasUser: true,
      hasInitialLoad: true,
      lastMonthKeyLoaded: '2026-01',
      selectedMonthKey: '2026-02',
    });

    expect(plan.fetchMonthScopedData).toBe(true);
    expect(plan.fetchCreditOverviewData).toBe(true);
    expect(plan.markInitialLoad).toBe(false);
  });
});
