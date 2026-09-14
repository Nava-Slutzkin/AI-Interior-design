const fs = require('fs');
const path = require('path');

/**
 * 1. Middleware Creator: חסימת גישה לפי ימים בשבוע (Schedule Blocker)
 * כברירת מחדל חוסם את יום שבת (יום 6 בשבוע, כאשר 0 = ראשון, 6 = שבת).
 */
const createScheduleBlocker = (blockedDays = [6], options = {}) => {
  return (req, res, next) => {
    // קבלת היום הנוכחי בשבוע (0-6)
    const currentDay = new Date().getDay();
    
    // בדיקה האם היום הנוכחי מוכל ברשימת הימים החסומים
    if (blockedDays.includes(currentDay)) {
      return res.status(503).json({
        status: 'error',
        message: options.message || 'האתר אינו פעיל כעת לפי לוח הזמנים המוגדר.'
      });
    }
    
    next();
  };
};

moudule.exports = {
  createScheduleBlocker
};