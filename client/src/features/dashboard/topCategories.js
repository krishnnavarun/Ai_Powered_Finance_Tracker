const TOP = 5;

// Keeps the list short: the biggest 5 categories, then everything else as "Other".
export function topCategories(categories) {
  if (categories.length <= TOP + 1) return categories;
  const rest = categories.slice(TOP);
  return [
    ...categories.slice(0, TOP),
    {
      categoryId: 'other',
      name: `Other (${rest.length})`,
      icon: 'circle-ellipsis',
      total: rest.reduce((sum, c) => sum + c.total, 0),
      percent: Math.round(rest.reduce((sum, c) => sum + c.percent, 0) * 10) / 10,
    },
  ];
}
