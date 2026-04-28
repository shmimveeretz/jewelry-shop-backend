import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅ SendGrid Email Service Initialized");
} else {
  console.error(
    "❌ CRITICAL: SENDGRID_API_KEY not set in environment variables",
  );
}

/**
 * Send email using SendGrid
 * @param {Object} mailOptions - Email options
 * @param {string} mailOptions.to - Recipient email
 * @param {string} mailOptions.subject - Email subject
 * @param {string} mailOptions.text - Plain text content
 * @param {string} mailOptions.html - HTML content
 * @returns {Promise<Object>} Email send result
 */
export const sendEmail = async (mailOptions) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not set in environment variables");
    }

    const msg = {
      to: mailOptions.to,
      from: process.env.EMAIL_USER || "noreply@shmimveeretz.com",
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html || mailOptions.text,
    };

    // Add replyTo if provided
    if (mailOptions.replyTo) {
      msg.replyTo = mailOptions.replyTo;
    }

    console.log("📧 Attempting to send email to:", mailOptions.to);
    const result = await sgMail.send(msg);
    console.log("✅ Email sent successfully to:", mailOptions.to);
    return {
      success: true,
      message: "Email sent successfully",
      messageId: result[0].headers["x-message-id"],
    };
  } catch (error) {
    console.error("❌ Email Send Error:", error.message);
    console.error("   Error Code:", error.code);
    console.error("   Error Details:", JSON.stringify(error, null, 2));
    return {
      success: false,
      message: error.message,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }
};

/**
 * Send order confirmation email
 * @param {string} to - Customer email
 * @param {Object} orderData - Order details
 */
export const sendOrderConfirmation = async (to, orderData) => {
  const { orderId, items, totalPrice, customerName } = orderData;

  const itemsList = items
    .map(
      (item) =>
        `<li>${item.name} - כמות: ${item.quantity} - מחיר: ₪${item.price}</li>`,
    )
    .join("");

  const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4a5568; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                🌟 אישור הזמנה - שמים וארץ
            </h2>
            
            <p>שלום ${customerName},</p>
            
            <p>תודה שקנית אצלנו! ההזמנה שלך התקבלה בהצלחה.</p>
            
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">פרטי הזמנה</h3>
                <p><strong>מספר הזמנה:</strong> ${orderId}</p>
                <p><strong>סכום כולל:</strong> ₪${totalPrice}</p>
            </div>
            
            <h3>פריטים בהזמנה:</h3>
            <ul style="list-style: none; padding: 0;">
                ${itemsList}
            </ul>
            
            <p style="margin-top: 30px;">נעדכן אותך כשההזמנה תישלח.</p>
            
            <p>בברכה,<br>צוות שמים וארץ 🌟</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #a0aec0;">
                אם יש לך שאלות, אנחנו כאן בשבילך:<br>
                📧 ${process.env.EMAIL_USER}<br>
                🌐 ${process.env.FRONTEND_URL}
            </p>
        </div>
    `;

  return await sendEmail({
    to,
    subject: `אישור הזמנה #${orderId} - שמים וארץ`,
    html,
  });
};

/**
 * Send order status update email
 * @param {string} to - Customer email
 * @param {Object} statusData - Status update details
 */
export const sendOrderStatusUpdate = async (to, statusData) => {
  const { orderId, status, customerName } = statusData;

  const statusMessages = {
    התקבל: "ההזמנה שלך התקבלה ומעובדת",
    בהכנה: "ההזמנה שלך בהכנה",
    נשלח: "ההזמנה שלך נשלחה ובדרך אליך",
    "הגיע ליעד": "ההזמנה שלך הגיעה ליעדה",
  };

  const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4a5568; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                📦 עדכון סטטוס הזמנה - שמים וארץ
            </h2>
            
            <p>שלום ${customerName},</p>
            
            <div style="background-color: #f0fff4; padding: 20px; border-radius: 5px; margin: 20px 0; border-right: 4px solid #48bb78;">
                <h3 style="margin-top: 0; color: #2f855a;">עדכון סטטוס</h3>
                <p style="font-size: 18px; margin: 0;"><strong>${
                  statusMessages[status] || status
                }</strong></p>
                <p style="margin-bottom: 0; margin-top: 10px; color: #718096;">מספר הזמנה: ${orderId}</p>
            </div>
            
            <p>תודה על הסבלנות שלך!</p>
            
            <p>בברכה,<br>צוות שמים וארץ 🌟</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #a0aec0;">
                📧 ${process.env.EMAIL_USER}<br>
                🌐 ${process.env.FRONTEND_URL}
            </p>
        </div>
    `;

  return await sendEmail({
    to,
    subject: `עדכון הזמנה #${orderId} - ${status}`,
    html,
  });
};

/**
 * Send contact form email
 * @param {Object} contactData - Contact form data
 */
export const sendContactEmail = async (contactData) => {
  const { name, email, phone, message } = contactData;

  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4a5568; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                📬 הודעה חדשה מטופס יצירת קשר
            </h2>
            
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>שם:</strong> ${name}</p>
                <p><strong>אימייל:</strong> ${email}</p>
                ${phone ? `<p><strong>טלפון:</strong> ${phone}</p>` : ""}
            </div>
            
            <h3>הודעה:</h3>
            <p style="background-color: #ffffff; padding: 15px; border-right: 3px solid #4299e1; border-radius: 3px;">
                ${message}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #a0aec0;">
                נשלח מאתר שמים וארץ<br>
                ${new Date().toLocaleString("he-IL")}
            </p>
        </div>
    `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `הודעה חדשה מ-${name}`,
    html,
    replyTo: email,
  });
};

/**
 * Send welcome email to new user
 * @param {string} to - User email
 * @param {Object} userData - User data
 */
export const sendWelcomeEmail = async (to, userData) => {
  const { name } = userData;

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f8f6; padding: 20px; border-radius: 10px;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8b4513; margin: 0; font-size: 32px;">🌟 ברוך הבא לשמים וארץ! 🌟</h1>
        </div>
        
        <h2 style="color: #8b4513; border-bottom: 3px solid #d4af37; padding-bottom: 10px;">שלום ${name},</h2>
        
        <p style="font-size: 16px; line-height: 1.8; color: #333;">
          תודה שנרשמת לאתר שמים וארץ! אנחנו שמחים שהצטרפת למשפחה שלנו.
        </p>
        
        <div style="background-color: #f9f8f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #8b4513; margin-top: 0;">✨ מה מחכה לך:</h3>
          <ul style="line-height: 2; color: #555;">
            <li>🎁 גישה לקולקציות ייחודיות של תכשיטי יהדות</li>
            <li>🛒 חוויית קנייה קלה ומהירה</li>
            <li>📦 מעקב אחר הזמנות ישירות מהחשבון</li>
            <li>💎 עדכונים על מוצרים חדשים ומבצעים מיוחדים</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${
            process.env.FRONTEND_URL
          }/products" style="display: inline-block; background-color: #d4af37; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">
            התחל לקנות עכשיו
          </a>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #d4af37; color: white; border-radius: 5px; text-align: center;">
          <h3 style="margin: 0 0 10px 0;">שמים וארץ - תכשיטי יהדות בעבודת יד</h3>
          <p style="margin: 5px 0; font-size: 14px;">📧 ${
            process.env.EMAIL_USER
          }</p>
          ${
            process.env.BUSINESS_PHONE
              ? `<p style="margin: 5px 0; font-size: 14px;">📞 ${process.env.BUSINESS_PHONE}</p>`
              : ""
          }
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #888; font-size: 12px;">
          <p>אם יש לך שאלות, אנחנו כאן בשבילך!</p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject: "🌟 ברוך הבא לשמים וארץ - הרשמה הושלמה בהצלחה",
    html,
  });
};

/**
 * Send new user registration notification to admin
 * @param {Object} userData - User data
 */
export const sendNewUserNotificationToAdmin = async (userData) => {
  const { name, email, phone } = userData;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0f9ff; border-radius: 10px;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
          👤 משתמש חדש נרשם!
        </h2>
        
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 5px; margin: 20px 0; border-right: 4px solid #3b82f6;">
          <h3 style="margin-top: 0; color: #1e40af;">פרטי המשתמש:</h3>
          <p style="margin: 10px 0;"><strong>שם:</strong> ${name}</p>
          <p style="margin: 10px 0;"><strong>אימייל:</strong> <a href="mailto:${email}" style="color: #3b82f6;">${email}</a></p>
          ${
            phone
              ? `<p style="margin: 10px 0;"><strong>טלפון:</strong> ${phone}</p>`
              : ""
          }
          <p style="margin: 10px 0;"><strong>תאריך הרשמה:</strong> ${new Date().toLocaleString(
            "he-IL",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          )}</p>
        </div>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-radius: 5px; border-right: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;">
            💡 <strong>טיפ:</strong> כדאי לשלוח למשתמש החדש הודעת ברכה אישית או קוד הנחה ראשונה!
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          הודעה זו נשלחה אוטומטית ממערכת שמים וארץ
        </p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `🎉 משתמש חדש נרשם: ${name}`,
    html,
  });
};

/**
 * Send password reset email with Magic Link + QR Code + TOTP
 * @param {string} to - User email
 * @param {Object} resetData - Reset data with name, verificationCode, resetUrl, qrCodeUrl
 */
export const sendPasswordResetEmail = async (to, resetData) => {
  const { name, verificationCode, resetUrl, qrCodeUrl } = resetData;

  const html = `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px;">
      <div style="background-color: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px;">
          <h1 style="color: #667eea; margin: 0; font-size: 32px; font-weight: bold;">🔐 איפוס סיסמה</h1>
          <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">אתה בדרך לאיפוס סיסמה בטוח</p>
        </div>
        
        <!-- Greeting -->
        <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">שלום ${name} 👋</h2>
        
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 15px;">
          קיבלנו בקשה לאיפוס הסיסמה של חשבונך ב<strong>שמים וארץ</strong>.
        </p>
        
        <!-- Option 1: TOTP Code -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center;">
          <p style="color: white; margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">קוד אימות לשימוש חד-פעמי</p>
          <div style="background-color: rgba(255,255,255,0.1); color: white; padding: 20px; border-radius: 8px; font-size: 42px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace; border: 2px solid rgba(255,255,255,0.3);">
            ${verificationCode}
          </div>
          <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 13px;">⏱️ תקף למשך 10 דקות בלבד</p>
        </div>
        
        <!-- Divider -->
        <div style="text-align: center; margin: 30px 0; position: relative;">
          <p style="color: #ccc; margin: 0; font-size: 14px;">--- או ---</p>
        </div>
        
        <!-- Option 2: Magic Link with QR Code -->
        <div style="background-color: #f8f9ff; padding: 25px; border-radius: 12px; border: 2px dashed #667eea; margin: 30px 0;">
          <p style="color: #333; text-align: center; margin: 0 0 20px 0; font-size: 14px; font-weight: bold;">🔗 Magic Link - לחץ כאן או סרוק QR</p>
          
          <!-- Magic Link Button -->
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
              🔓 אפס סיסמה בקלות
            </a>
          </div>
          
          <!-- QR Code -->
          <div style="text-align: center;">
            ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px; border: 2px solid #667eea; padding: 10px; background-color: white;">` : ""}
          </div>
        </div>
        
        <!-- Steps -->
        <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 30px 0; border-right: 4px solid #667eea;">
          <p style="color: #333; margin: 0 0 15px 0; font-weight: bold; font-size: 14px;">📋 איך לאפס את הסיסמה:</p>
          <ol style="color: #555; margin: 0; padding: 0 0 0 20px;">
            <li style="margin-bottom: 10px;">לחץ על הקישור "אפס סיסמה בקלות" או סרוק את ה-QR Code</li>
            <li style="margin-bottom: 10px;">או הזן את קוד האימות: <strong>${verificationCode}</strong></li>
            <li style="margin-bottom: 10px;">הזן סיסמה חדשה וחזקה</li>
            <li>התחבר עם הסיסמה החדשה שלך</li>
          </ol>
        </div>
        
        <!-- Warning -->
        <div style="background-color: #fff5f5; padding: 15px; border-radius: 8px; border-right: 4px solid #dc2626; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">
            ⏰ <strong>חשוב:</strong> קוד זה ו-Magic Link תוקפים ל-10 דקות בלבד מזמן קבלת האימייל הזה.
          </p>
        </div>
        
        <!-- Security Notice -->
        <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; border-right: 4px solid #f59e0b; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 13px;">
            🚨 <strong>למען הביטחון:</strong> אם לא ביקשת לאפס סיסמה, התעלם מהודעה זו. חשבונך בטוח.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            אימייל זה נשלח אוטומטית ואינו ניתן למענה.<br/>
            © 2026 Shamaim VeEretz. כל הזכויות שמורות.
          </p>
        </div>
        
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject: "🔐 קוד איפוס סיסמה + Magic Link - שמים וארץ",
    html,
  });
};

/**
 * Send order confirmation invoice to customer
 * @param {string} to - Customer email
 * @param {Object} orderData - Complete order details
 */
export const sendCustomerOrderInvoice = async (to, orderData) => {
  const {
    orderNumber,
    items,
    shippingAddress,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paymentInfo,
    createdAt,
  } = orderData;

  const itemsList = items
    .map((item) => {
      // Build options display if they exist
      let optionsHtml = "";
      if (
        item.selectedOptions &&
        Object.keys(item.selectedOptions).length > 0
      ) {
        const optionsText = Object.entries(item.selectedOptions)
          .map(([key, value]) => {
            // Translate keys to Hebrew
            const keyMap = {
              length: "אורך",
              metalType: "סוג מתכת",
              size: "מידה",
              color: "צבע",
              engraving: "חריטה",
              chain: "שרשרת",
            };
            const translatedKey = keyMap[key] || key;
            return `${translatedKey}: ${value}`;
          })
          .join(" • ");

        optionsHtml = `<div style="font-size: 13px; color: #7f8c8d; margin-top: 5px; font-style: italic;">${optionsText}</div>`;
      }

      return `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            <div style="font-weight: 500; color: #2c3e50;">${item.name}</div>
            ${optionsHtml}
            ${
              item.productId
                ? `<div style="font-size: 11px; color: #95a5a6; margin-top: 5px;">קוד מוצר: ${item.productId}</div>`
                : ""
            }
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">${
            item.quantity
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">₪${
            item.price
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; vertical-align: top;">₪${(
            item.price * item.quantity
          ).toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const orderDate = createdAt
    ? new Date(createdAt).toLocaleString("he-IL", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("he-IL");

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f9f8f6; padding: 20px; border-radius: 10px;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid transparent; border-image: linear-gradient(to left, #d4af37, #f4e5c3, #d4af37) 1;">
          <h1 style="color: #2c3e50; margin: 0; font-size: 36px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase;">שמים וארץ</h1>
          <p style="color: #7f8c8d; margin: 15px 0 0 0; font-size: 14px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase;">תכשיטי יהדות בעבודת יד</p>
        </div>
        
        <!-- Success Message -->
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 30px; border-radius: 8px; margin: 30px 0; border-right: 4px solid #d4af37; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h2 style="color: #2c3e50; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 1px;">ההזמנה שלך התקבלה בהצלחה</h2>
          <p style="margin: 15px 0 0 0; color: #7f8c8d; font-size: 15px; font-weight: 300;">תודה שבחרת בנו. נעדכן אותך בכל שלב מהדרך.</p>
        </div>
        
        <!-- Order Details -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0; padding-bottom: 12px; font-size: 18px; font-weight: 400; letter-spacing: 1px; border-bottom: 1px solid #d4af37;">פרטי הזמנה</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>מספר הזמנה:</strong></td>
              <td style="padding: 8px 0; text-align: left; color: #333; font-weight: bold;">${orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>תאריך הזמנה:</strong></td>
              <td style="padding: 8px 0; text-align: left; color: #333;">${orderDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>סטטוס תשלום:</strong></td>
              <td style="padding: 8px 0; text-align: left; color: #48bb78; font-weight: bold;">✓ שולם</td>
            </tr>
          </table>
        </div>
        
        <!-- Shipping Address -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0; padding-bottom: 12px; font-size: 18px; font-weight: 400; letter-spacing: 1px; border-bottom: 1px solid #d4af37;">כתובת למשלוח</h3>
          <p style="margin: 5px 0; color: #333;"><strong>${
            shippingAddress.name
          }</strong></p>
          <p style="margin: 5px 0; color: #666;">${shippingAddress.phone}</p>
          <p style="margin: 5px 0; color: #666;">${shippingAddress.street}</p>
          <p style="margin: 5px 0; color: #666;">${shippingAddress.city}${
            shippingAddress.zipCode ? `, ${shippingAddress.zipCode}` : ""
          }</p>
          <p style="margin: 5px 0; color: #666;">${
            shippingAddress.country || "ישראל"
          }</p>
        </div>
        
        <!-- Items Table -->
        <div style="margin: 30px 0;">
          <h3 style="color: #2c3e50; padding-bottom: 12px; font-size: 18px; font-weight: 400; letter-spacing: 1px; border-bottom: 1px solid #d4af37;">פריטים שהוזמנו</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f7fafc;">
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #d4af37;">מוצר</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #d4af37;">כמות</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #d4af37;">מחיר ליחידה</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #d4af37;">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>
        </div>
        
        <!-- Price Summary -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">סכום ביניים:</td>
              <td style="padding: 8px 0; text-align: left; color: #333;">₪${itemsPrice}</td>
            </tr>
            ${
              taxPrice > 0
                ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">מע"מ:</td>
              <td style="padding: 8px 0; text-align: left; color: #333;">₪${taxPrice}</td>
            </tr>
            `
                : ""
            }
            <tr>
              <td style="padding: 8px 0; color: #666;">משלוח:</td>
              <td style="padding: 8px 0; text-align: left; color: #333;">₪${shippingPrice}</td>
            </tr>
            <tr style="border-top: 2px solid #d4af37;">
              <td style="padding: 12px 0; color: #8b4513; font-size: 18px;"><strong>סה"כ לתשלום:</strong></td>
              <td style="padding: 12px 0; text-align: left; color: #8b4513; font-size: 20px; font-weight: bold;">₪${totalPrice}</td>
            </tr>
          </table>
        </div>
        
        <!-- What's Next -->
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 5px; margin: 20px 0; border-right: 4px solid #f59e0b;">
          <h3 style="color: #92400e; margin-top: 0;">📌 מה הלאה?</h3>
          <ul style="color: #92400e; line-height: 1.8; padding-right: 20px;">
            <li>נתחיל להכין את ההזמנה שלך מיד</li>
            <li>תקבל עדכון כשההזמנה תישלח</li>
            <li>משלוח סטנדרטי לוקח 3-5 ימי עסקים</li>
          </ul>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding: 20px; background-color: #d4af37; color: white; border-radius: 5px; text-align: center;">
          <h3 style="margin: 0 0 10px 0;">שמים וארץ - תכשיטי יהדות בעבודת יד</h3>
          <p style="margin: 5px 0; font-size: 14px;">📧 ${
            process.env.EMAIL_USER
          }</p>
          ${
            process.env.BUSINESS_PHONE
              ? `<p style="margin: 5px 0; font-size: 14px;">📞 ${process.env.BUSINESS_PHONE}</p>`
              : ""
          }
          <p style="margin: 15px 0 5px 0; font-size: 14px;">נשמח לעזור בכל שאלה! 💙</p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #888; font-size: 12px;">
          <p>תודה שבחרת בשמים וארץ!</p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject: `✅ חשבונית והזמנה #${orderNumber} - שמים וארץ`,
    html,
  });
};

/**
 * Send new order notification to business owner
 * @param {Object} orderData - Complete order details
 */
export const sendBusinessOwnerOrderNotification = async (orderData) => {
  const {
    orderNumber,
    items,
    shippingAddress,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paymentInfo,
    createdAt,
    userId,
    customerEmail,
  } = orderData;

  const itemsList = items
    .map((item) => {
      // Build options display if they exist
      let optionsHtml = "";
      if (
        item.selectedOptions &&
        Object.keys(item.selectedOptions).length > 0
      ) {
        const optionsText = Object.entries(item.selectedOptions)
          .map(([key, value]) => {
            // Translate keys to Hebrew
            const keyMap = {
              length: "אורך",
              metalType: "סוג מתכת",
              size: "מידה",
              color: "צבע",
              engraving: "חריטה",
              chain: "שרשרת",
            };
            const translatedKey = keyMap[key] || key;
            return `${translatedKey}: ${value}`;
          })
          .join(" • ");

        optionsHtml = `<div style="font-size: 13px; color: #7f8c8d; margin-top: 5px; font-style: italic;">${optionsText}</div>`;
      }

      return `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            <div style="font-weight: 500; color: #2c3e50;">${item.name}</div>
            ${optionsHtml}
            ${
              item.productId
                ? `<div style="font-size: 11px; color: #95a5a6; margin-top: 5px;">קוד מוצר: ${item.productId}</div>`
                : ""
            }
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">${
            item.quantity
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">₪${
            item.price
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; vertical-align: top;">₪${(
            item.price * item.quantity
          ).toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const orderDate = createdAt
    ? new Date(createdAt).toLocaleString("he-IL", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("he-IL");

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f0f9ff; padding: 20px; border-radius: 10px;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid transparent; border-image: linear-gradient(to left, #d4af37, #f4e5c3, #d4af37) 1;">
          <h1 style="color: #2c3e50; margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase;">שמים וארץ</h1>
          <p style="color: #7f8c8d; margin: 10px 0 0 0; font-size: 12px; font-weight: 300; letter-spacing: 2px;">מערכת ניהול הזמנות</p>
        </div>
        
        <!-- Alert Header -->
        <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="margin: 0; font-size: 26px; font-weight: 300; letter-spacing: 2px;">הזמנה חדשה התקבלה</h2>
          <p style="margin: 15px 0 0 0; font-size: 16px; font-weight: 300; color: #d4af37;">מספר הזמנה: ${orderNumber}</p>
        </div>
        
        <!-- Order Summary -->
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 8px; margin: 25px 0; border-right: 3px solid #d4af37; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px; font-weight: 400; letter-spacing: 1px;">סיכום כספי</h2>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0; color: #2f855a; font-size: 18px;"><strong>סה"כ הזמנה:</strong></td>
              <td style="padding: 5px 0; text-align: left; color: #2f855a; font-size: 24px; font-weight: bold;">₪${totalPrice}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #2f855a;">תאריך:</td>
              <td style="padding: 5px 0; text-align: left; color: #2f855a;">${orderDate}</td>
            </tr>
          </table>
        </div>
        
        <!-- Customer Details -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">👤 פרטי לקוח</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 30%;"><strong>שם:</strong></td>
              <td style="padding: 8px 0; color: #333;">${
                shippingAddress.name
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>טלפון:</strong></td>
              <td style="padding: 8px 0;"><a href="tel:${
                shippingAddress.phone
              }" style="color: #3b82f6; text-decoration: none;">${
                shippingAddress.phone
              }</a></td>
            </tr>
            ${
              customerEmail
                ? `
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>אימייל:</strong></td>
              <td style="padding: 8px 0;"><a href="mailto:${customerEmail}" style="color: #3b82f6; text-decoration: none;">${customerEmail}</a></td>
            </tr>
            `
                : ""
            }
            ${
              userId
                ? `
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>מזהה לקוח:</strong></td>
              <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 12px;">${userId}</td>
            </tr>
            `
                : ""
            }
          </table>
        </div>
        
        <!-- Shipping Address -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">📦 כתובת למשלוח</h3>
          <p style="margin: 5px 0; color: #333; font-size: 16px;"><strong>${
            shippingAddress.name
          }</strong></p>
          <p style="margin: 5px 0; color: #666;">${shippingAddress.street}</p>
          <p style="margin: 5px 0; color: #666;">${shippingAddress.city}${
            shippingAddress.zipCode ? `, ${shippingAddress.zipCode}` : ""
          }</p>
          <p style="margin: 5px 0; color: #666;">${
            shippingAddress.country || "ישראל"
          }</p>
          <p style="margin: 15px 0 5px 0; color: #666;"><strong>טלפון ליצירת קשר:</strong></p>
          <p style="margin: 5px 0;"><a href="tel:${
            shippingAddress.phone
          }" style="color: #3b82f6; text-decoration: none; font-size: 18px; font-weight: bold;">${
            shippingAddress.phone
          }</a></p>
        </div>
        
        <!-- Items Table -->
        <div style="margin: 30px 0;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">🛍️ פריטים בהזמנה</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f7fafc;">
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #3b82f6;">מוצר</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #3b82f6;">כמות</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #3b82f6;">מחיר ליחידה</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #3b82f6;">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>
        </div>
        
        <!-- Price Breakdown -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">💵 פירוט מחירים</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">סכום מוצרים:</td>
              <td style="padding: 8px 0; text-align: left; color: #333;">₪${itemsPrice}</td>
            </tr>
            ${
              taxPrice > 0
                ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">מע"מ:</td>
              <td style="padding: 8px 0; text-align: left; color: #333;">₪${taxPrice}</td>
            </tr>
            `
                : ""
            }
            <tr>
              <td style="padding: 8px 0; color: #666;">משלוח:</td>
              <td style="padding: 8px 0; text-align: left; color: #333;">₪${shippingPrice}</td>
            </tr>
            <tr style="border-top: 2px solid #3b82f6;">
              <td style="padding: 12px 0; color: #1e40af; font-size: 18px;"><strong>סה"כ:</strong></td>
              <td style="padding: 12px 0; text-align: left; color: #1e40af; font-size: 20px; font-weight: bold;">₪${totalPrice}</td>
            </tr>
          </table>
        </div>
        
        <!-- Payment Info -->
        <div style="background-color: #d4f4dd; padding: 20px; border-radius: 5px; margin: 20px 0; border-right: 4px solid #48bb78;">
          <h3 style="color: #2f855a; margin-top: 0;">💳 פרטי תשלום</h3>
          <p style="margin: 5px 0; color: #2f855a;"><strong>שיטת תשלום:</strong> ${
            paymentInfo.method === "credit_card"
              ? "כרטיס אשראי"
              : paymentInfo.method === "paypal"
                ? "PayPal"
                : paymentInfo.method === "bit"
                  ? "ביט"
                  : paymentInfo.method
          }</p>
          ${
            paymentInfo.transactionId
              ? `<p style="margin: 5px 0; color: #2f855a;"><strong>מזהה עסקה:</strong> ${paymentInfo.transactionId}</p>`
              : ""
          }
          <p style="margin: 5px 0; color: #2f855a;"><strong>סטטוס:</strong> ✅ שולם</p>
        </div>
        
        <!-- Action Items -->
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 5px; margin: 20px 0; border-right: 4px solid #f59e0b;">
          <h3 style="color: #92400e; margin-top: 0;">⚡ פעולות נדרשות</h3>
          <ul style="color: #92400e; line-height: 1.8; padding-right: 20px; margin: 10px 0;">
            <li>הכן את המוצרים להזמנה</li>
            <li>עדכן את סטטוס ההזמנה במערכת</li>
            <li>צור משלוח והזן מספר מעקב</li>
            <li>עדכן את הלקוח בשליחה</li>
          </ul>
        </div>
        
        <!-- Footer -->
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          הודעה זו נשלחה אוטומטית ממערכת ניהול ההזמנות<br>
          ${orderDate}
        </p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `🛒 הזמנה חדשה #${orderNumber} - ₪${totalPrice}`,
    html,
  });
};
