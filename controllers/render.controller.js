// מייבא את המודל של Render כדי לשוחח עם MongoDB
const Render = require('../models/render.model');

// פונקציה לעדכון רשומת Render לפי מזהה
exports.updateRender = async (req, res) => {
  // מקבל את ה-id מה-URL, למשל /api/renders/123 => id = 123
  const { id } = req.params;

  // מקבל את השדה items מתוך גוף הבקשה; אם לא קיים, נשתמש במערך ריק
  const { items = [] } = req.body;

  try {
    // מחפש רשומה לפי id ומעדכן רק את השדה items
    // new: true => מחזיר את הרשומה המעודכנת
    // runValidators: true => בודק שהערכים עומדים בתנאי schema
    const updatedRender = await Render.findByIdAndUpdate(
      id,
      { items },
      { new: true, runValidators: true }
    );

    // אם לא נמצאה רשומה עם ה-id הזה, מחזיר 404
    if (!updatedRender) {
      return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
    }

    // אם העדכון הצליח, מחזיר את המזהה ואת המערך המעודכן
    return res.status(200).json({
      id: updatedRender._id,
      items: updatedRender.items
    });
  } catch (error) {
    // אם קרתה שגיאה בזמן העדכון, מחזיר 500 ובשגיאה
    return res.status(500).json({ message: 'שגיאת שרת בעדכון ההדמיה', error: error.message });
  }
};


// פונקציה למחיקת Render לפי מזהה, עם בדיקת הרשאות
exports.deleteRender = async (req, res) => {

    // לוקח את ה-id מה-URL, למשל DELETE /api/renders/123
    const { id } = req.params;

    try {
        // מחפש את ההדמיה לפי ה-id
        const render = await Render.findById(id);

        // אם ההדמיה לא קיימת, מחזיר 404
        if (!render) {
            return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
        }

        // בודק אם המשתמש הוא admin או הבעלים של ההדמיה
        const isAdmin = req.user && req.user.role === 'Admin';
        const isOwner = req.user && render.userId && render.userId.toString() === req.user._id.toString();

        // אם המשתמש לא admin וגם לא הבעלים, אין לו הרשאה למחוק
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'אין לך הרשאה למחוק הדמיה זו' });
        }

        // מוחק את ההדמיה מהמסד
        await Render.findByIdAndDelete(id);

        // מחזיר הודעת הצלחה
        return res.status(200).json({ message: 'ההדמיה נמחקה בהצלחה' });
    }

    catch (error) {
        // אם קרתה שגיאה, מחזיר 500 עם פרטי השגיאה
        res.status(500).json({ message: 'שגיאת שרת במחיקת ההדמיה', error: error.message });
    }
}


