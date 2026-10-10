const fs = require('fs');
const path = require('path');

/**
 *  Middleware Creator: חסימת גישה לפי ימים בשבוע (Schedule Blocker)
 * כברירת מחדל חוסם את יום שבת (יום 6 בשבוע, כאשר 0 = ראשון, 6 = שבת).
 */
const createScheduleBlocker = (blockedDays = [6], options = {}) => {
  return (req, res, next) => {
    const now = new Date();
    const timeZone = options.timeZone || 'Asia/Jerusalem';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const dayByName = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentDay = dayByName[values.weekday];
    const currentMinutes = Number(values.hour) * 60 + Number(values.minute);
    const reopenMinutes = Number(options.saturdayReopenHour ?? 24) * 60 + Number(options.saturdayReopenMinute ?? 0);
    const isWithinSaturdayClosure = currentDay === 6 && currentMinutes < reopenMinutes;

    if (blockedDays.includes(currentDay) && (currentDay !== 6 || isWithinSaturdayClosure)) {
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


/**
 *  Middleware Creator: לוגר שגיאות מותאם סביבה (Error Logger)
 * בסביבת פיתוח (development) - מדפיס את הפרטים המלאים לקונסול.
 * בסביבת ייצור (production) - כותב את הודעת השגיאה לקובץ לוג בשרת.
 */
const createErrorLogger = (options = {}) => {
  const logFilePath = options.logFilePath || path.join(__dirname, 'error.log');

  return (err, req, res, next) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${req.method} ${req.originalUrl} - ${err.stack || err.message}\n`;

    if (process.env.NODE_ENV === 'development') {
      console.error('=== [DEV ERROR LOG] ===');
      console.error(err);
    } else {
      // כתיבה אסינכרונית לקובץ לוג בסביבת Production
      fs.appendFile(logFilePath, logMessage, (fileErr) => {
        if (fileErr) {
          console.error('שגיאה בכתיבה לקובץ הלוג:', fileErr);
        }
      });
    }

    // החזרת תשובה ללקוח
    res.status(err.status || 500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'שגיאת שרת פנימית.'
    });
  };
};


module.exports = {
  createScheduleBlocker,
  createIpBlocker,
  createErrorLogger
};