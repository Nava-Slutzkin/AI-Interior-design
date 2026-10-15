export const calculateEstimatedBudget = (items = []) => items.reduce(
    (total, item) => total + Number(item.price || 0),
    0
);

export const getRequestUserId = (req) => req.userId || req.user?._id;