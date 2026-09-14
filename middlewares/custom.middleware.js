const fs = require('fs');
const path = require('path');

/**
 *  Middleware Creator: חסימת גישה לפי ימים בשבוע (Schedule Blocker)
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


/** 
 *  Middleware Creator: חסימת כתובות IP מסוימות (IP Blocker)
 * מקבל מערך של כתובות IP חסומות ומונע מהן גישה לשרת.
 */
const createIpBlocker = (blockedIps = [], options = {}) => {
  return (req, res, next) => {
    // קבלת כתובת ה-IP של הלקוח מתוך ה-Headers או מתוך ה-Socket
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (blockedIps.includes(clientIp)) {
      return res.status(403).json({
        status: 'error',
        message: options.message || 'הגישה מכתובת ה-IP שלך נחסמה.'
      });
    }

    next();
  };
};

module.exports = {
  createScheduleBlocker,
  createIpBlocker
};