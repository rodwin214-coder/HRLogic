# Multi-Company Migration Guide

This guide explains what has changed in WorkLogix and how to complete the setup.

## What's New

WorkLogix has been transformed from a single-company app into a **multi-company SaaS platform**. Here's what changed:

### 1. Database Migration to Supabase

- **Before**: Data stored in browser localStorage
- **After**: Data stored in a PostgreSQL database via Supabase
- **Benefits**:
  - Persistent data across devices
  - Better performance for large datasets
  - Built-in backup and recovery
  - Multi-user real-time sync

### 2. Multi-Company Support

- **Before**: One company per installation
- **After**: Unlimited companies in one installation
- **Key Features**:
  - Each company has a unique code (e.g., `acme-corp`)
  - Complete data isolation between companies
  - Separate employee pools per company
  - Independent settings and configurations

### 3. Enhanced Security

- **Row Level Security (RLS)**: Database-level access control
- **Password Hashing**: bcrypt for secure credential storage
- **Company Isolation**: Users can only access their company's data
- **Session Management**: Secure authentication flow

## Setup Steps

### Step 1: Supabase Account Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Choose a name, database password, and region
4. Wait for the project to be created (2-3 minutes)

### Step 2: Get Your Credentials

1. In your Supabase project, click "Project Settings" (gear icon)
2. Go to "API" section
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Anon public** key (starts with `eyJ...`)

### Step 3: Configure Environment

1. Create `.env.local` file in the project root
2. Add your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### Step 4: Apply Database Migrations

The migrations have already been created. To apply them to your Supabase project:

**Option A: Using Supabase CLI (Recommended)**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option B: Manual SQL Execution**
1. Go to your Supabase project
2. Click "SQL Editor"
3. Copy and paste the SQL from the migration files (see below)
4. Click "Run"

### Step 5: Test the Application

1. Install dependencies: `npm install`
2. Run the app: `npm run dev`
3. Create your first company:
   - Click "Create Company"
   - Enter a company code (e.g., `demo-company`)
   - Fill in company details
   - Register

## Migration SQL Files

The following migrations need to be applied (in order):

### Migration 1: `create_multi_company_schema`
This creates all the necessary tables (companies, employees, user_accounts, etc.)
Location: Check your Supabase migrations in the SQL Editor

### Migration 2: `add_helper_functions`
This adds the `set_config` function needed for RLS
Location: Check your Supabase migrations in the SQL Editor

## Architecture Changes

### File Structure

```
project/
├── services/
│   ├── mockApi.ts          # Legacy (kept for compatibility)
│   ├── supabaseApi.ts      # NEW: Supabase API layer
│   └── supabaseClient.ts   # NEW: Supabase client setup
├── App.tsx                 # UPDATED: Now includes company code
├── .env.local              # NEW: Environment configuration
└── MIGRATION_GUIDE.md      # This file
```

### Key API Changes

| Old Function | New Function | Notes |
|-------------|--------------|-------|
| `loginUser(email, password)` | `loginUser(companyCode, email, password)` | Requires company code |
| `registerEmployer(...)` | `registerEmployer(companyCode, companyName, ...)` | Creates company + employer |
| Data in localStorage | Data in Supabase | Persistent across devices |

### Login Flow Changes

**Before:**
```
1. Enter email
2. Enter password
3. Login
```

**After:**
```
1. Enter company code
2. Enter email
3. Enter password
4. Login
```

## Testing Your Setup

### Test 1: Create First Company

1. Go to http://localhost:3000
2. Click "Create Company"
3. Enter:
   - Company Code: `test-company`
   - Company Name: `Test Company`
   - First Name: `Admin`
   - Last Name: `User`
   - Email: `admin@test.com`
   - Password: `password123`
4. Click "Create Company Account"
5. You should be logged in as an employer

### Test 2: Create Second Company

1. Logout
2. Register again with different details:
   - Company Code: `another-company`
   - Company Name: `Another Company`
   - etc.
3. Verify you can't see data from the first company

### Test 3: Add Employee

1. Login to first company
2. Go to "Employees" tab
3. Click "Add Employee"
4. Fill in details and submit
5. Verify employee appears in the list

## Data Migration (Optional)

If you have existing data in localStorage that you want to migrate:

1. Export data from the old system
2. Use the bulk import feature in the employer dashboard
3. CSV format supported for employees

## Troubleshooting

### Error: "Could not resolve supabaseApi"

- **Fix**: Ensure `services/supabaseApi.ts` exists
- Run: `npm install`

### Error: "Invalid credentials"

- **Fix**: Check `.env.local` file
- Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct
- Restart dev server: `npm run dev`

### Error: "Company code already exists"

- **Fix**: Choose a different company code
- Each company needs a unique code

### RLS Policy Errors

- **Fix**: Ensure migrations are applied
- Check that `set_config` function exists in database
- Verify RLS is enabled on tables

### No Data Showing Up

- **Fix**: Check browser console for errors
- Verify you're logged in with correct company code
- Check Supabase logs in dashboard

## Next Steps

1. **Complete Setup**: Follow steps 1-5 above
2. **Test Registration**: Create a test company
3. **Add Employees**: Invite some test employees
4. **Configure Settings**: Set up shifts, holidays, leave policies
5. **Go Live**: Share company codes with your users

## Support

If you encounter issues:

1. Check browser console for error messages
2. Check Supabase logs in your dashboard
3. Review the README.md for detailed documentation
4. Verify all environment variables are set correctly

## Benefits of Multi-Company

- **SaaS Ready**: Host multiple clients in one installation
- **Scalable**: Add unlimited companies
- **Isolated**: Complete data separation
- **Efficient**: Shared infrastructure, separate data
- **Flexible**: Each company has independent settings

Your WorkLogix installation is now a powerful multi-company platform!
