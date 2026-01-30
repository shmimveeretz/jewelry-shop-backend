# 📊 Data Flow - Backend ↔ Frontend

## 1️⃣ forgotPassword - שליחת קוד

### Backend Response
```json
{
  "success": true,
  "message": "נשלח אימייל עם קוד אימות וקישור Magic Link עם QR Code"
}
```

### Frontend - מה לעשות:
```javascript
const handleForgotPassword = async (email) => {
  try {
    const response = await axios.post('/api/auth/forgotpassword', { email });
    
    if (response.data.success) {
      // ✅ קוד נשלח - הצג הודעה וגייד למשתמש
      alert(response.data.message);
      console.log('📧 Email sent to:', email);
      
      // עבור לעמוד VerifyCode
      navigate('/verify-code', { state: { email } });
    }
  } catch (error) {
    alert(error.response?.data?.message);
  }
};
```

---

## 2️⃣ verifyCode - אימות קוד 6-ספרות

### Backend Request
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

### Backend Response ✅
```json
{
  "success": true,
  "message": "קוד אומת בהצלחה",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3OGFiYzEyMzQ1ZCIsImlhdCI6MTcwNjYwMDAwMCwiZXhwIjoxNzA2NjAwMDAwfQ.abc123...",
  "email": "user@example.com"
}
```

### Frontend - מה לעשות:
```javascript
const handleVerifyCode = async (email, code) => {
  try {
    const response = await axios.post('/api/auth/verifycode', {
      email: email,
      code: code
    });

    if (response.data.success) {
      console.log('✅ Code verified!');
      console.log('Token:', response.data.resetToken);
      console.log('Email:', response.data.email);
      
      // 🎯 שמור את המידע ב-localStorage
      localStorage.setItem('resetToken', response.data.resetToken);
      localStorage.setItem('resetEmail', response.data.email);
      
      // הצג הודעה
      alert(response.data.message);
      
      // 🎯 עבור לעמוד changePassword
      navigate('/change-password');
    }
  } catch (error) {
    console.error('Error:', error.response?.data);
    alert(error.response?.data?.message);
  }
};
```

---

## 3️⃣ changePassword - שינוי סיסמה

### Backend Request
```json
{
  "email": "user@example.com",
  "newPassword": "newPassword123",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Backend Response ✅
```json
{
  "success": true,
  "message": "הסיסמה שונתה בהצלחה",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3OGFiYzEyMzQ1ZCIsImlhdCI6MTcwNjYwMDAwMCwiZXhwIjoxNzA2NjAwMDAwfQ.xyz789...",
  "user": {
    "id": "678abc123456d",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

### Frontend - מה לעשות:
```javascript
const handleChangePassword = async (newPassword) => {
  try {
    const response = await axios.post('/api/auth/changepassword', {
      email: localStorage.getItem('resetEmail'),
      newPassword: newPassword,
      resetToken: localStorage.getItem('resetToken')
    });

    if (response.data.success) {
      console.log('✅ Password changed!');
      
      // 🎉 קבל את הנתונים החדשים
      const { token, user } = response.data;
      console.log('New Token:', token);
      console.log('User ID:', user.id);
      console.log('User Email:', user.email);
      console.log('User Name:', user.fullName);
      
      // 🔐 שמור את ה-token החדש
      localStorage.setItem('jwtToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // נקה את קודי האיפוס
      localStorage.removeItem('resetToken');
      localStorage.removeItem('resetEmail');
      
      alert('🎉 ' + response.data.message);
      
      // חזור לlogin או לעמוד הבית
      navigate('/login');
    }
  } catch (error) {
    console.error('Error:', error.response?.data);
    alert(error.response?.data?.message);
  }
};
```

---

## 📦 localStorage Keys

| Key | Value | שימוש | זמן חיים |
|-----|-------|--------|---------|
| `resetToken` | JWT token | להפעלת changePassword | עד changePassword |
| `resetEmail` | User email | להפעלת changePassword | עד changePassword |
| `jwtToken` | JWT token | Authentication בBrowser | עד logout |
| `user` | JSON user object | Display user info | עד logout |

---

## 🔄 Complete Frontend Flow

```javascript
// 🎬 Step 1: ForgotPassword.jsx
async function handleForgotPassword(email) {
  const response = await axios.post('/api/auth/forgotpassword', { email });
  // Response: { success, message }
  // ↓
  navigate('/verify-code', { state: { email } });
}

// 📝 Step 2: VerifyCode.jsx
async function handleVerifyCode(email, code) {
  const response = await axios.post('/api/auth/verifycode', { email, code });
  // Response: { success, message, resetToken, email }
  // ↓
  localStorage.setItem('resetToken', response.data.resetToken);
  localStorage.setItem('resetEmail', response.data.email);
  // ↓
  navigate('/change-password');
}

// 🔐 Step 3: ChangePassword.jsx
async function handleChangePassword(newPassword) {
  const response = await axios.post('/api/auth/changepassword', {
    email: localStorage.getItem('resetEmail'),
    newPassword: newPassword,
    resetToken: localStorage.getItem('resetToken')
  });
  // Response: { success, message, token, user }
  // ↓
  localStorage.setItem('jwtToken', response.data.token);
  localStorage.setItem('user', JSON.stringify(response.data.user));
  // ↓
  navigate('/login');
}
```

---

## 🎯 Useful Data Points

### From verifyCode
- `resetToken` - טוקן זמני לצעד הבא (שמור ב-localStorage)
- `email` - כתובת המייל של המשתמש (שמור ב-localStorage)

### From changePassword
- `token` - JWT token חדש (שמור ב-localStorage עבור Authentication)
- `user.id` - ID ייחודי של המשתמש
- `user.email` - כתובת המייל
- `user.fullName` - שם המשתמש המלא

---

## 💾 Best Practice - Context API / Zustand

אם אתה משתמש ב-Context API או Zustand:

```javascript
// useAuthStore.js (Zustand example)
import create from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  resetToken: null,
  resetEmail: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setResetToken: (resetToken) => set({ resetToken }),
  setResetEmail: (resetEmail) => set({ resetEmail }),

  clearReset: () => set({ resetToken: null, resetEmail: null }),
  logout: () => set({ user: null, token: null }),
}));
```

שימוש:
```javascript
const { setResetToken, setResetEmail } = useAuthStore();

// ב-VerifyCode.jsx
setResetToken(response.data.resetToken);
setResetEmail(response.data.email);
```

---

**Created:** January 30, 2026
