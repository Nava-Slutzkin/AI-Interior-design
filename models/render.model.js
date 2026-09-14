// מייבא את Mongoose כדי להגדיר את הסכמה למסד הנתונים
const mongoose = require('mongoose');

// סכמה פנימית עבור פריט ברשימת הקניות (רהיטים/אקססוריז)
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  link: {
    type: String,
    trim: true
  }
});

// סכמה ראשית עבור הדמיה
const renderSchema = new mongoose.Schema(
  {
    // קישור למשתמש שיצר את ההדמיה (עבור דף לקוח)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // --- קלטי המשתמש (דף בית / דף ביניים) ---
    promptText: {
      type: String,
      trim: true
    },
    uploadedImage: {
      type: String // URL של התמונה שהעלה המשתמש
    },
    audioUrl: {
      type: String // URL של הקלטת הקול
    },
    formDetails: {
      roomType: { type: String, trim: true }, // למשל: סלון, חדר שינה
      style: { type: String, trim: true },    // למשל: מודרני, כפרי (חשוב לסטטיסטיקות מנהל!)
      budget: { type: Number, default: 0 },   // תקציב מבוקש (חשוב לסטטיסטיקות מנהל!)
      dimensions: { type: String, trim: true } // מידות החדר
    },

    // --- תוצאות ה-AI (דף תוצאה) ---
    resultImage: {
      type: String,
      required: true // URL של תמונת ההדמיה שג'ונרטה
    },
    items: [itemSchema], // רשימת הרהיטים והאקססוריז (ניתן להוסיף/למחוק/לעדכן)

    // --- מצב שמירה וניהול ---
    isSaved: {
      type: Boolean,
      default: true // האם שמור באוסף ההדמיות של הלקוח
    }
  },
  {
    // מוסיף אוטומטית שדות createdAt ו-updatedAt
    // חיוני עבור הגרפים של המנהל (סה"כ הדמיות לפי חודשים)
    timestamps: true 
  }
);

// יצירת אינדקס לשיפור ביצועי שליפה לפי משתמש
renderSchema.index({ userId: 1, createdAt: -1 });

const Render = mongoose.model('Render', renderSchema);

module.exports = Render;
