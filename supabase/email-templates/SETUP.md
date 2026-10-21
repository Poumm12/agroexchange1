# Forgot / Reset Password — Ρύθμιση (AgroExchange)

Αυτός ο οδηγός εξηγεί τι χρειάζεται για να φαίνεται το email επαναφοράς κωδικού
100% AgroExchange. **Η λειτουργικότητα (Supabase Auth, tokens, flow) δεν αλλάζει** —
αλλάζουν μόνο το redirect URL, το branding, το template και το footer.

> Το μεγαλύτερο μέρος ρυθμίζεται στο **Supabase Dashboard** (δεν είναι κώδικας).
> Η μόνη αλλαγή κώδικα είναι το redirect URL, που έχει ήδη γίνει (βλ. §1).

---

## 1. Redirect στο production site ✅ (έγινε στον κώδικα)

Το `resetPassword()` (`src/context/AuthContext.tsx`) στέλνει πλέον το link στο
**production site**, ποτέ σε `localhost`:

```ts
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://agroexchange.vercel.app'
redirectTo: `${siteUrl}/auth/reset-password`
```

**Τι πρέπει να κάνεις εσύ στο Supabase** (ώστε να επιτρέπεται το redirect):

1. Supabase Dashboard → **Authentication → URL Configuration**
2. **Site URL**: `https://agroexchange.vercel.app`
3. **Redirect URLs** (Add URL) — πρόσθεσε:
   - `https://agroexchange.vercel.app/auth/reset-password`
   - `https://agroexchange.vercel.app/**` (wildcard, για ασφάλεια σε όλα τα routes)
4. (Προαιρετικά για τοπική ανάπτυξη) `http://localhost:3000/auth/reset-password`

> Αν αργότερα βάλεις δικό σου domain (π.χ. `agroexchange.gr`), άλλαξε το
> `NEXT_PUBLIC_SITE_URL` στο Vercel + πρόσθεσε το νέο URL εδώ. Καμία αλλαγή κώδικα.

---

## 2. Custom Email Branding (Sender)

Από προεπιλογή το email φαίνεται ως `Supabase Auth <noreply@mail.app.supabase.io>`.
Για να γίνει **AgroExchange**, ρύθμισε **Custom SMTP**:

1. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**
2. Ενεργοποίησε **Enable Custom SMTP**
3. Συμπλήρωσε:
   - **Sender name**: `AgroExchange`
   - **Sender email**: `noreply@agroexchange.gr` (ή `support@agroexchange.gr`)
   - **Host / Port / Username / Password**: τα στοιχεία του SMTP παρόχου σου
     (π.χ. Resend, SendGrid, Mailgun, Brevo, Amazon SES)

> Μέχρι να συνδεθεί το domain `agroexchange.gr`, μπορείς να χρησιμοποιήσεις
> προσωρινά τον πάροχο (π.χ. Resend με verified domain). Όταν προστεθεί το domain,
> **αλλάζεις μόνο τα SMTP στοιχεία** — το template και ο κώδικας μένουν ίδια.

### Παράδειγμα με Resend (το project έχει ήδη `RESEND_API_KEY`)
- Host: `smtp.resend.com`
- Port: `465` (SSL) ή `587` (TLS)
- Username: `resend`
- Password: `<RESEND_API_KEY>`
- Sender: `noreply@agroexchange.gr` (αφού γίνει verify το domain στο Resend)

---

## 3. Custom Email Template

1. Supabase Dashboard → **Authentication → Email Templates → "Reset Password"**
2. **Subject**: `Επαναφορά Κωδικού — AgroExchange`
3. **Message body**: αντίγραψε **όλο** το περιεχόμενο του αρχείου
   [`reset-password.html`](./reset-password.html) και επικόλλησέ το.
4. Πάτησε **Save**.

Το template χρησιμοποιεί το token `{{ .ConfirmationURL }}` που παράγει το ίδιο το
Supabase — οπότε **ο σύνδεσμος, τα tokens και το flow παραμένουν ακριβώς ίδια**.

Περιλαμβάνει: λογότυπο/branding AgroExchange, τίτλο «Επαναφορά Κωδικού», σύντομη
επεξήγηση, μεγάλο πράσινο κουμπί, fallback link, ειδοποίηση λήξης (60’) και μήνυμα
«αγνόησε αν δεν το ζήτησες».

> **Λήξη συνδέσμου**: το template αναφέρει 60 λεπτά. Ρύθμισέ το στο
> **Authentication → Providers → Email → "Email OTP Expiration"** (ή αντίστοιχο)
> ώστε να ταιριάζει. Αν επιλέξεις άλλη διάρκεια, ενημέρωσε το κείμενο στο HTML.

---

## 4. Αφαίρεση Supabase Footer ✅

Το default footer του Supabase ("You're receiving this email because… Powered by
Supabase… Opt out") **εμφανίζεται μόνο όταν χρησιμοποιείται ο default mailer του
Supabase**. Μόλις ενεργοποιήσεις **Custom SMTP (§2)** και αντικαταστήσεις το
**template (§3)**, το footer εξαφανίζεται εντελώς — το `reset-password.html` έχει
δικό του footer **χωρίς καμία αναφορά στο Supabase**.

---

## 5. Τι ΔΕΝ άλλαξε

- ✅ Authentication (Supabase Auth)
- ✅ Forgot password flow (`resetPasswordForEmail`)
- ✅ Reset password flow (`updateUser({ password })` στο `/auth/reset-password`)
- ✅ Tokens / single-use links / λήξη
- ✅ Όλη η υπόλοιπη λογική

Άλλαξαν **μόνο**: redirect URL (production), sender branding, email template, footer.
