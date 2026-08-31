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


