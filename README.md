# AI Home Designer

מערכת לתכנון רעיונות לעיצוב פנים בעזרת בינה מלאכותית. המשתמש בוחר סוג חלל וסגנון, מוסיף תקציב ותיאור, ובמידת הצורך מצרף תמונת השראה או שמע. השרת מייצר הצעת עיצוב ורשימת פריטים, שומר אותן בחשבון ומאפשר לנהל אותן בהמשך.

הממשק והשרת נמצאים בשתי תיקיות נפרדות:

- `פרויקט גמר לקוח` – ממשק דפדפן סטטי (HTML, CSS ו-JavaScript).
- `פרויקט גמר` – שרת REST מבוסס Node.js ו-Express, מסד נתונים MongoDB וחיבור לספק AI תואם OpenAI.

## יכולות

- הרשמה והתחברות עם אימות משתמש והרשאות.
- יצירת הצעת עיצוב לפי סוג חלל, סגנון, תקציב ותיאור.
- צירוף תמונת השראה או קובץ שמע/הקלטה לבקשת העיצוב, בהתאם ליכולות מודל ה-AI שהוגדר.
- בחירת תמונות השראה מתוך `public/room-images` לפי סוג החלל.
- צפייה, עדכון ומחיקה של הדמיות ורשימת פריטים.
- לוח משתמש ולוח מנהל עם ניהול משתמשים והדמיות ונתוני מערכת.

## דרישות מוקדמות

- Node.js ו-npm.
- MongoDB זמין, מקומי או בענן, וכתובת חיבור תקינה.
- מפתח API מספק תואם OpenAI, כגון OpenRouter, עבור יצירת עיצובים.
- VS Code עם Live Server או שרת סטטי אחר להגשת קובצי הלקוח.

## התקנה והפעלה

### 1. הגדרת השרת

פתחו טרמינל בתיקיית `פרויקט גמר` והתקינו תלויות:

```bash
npm install
```

צרו קובץ `.env` בתיקייה זו. לדוגמה:

```dotenv
PORT=1000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/ai-home-designer
JWT_SECRET=replace-with-a-long-random-secret
OPENROUTER_API_KEY=replace-with-your-provider-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemini-2.0-flash-exp:free
AI_MULTIMODAL_MODEL=google/gemini-2.5-flash
APP_URL=http://localhost:5500
CLIENT_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

אפשר להשתמש ב-`OPENAI_API_KEY` במקום `OPENROUTER_API_KEY`, אם ספק ה-AI תומך בממשק OpenAI. ברירות המחדל למודלים ולכתובת OpenRouter מוגדרות בקוד; יש לבחור מודלים שהחשבון וספק ה-AI מאפשרים להשתמש בהם. מפתח AI נדרש ליצירת עיצוב, אך לא להפעלת השרת עצמו.

התחילו את השרת:

```bash
npm run dev
```

הפקודה `npm start` מפעילה את השרת ללא nodemon. ברירת המחדל היא `http://localhost:1000`. השרת מתחבר ל-MongoDB לפני שהוא מתחיל להאזין לבקשות.

### 2. הגשת ממשק הלקוח

פתחו את התיקייה `פרויקט גמר לקוח` ב-VS Code, הפעילו Live Server על `index.html` והיכנסו לכתובת שהשרת המקומי מציג. קובץ הכניסה מפנה אוטומטית לעמוד ההתחברות.

הלקוח בונה את כתובת ה-API לפי שם המחשב בפורט `1000`. לכן יש להגיש את האתר דרך `localhost` או `127.0.0.1` ולהשתמש בפורט `5500` המותר כברירת מחדל ב-CORS. אם משתמשים בכתובת או בפורט אחרים, הוסיפו את מקור האתר ל-`CLIENT_ORIGINS` והפעילו מחדש את השרת. אם משנים את פורט השרת, יש לעדכן גם את `API_BASE_URL` בקובצי הלקוח `features/auth/auth.js` ו-`features/auth/session.js`.

### 3. הוספת תמונות חדרים

שמרו תמונות `.jpg`, `.jpeg`, `.png`, `.webp` או `.gif` בתיקיות תחת `פרויקט גמר/public/room-images`. שם כל תיקייה צריך להתאים לערך של סוג החלל בטופס, לדוגמה `סלון` או `חדר שינה`. התמונות מוגשות דרך `/room-images`.

## משתני סביבה

| משתנה | נדרש | תיאור |
| --- | --- | --- |
| `MONGODB_URI` | כן | כתובת חיבור למסד MongoDB; משמשת גם לאחסון הפעלות (sessions). |
| `JWT_SECRET` | כן | סוד לחתימה ולאימות של אסימוני JWT, וגם לסשן של Express. |
| `OPENAI_API_KEY` או `OPENROUTER_API_KEY` | ליצירת עיצובים | מפתח API של ספק AI תואם OpenAI. |
| `PORT` | לא | פורט השרת; ברירת מחדל `1000`. |
| `NODE_ENV` | לא | בסביבת `production` עוגיית הסשן מסומנת `secure`. |
| `CLIENT_ORIGINS` | לא | מקורות נוספים המותרים ב-CORS, מופרדים בפסיקים. |
| `OPENAI_BASE_URL` | לא | כתובת API תואמת OpenAI; ברירת מחדל `https://openrouter.ai/api/v1`. |
| `AI_MODEL` | לא | מודל לטקסט; ברירת מחדל `google/gemini-2.0-flash-exp:free`. |
| `AI_MULTIMODAL_MODEL` | לא | מודל לבקשות עם קובצי מדיה; ברירת מחדל `google/gemini-2.5-flash`. |
| `APP_URL` | לא | נשלח בכותרת `HTTP-Referer` לספק AI. |
| `ROOM_IMAGES_DIR` | לא | נתיב חלופי לתיקיית תמונות החדרים. |
| `ADMIN1_EMAIL`, `ADMIN2_EMAIL` | לא | כתובות מנהלים מאושרות המשמשות לקביעת תפקיד בעת הרשמה/התחברות. |

יש ליצור `JWT_SECRET` ארוך ואקראי. אין להעלות את `.env` או מפתחות סודיים למאגר Git.

## מבנה הפרויקט

```text
פרויקט גמר/
  controllers/       לוגיקת API לאימות, הדמיות וניהול
  middlewares/       אימות והרשאות, בקרות ולוג שגיאות
  models/            סכמות MongoDB למשתמשים ולהדמיות
  public/room-images תמונות השראה המחולקות לפי סוג חלל
  routers/           נתיבי API
  scripts/           סקריפטים עזר
  server.js          אתחול Express וחיבור MongoDB
  package.json       תלויות ופקודות npm

פרויקט גמר לקוח/
  index.html         נקודת כניסה והפניה להתחברות
  features/auth/     הרשמה, התחברות וניהול session בצד הלקוח
  features/home/     טופס בקשת עיצוב
  features/form-wizard/אשף הפרטים
  features/result/   הצגת תוצאות העיצוב
  features/client-dashboard/  הדמיות המשתמש
  features/admin-dashboard/   ממשק ניהול
  features/design-system.css  סגנונות משותפים
```

## API עיקרי

כתובת הבסיס המקומית: `http://localhost:1000/api`. רוב הנתיבים דורשים כותרת `Authorization: Bearer <token>`.

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| `POST` | `/auth/register` | הרשמת משתמש. |
| `POST` | `/auth/login` | התחברות וקבלת אסימון. |
| `GET` | `/auth/me` | פרטי המשתמש המחובר. |
| `POST` | `/auth/logout` | יציאה בצד הלקוח/שרת. |
| `POST` | `/renders` | יצירת הצעת עיצוב. |
| `GET` | `/renders` | קבלת ההדמיות של המשתמש. |
| `GET` | `/renders/images?roomType=סלון` | קבלת תמונות השראה לסוג חלל. |
| `GET`, `PUT`, `DELETE` | `/renders/:id` | צפייה, עדכון או מחיקת הדמיה. |
| `GET` | `/admin/users` | רשימת משתמשים למנהל. |
| `PUT`, `DELETE` | `/admin/users/:id` | עדכון תפקיד או מחיקת משתמש. |
| `GET`, `DELETE` | `/admin/renders` ו-`/admin/renders/:id` | ניהול הדמיות למנהל. |
| `GET` | `/admin/stats` | נתוני מערכת למנהל. |

## אבטחה והרשאות

- סיסמאות נשמרות לאחר גיבוב באמצעות bcrypt.
- נתיבים מוגנים דורשים JWT; פעולות ניהול מוגבלות למנהלים.
- כתובות ה-URL שניתן להירשם בהן כמנהל מוגדרות באמצעות `ADMIN1_EMAIL` ו-`ADMIN2_EMAIL`.
- `scripts/generate-admin-code.js` יוצר ערך `ADMIN_REGISTRATION_CODE` בקובץ `.env`, אך קוד ההרשמה הנוכחי אינו קורא משתנה זה; יצירת הקוד לבדה אינה מפעילה הרשמת מנהל.

## בדיקות ותקלות נפוצות

ב-`package.json` לא מוגדר כרגע סקריפט בדיקות אוטומטיות. אם השרת לא עולה, ודאו ש-MongoDB פעיל ושהערכים `MONGODB_URI` ו-`JWT_SECRET` מוגדרים. אם הדפדפן מדווח על שגיאת CORS, בדקו שהלקוח נפתח בכתובת ובפורט המותרים ושאותו מקור מופיע ב-`CLIENT_ORIGINS`.