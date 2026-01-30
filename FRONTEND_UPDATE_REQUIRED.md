# 🔄 עדכונים נדרשים בפרונט-אנד

## תאריך: 20 ינואר 2026

---

## ✅ מה השתנה בבקאנד

### 1. **שדה `name` שונה ל-`fullName`**

#### ב-Register:

**לפני:**

```javascript
{
  name: "ישראל ישראלי",
  email: "...",
  password: "..."
}
```

**עכשיו:**

```javascript
{
  fullName: "ישראל ישראלי",
  email: "...",
  password: "..."
}
```

#### התגובה מהשרת:

**לפני:**

```javascript
{
  success: true,
  data: {
    id: "...",
    name: "ישראל ישראלי",  // ❌ השתנה
    email: "...",
    role: "user"  // ❌ השתנה
  }
}
```

**עכשיו:**

```javascript
{
  success: true,
  message: "משתמש נוצר בהצלחה",
  token: "...",
  data: {
    id: "...",
    fullName: "ישראל ישראלי",  // ✅ שם חדש
    email: "...",
    role: "customer"  // ✅ ערך חדש
  }
}
```

---

### 2. **שדה `role` שונה מ-`"user"` ל-`"customer"`**

**ערכים אפשריים:**

- ✅ `"customer"` - משתמש רגיל (ברירת מחדל)
- ✅ `"admin"` - אדמין
- ⚠️ `"user"` - עדיין נתמך (משתמשים ישנים) אבל לא ייווצר חדש

---

### 3. **התווספו Forgot/Reset Password Endpoints**

אלה כבר קיימים בקובץ `FRONTEND_PASSWORD_RESET_API.md` - לא צריך שינויים נוספים!

---

## 🔧 מה צריך לשנות בפרונט

### קובץ 1: `Register Component`

**מצא את:**

```javascript
const handleRegister = async (formData) => {
  const response = await axios.post("/api/auth/register", {
    name: formData.name, // ❌ שנה את זה
    email: formData.email,
    password: formData.password,
  });
};
```

**שנה ל:**

```javascript
const handleRegister = async (formData) => {
  const response = await axios.post("/api/auth/register", {
    fullName: formData.fullName, // ✅ שדה חדש
    email: formData.email,
    password: formData.password,
    phone: formData.phone, // אופציונלי
  });

  // התגובה עכשיו כוללת:
  // response.data.token
  // response.data.message
  // response.data.data.fullName (לא name)
  // response.data.data.role === "customer"
};
```

---

### קובץ 2: `Login Component`

**בדוק את התגובה:**

```javascript
const handleLogin = async (email, password) => {
  const response = await axios.post("/api/auth/login", {
    email,
    password,
  });

  // התגובה עכשיו:
  const { token, message, data } = response.data;
  console.log(data.fullName); // ✅ לא data.name
  console.log(data.role); // "customer" או "admin"
};
```

---

### קובץ 3: `User Context / Store`

**אם יש לך state management:**

```javascript
// Redux / Context / Zustand
const [user, setUser] = useState({
  id: "",
  fullName: "", // ✅ שנה מ-name
  email: "",
  role: "customer", // ✅ שנה מ-user
});
```

---

### קובץ 4: `Profile / Dashboard Components`

**כל מקום שמציג את שם המשתמש:**

**לפני:**

```javascript
<h1>שלום {user.name}</h1>
```

**עכשיו:**

```javascript
<h1>שלום {user.fullName}</h1>
```

---

### קובץ 5: `Role Checking`

**לפני:**

```javascript
if (user.role === "user") {
  // ...
}
```

**עכשיו:**

```javascript
if (user.role === "customer") {
  // משתמש רגיל
} else if (user.role === "admin") {
  // אדמין
}
```

---

## 🔍 איך למצוא את כל המקומות לשינוי

### 1. חפש בכל הפרויקט:

```
Find: user.name
Replace with: user.fullName
```

```
Find: data.name
Replace with: data.fullName
```

```
Find: name:
Replace with: fullName:
```

### 2. חפש role checks:

```
Find: role === 'user'
Replace with: role === 'customer'
```

```
Find: role === "user"
Replace with: role === "customer"
```

---

## 📝 Checklist עדכונים

```
☐ שיניתי את שדה name ל-fullName בטופס Register
☐ עדכנתי את ה-state/context להשתמש ב-fullName
☐ שיניתי את כל התצוגות של user.name ל-user.fullName
☐ עדכנתי את בדיקות ה-role מ-"user" ל-"customer"
☐ בדקתי שה-Register עובד
☐ בדקתי שה-Login עובד
☐ בדקתי שהפרופיל מציג את השם נכון
☐ בדקתי שבדיקות הרשאות עובדות
☐ בדקתי forgot/reset password (אם הוספת)
```

---

## 🚨 תאימות לאחור

**הבקאנד תומך גם במשתמשים ישנים!**

משתמשים שנרשמו לפני העדכון יכולים עדיין:

- ✅ להתחבר בלי בעיות
- ✅ לעבוד עם role: "user"
- ✅ לעבוד עם name במקום fullName

אבל **משתמשים חדשים** יווצרו רק עם:

- ✅ fullName
- ✅ role: "customer"

---

## 💡 טיפ חשוב

אם יש לך TypeScript, עדכן את ה-interfaces:

```typescript
// לפני
interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

// עכשיו
interface User {
  id: string;
  fullName: string;
  email: string;
  role: "customer" | "admin";
  phone?: string;
}
```

---

## ❓ שאלות נפוצות

### Q: מה קורה למשתמשים הישנים?

**A:** הם ממשיכים לעבוד! הבקאנד תומך גם ב-`name` וגם ב-`fullName`.

### Q: צריך למחוק משתמשים ישנים?

**A:** לא! הם יעבדו בלי בעיות.

### Q: מה אם אני רוצה לשמור גם name וגם fullName?

**A:** אפשר, הבקאנד תומך בשניהם. פשוט שלח את שניהם בבקשה.

---

## 📞 בעיות?

אם משהו לא עובד:

1. בדוק את ה-Network tab בדפדפן
2. ראה מה הבקאנד מחזיר בדיוק
3. ודא שהשרת רץ עם הקוד המעודכן
4. נקה cache של הדפדפן

---

**עודכן:** 20/01/2026  
**גרסת Backend:** 2.0  
**שינויים:** name → fullName, user → customer
