# SIIF

## Database setup

The application stores its data and user accounts in MySQL 8.0.16+. Incubatee
photos are stored on the local filesystem.

1. Create a database using `utf8mb4`, for example:

   ```sql
   CREATE DATABASE siif CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Apply [`mysql_schema.sql`](./mysql_schema.sql) to that database using the MySQL
   client or MySQL Workbench.
3. Copy [`.env.local.example`](./.env.local.example) to `.env.local` and set the
   MySQL connection values and other required service settings. Configure SMTP
   to enable password recovery emails.
4. Install dependencies, create the initial admin account, and start the app:

   ```bash
   npm install
   # Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in the environment first.
   npm run create-admin
   npm run dev
   ```

The MySQL schema creates a fresh database and default ledger categories. It does
not import or recover application, fee, attendance, or user records from the
previous database. Existing users must create accounts or receive new passwords.
The admin bootstrap command is only for the first administrator and refuses to
run once an active admin account exists.

To restore a missing incubated company, sign in as admin, open **Applications**,
and choose **Add Company**. Enter the company name, contact person, and login
email; the remaining company details are optional. The app creates an approved
company record and a first-login account together, then emails the temporary
credentials when SMTP is configured. If the email cannot be sent, the admin
screen displays the temporary password once so it can be shared securely. An
existing application or account with that email must be resolved first rather
than creating a duplicate.

Set `UPLOAD_DIR` to a persistent writable directory in production. Its default
is `uploads`, with photos stored in `uploads/incubatee-photos`. Filesystem
uploads require a persistent disk and are not suitable for ephemeral serverless
instances without a persistent volume.

## Build

```bash
npm run build
```
