# 🎨 Frontend Components - Password Reset Flow

## VerifyCode.jsx

```javascript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export const VerifyCode = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/verifycode', {
        email: email,
        code: code
      });

      if (response.data.success) {
        console.log('✅ Code verified!', response.data);
        
        // 🎯 שמור את resetToken בlocalStorage
        localStorage.setItem('resetToken', response.data.resetToken);
        localStorage.setItem('resetEmail', response.data.email);
        
        // 🎯 שמור את השם המלא
        localStorage.setItem('userName', response.data.fullName || '');
        
        // הצג הודעה
        alert('✅ קוד אומת בהצלחה!');
        
        // 🎯 עבור לעמוד changePassword
        navigate('/change-password');
      }
    } catch (error) {
      console.error('❌ Error:', error.response?.data);
      setError(error.response?.data?.message || 'שגיאה באימות הקוד');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>אימות קוד</h2>
      <p>הזן את קוד ה-6 ספרות ששלחנו לאימייל שלך</p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
        />

        <input
          type="text"
          placeholder="קוד 6 ספרות"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength="6"
          required
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            marginBottom: '10px',
            fontSize: '24px',
            textAlign: 'center',
            letterSpacing: '10px'
          }}
        />

        {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ מאמת...' : '✅ אימות קוד'}
        </button>
      </form>
    </div>
  );
};
```

---

## ChangePassword.jsx

```javascript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export const ChangePassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // בדוק שיש resetToken
    const token = localStorage.getItem('resetToken');
    const email = localStorage.getItem('resetEmail');
    const storedName = localStorage.getItem('userName');
    
    if (!token) {
      alert('❌ אין לך הרשאה לשינוי סיסמה');
      navigate('/forgot-password');
    }
    
    if (storedName) {
      setUserName(storedName);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // בדיקות בסיסיות
    if (newPassword.length < 6) {
      setError('הסיסמה חייבת להיות לפחות 6 תווים');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('הסיסמאות לא תואמות');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/auth/changepassword', {
        email: localStorage.getItem('resetEmail'),
        newPassword: newPassword,
        resetToken: localStorage.getItem('resetToken')
      });

      if (response.data.success) {
        console.log('✅ Password changed!', response.data);
        
        // 🎉 סיסמה שונתה בהצלחה!
        // שמור את השם המלא
        const userFullName = response.data.user?.fullName || 'משתמש';
        alert(`🎉 ברוכה הבאה ${userFullName}!\nהסיסמה שונתה בהצלחה!`);
        
        // נקה את localStorage
        localStorage.removeItem('resetToken');
        localStorage.removeItem('resetEmail');
        localStorage.removeItem('userName');
        
        // חזור לlogin
        navigate('/login');
      }
    } catch (error) {
      console.error('❌ Error:', error.response?.data);
      setError(error.response?.data?.message || 'שגיאה בשינוי סיסמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>🔐 שינוי סיסמה</h2>
      {userName && <p style={{ color: '#667eea', marginBottom: '20px' }}>👋 שלום {userName}!</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="סיסמה חדשה"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            marginBottom: '10px',
            boxSizing: 'border-box'
          }}
        />

        <input
          type="password"
          placeholder="אימות סיסמה"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            marginBottom: '10px',
            boxSizing: 'border-box'
          }}
        />

        {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ שינוי סיסמה...' : '✅ שנה סיסמה'}
        </button>
      </form>
    </div>
  );
};
```

---

## App.jsx - Routes Configuration

הוסף את ה-routes הבאות:

```javascript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VerifyCode } from './pages/VerifyCode';
import { ChangePassword } from './pages/ChangePassword';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... other routes */}
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/change-password" element={<ChangePassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## 🔄 Complete Flow

```
1️⃣ ForgotPassword.jsx
   └─ משתמש מזין אימייל
   └─ Backend שולח אימייל עם קוד 6-ספרות + Magic Link + QR Code
   └─ הודעה: "קוד נשלח לאימייל שלך!"

   ↓

2️⃣ VerifyCode.jsx (דף זה)
   └─ משתמש מזין אימייל + קוד 6-ספרות
   └─ Backend מאמת הקוד ⟹ מחזיר resetToken
   └─ localStorage.setItem('resetToken', resetToken)
   └─ navigate('/change-password') ✅

   ↓

3️⃣ ChangePassword.jsx (דף זה)
   └─ בדיקה: האם יש resetToken ב-localStorage?
   └─ משתמש מזין סיסמה חדשה
   └─ Backend משנה את הסיסמה
   └─ localStorage.removeItem('resetToken')
   └─ navigate('/login') 🎉

   ↓

4️⃣ Login
   └─ משתמש משתמש בסיסמה החדשה 🔐✅
```

---

## 🧪 Testing

### בדוקה 1: VerifyCode

```bash
# POST /api/auth/verifycode
curl -X POST http://localhost:5000/api/auth/verifycode \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

**התגובה:**
```json
{
  "success": true,
  "message": "קוד אומת בהצלחה",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "test@example.com"
}
```

### בדוקה 2: ChangePassword

```bash
# POST /api/auth/changepassword
curl -X POST http://localhost:5000/api/auth/changepassword \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "newPassword": "newPass123",
    "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**התגובה:**
```json
{
  "success": true,
  "message": "הסיסמה שונתה בהצלחה",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "test@example.com",
    "fullName": "John Doe"
  }
}
```

---

**Created:** January 30, 2026
