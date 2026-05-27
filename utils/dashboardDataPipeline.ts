export type DashboardLoadTrigger = 'initial' | 'month_change' | 'refresh';

interface DashboardLoadPlanInput {
  trigger: DashboardLoadTrigger;
  hasUser: boolean;
  hasInitialLoad: boolean;
  lastMonthKeyLoaded: string | null;
  selectedMonthKey: string;
}

export interface DashboardLoadPlan {
  fetchMonthScopedData: boolean;
  fetchCreditOverviewData: boolean;
  updateLastMonthKey: string | null;
  markInitialLoad: boolean;
}

const EMPTY_PLAN: DashboardLoadPlan = {
  fetchMonthScopedData: false,
  fetchCreditOverviewData: false,
  updateLastMonthKey: null,
  markInitialLoad: false,
};

export const getDashboardLoadPlan = ({
  trigger,
  hasUser,
  hasInitialLoad,
  lastMonthKeyLoaded,
  selectedMonthKey,
}: DashboardLoadPlanInput): DashboardLoadPlan => {
  if (!hasUser) {
    return EMPTY_PLAN;
  }

  if (trigger === 'initial') {
    if (hasInitialLoad && lastMonthKeyLoaded === selectedMonthKey) {
      return EMPTY_PLAN;
    }

    return {
      fetchMonthScopedData: lastMonthKeyLoaded !== selectedMonthKey,
      fetchCreditOverviewData: !hasInitialLoad,
      updateLastMonthKey: selectedMonthKey,
      markInitialLoad: !hasInitialLoad,
    };
  }

  if (trigger === 'refresh') {
    return {
      fetchMonthScopedData: true,
      fetchCreditOverviewData: true,
      updateLastMonthKey: selectedMonthKey,
      markInitialLoad: false,
    };
  }

  if (!hasInitialLoad || lastMonthKeyLoaded === selectedMonthKey) {
    return EMPTY_PLAN;
  }

  return {
    fetchMonthScopedData: true,
    fetchCreditOverviewData: false,
    updateLastMonthKey: selectedMonthKey,
    markInitialLoad: false,
  };
};
