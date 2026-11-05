export type DashboardData = {
  totalDestinations: number;
  visitedCount: number;
  averagePriority: number;
  categories: {
    categoryId: number | null;
    name: string;
    count: number;
  }[];
};
