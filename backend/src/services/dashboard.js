export const buildDashboardResponse = (store) => {
  const { customers, routers, mpesaTransactions, revenueData } = store;
  return {
    stats: {
      activeCustomers: customers.filter((customer) => customer.status === "active").length,
      totalRevenue: customers.reduce((sum, customer) => sum + Number(customer.monthlyFee || 0), 0),
      onlineRouters: routers.filter((router) => router.status === "online").length,
      totalRouters: routers.length,
      pendingPayments: customers.filter((customer) => Number(customer.balance || 0) > 0).length,
      outstandingBalance: customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0),
      hasRouterWarning: routers.some((router) => router.status === "warning"),
    },
    revenueData,
    recentTransactions: [...mpesaTransactions].slice(0, 4),
  };
};

export const updateRevenueForCurrentMonth = (store, amount, isCollected) => {
  const currentMonth = new Date().toLocaleString("en-US", { month: "short" });
  let monthEntry = store.revenueData.find((row) => row.month === currentMonth);
  if (!monthEntry) {
    monthEntry = { month: currentMonth, revenue: 0, collected: 0 };
    store.revenueData.push(monthEntry);
  }

  monthEntry.revenue += amount;
  if (isCollected) {
    monthEntry.collected += amount;
  }
};
