export const STATUS_TONE = {
  draft: 'gray',
  scheduled: 'blue',
  published: 'green',
  active: 'amber',
  completed: 'purple',
  cancelled: 'red',
};

export const EXAM_TRANSITIONS = {
  draft: ['scheduled', 'published', 'cancelled'],
  scheduled: ['published', 'draft', 'cancelled'],
  published: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['draft'],
};
