# 🔐 API Documentation - Password Reset

## Base URL

```
Backend: http://localhost:5000/api
Production: [Your production URL]/api
```

---

## 1️⃣ Forgot Password - שליחת אימייל איפוס

### Endpoint

```
POST /auth/forgotpassword
```

### Request Body

```json
{
  "email": "user@example.com"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "נשלח אימייל לאיפוס סיסמה"
}
```

### Error Response (404)

```json
{
  "success": false,
  "message": "לא נמצא משתמש עם כתובת אימייל זו"
}
```

### Example Code (React/Axios)

```javascript
const forgotPassword = async (email) => {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/auth/forgotpassword",
      { email },
    );

    if (response.data.success) {
      alert("נשלח אימייל לאיפוס סיסמה!");
      // הצג הודעת הצלחה למשתמש
    }
  } catch (error) {
    console.error("Error:", error.response?.data?.message);
    alert(error.response?.data?.message || "שגיאה בשליחת האימייל");
  }
};
```

### Example Code (Fetch)

```javascript
const forgotPassword = async (email) => {
  try {
    const response = await fetch(
      "http://localhost:5000/api/auth/forgotpassword",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      },
    );

    const data = await response.json();

    if (data.success) {
      alert("נשלח אימייל לאיפוס סיסמה!");
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("שגיאה בשליחת האימייל");
  }
};
```

---

## 2️⃣ Reset Password - איפוס סיסמה עם טוקן

### Endpoint

```
PUT /auth/resetpassword/:resettoken
```

### URL Parameters

- `resettoken` - הטוקן שנשלח באימייל

### Request Body

```json
{
  "password": "newPassword123"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "הסיסמה אופסה בהצלחה",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Response (400)

```json
{
  "success": false,
  "message": "טוקן לא תקף או פג תוקף"
}
```

### Example Code (React/Axios)

```javascript
const resetPassword = async (resetToken, newPassword) => {
  try {
    const response = await axios.put(
      `http://localhost:5000/api/auth/resetpassword/${resetToken}`,
      { password: newPassword },
    );

    if (response.data.success) {
      // שמור את ה-JWT החדש
      localStorage.setItem("token", response.data.token);

      alert("הסיסמה אופסה בהצלחה!");
      // הפנה למסך הראשי או דשבורד
      navigate("/dashboard");
    }
  } catch (error) {
    console.error("Error:", error.response?.data?.message);
    alert(error.response?.data?.message || "שגיאה באיפוס הסיסמה");
  }
};
```

### Example Code (Fetch)

```javascript
const resetPassword = async (resetToken, newPassword) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/auth/resetpassword/${resetToken}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: newPassword }),
      },
    );

    const data = await response.json();

    if (data.success) {
      // שמור את ה-JWT החדש
      localStorage.setItem("token", data.token);

      alert("הסיסמה אופסה בהצלחה!");
      // הפנה למסך הראשי
      window.location.href = "/dashboard";
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("שגיאה באיפוס הסיסמה");
  }
};
```

---

## 📋 Flow מלא

### 1. דף Forgot Password

```javascript
// ForgotPasswordPage.jsx
import { useState } from "react";
import axios from "axios";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/forgotpassword",
        { email },
      );

      if (response.data.success) {
        setMessage("נשלח אימייל לאיפוס סיסמה! בדוק את תיבת הדואר שלך.");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "שגיאה בשליחת האימייל");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>שכחת סיסמה?</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "שולח..." : "שלח קישור לאיפוס"}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ForgotPasswordPage;
```

### 2. דף Reset Password

```javascript
// ResetPasswordPage.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const ResetPasswordPage = () => {
  const { token } = useParams(); // קח את הטוקן מה-URL
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("הסיסמאות לא תואמות");
      return;
    }

    if (password.length < 6) {
      setMessage("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.put(
        `http://localhost:5000/api/auth/resetpassword/${token}`,
        { password },
      );

      if (response.data.success) {
        // שמור את הטוקן החדש
        localStorage.setItem("token", response.data.token);

        setMessage("הסיסמה אופסה בהצלחה!");

        // הפנה לדשבורד אחרי 2 שניות
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "שגיאה באיפוס הסיסמה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>איפוס סיסמה</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="סיסמה חדשה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="אימות סיסמה"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" disabled={loading}>
          {loading ? "מאפס..." : "איפוס סיסמה"}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ResetPasswordPage;
```

### 3. Routes Configuration

```javascript
// App.jsx או Router.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... שאר ה-routes */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## ⚠️ Important Notes

### 1. **Token Expiration**

- הטוקן תקף ל-**10 דקות בלבד**
- אחרי 10 דקות המשתמש יצטרך לבקש טוקן חדש

### 2. **Email Link Format**

האימייל שנשלח למשתמש מכיל קישור בפורמט:

```
http://www.shamayim-vaaretz.co.il/reset-password/abc123token456
```

הקישור הזה צריך להוביל לדף Reset Password שלך שיקח את הטוקן מה-URL.

### 3. **Error Handling**

וודא שאתה מטפל בכל השגיאות האפשריות:

- ✅ אימייל לא קיים במערכת
- ✅ טוקן לא תקף
- ✅ טוקן פג תוקף
- ✅ סיסמה חלשה מדי
- ✅ בעיות רשת

### 4. **Security**

- 🔒 אל תחשוף את הטוקן בלוגים
- 🔒 השתמש ב-HTTPS בפרודקשן
- 🔒 ודא שהסיסמה החדשה חזקה מספיק

---

## 🐛 Troubleshooting

### השגיאה "next is not a function"

זו שגיאה בקוד React, לא בבקאנד. וודא ש:

1. אין שימוש ב-`next()` בקוד הפרונט
2. React Router מעודכן לגרסה אחרונה
3. אין confusion בין middleware של Express לקוד React

### בדיקת Endpoint

אפשר לבדוק ישירות עם curl:

```bash
# Forgot Password
curl -X POST http://localhost:5000/api/auth/forgotpassword \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Reset Password
curl -X PUT http://localhost:5000/api/auth/resetpassword/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"password":"newPassword123"}'
```

---

## 📞 Support

אם יש בעיות, בדוק:

1. ✅ השרת רץ על http://localhost:5000
2. ✅ MongoDB מחובר בהצלחה
3. ✅ Gmail SMTP מוגדר נכון
4. ✅ CORS מאפשר בקשות מהפרונט

---

**Created:** January 2026  
**Backend URL:** http://localhost:5000  
**Production Frontend:** http://www.shamayim-vaaretz.co.il
