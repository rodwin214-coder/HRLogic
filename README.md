# WorkLogix - Multi-Company Attendance & HR Management System

A comprehensive attendance tracking and HR management system with **multi-company support**, built with React, TypeScript, and Supabase.

## New: Multi-Company Architecture

WorkLogix now supports multiple companies in a single installation! Each company has completely isolated data with its own:
- Unique company code for login
- Employee records and user accounts
- Attendance records and requests
- Shifts, holidays, and leave policies
- Custom fields and settings

### Company Code System

- Users must enter a **company code** when logging in or registering
- Company codes are unique identifiers (e.g., `acme-corp`, `tech-solutions`)
- All data is automatically scoped to the logged-in user's company
- Data isolation is enforced at the database level using Row Level Security (RLS)

## Features

- **Multi-Company Support**: Complete data isolation between companies
- **Role-Based Access**: Separate interfaces for employers and employees
- **Time Tracking**: Clock in/out with photo and location verification
- **Leave Management**: Request and approve vacation, sick leave, overtime, and undertime
- **Employee Management**: Full CRUD operations for employee records
- **Reporting**: Comprehensive attendance and payroll reports
- **Task Management**: Assign and track tasks for employees
- **Custom Fields**: Add custom fields to employee profiles
- **Audit Logs**: Track all changes to employee data

## Setup Instructions

### 1. Prerequisites

- Node.js (v18 or higher)
- A Supabase account (free tier works great!)

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. The database migrations will be applied automatically
3. Go to Project Settings > API in your Supabase dashboard
4. Copy your project URL and anon key

### 3. Environment Configuration

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Multi-Company Usage Guide

### Creating a New Company

1. Click "Create Company" on the login page
2. Enter a unique company code (lowercase letters, numbers, hyphens, underscores only)
3. Enter your company name (e.g., "Acme Corporation")
4. Provide your name and email
5. Create a password (minimum 8 characters)
6. Submit to create your company account

**The first user becomes the company administrator (employer role)**

### Logging In

1. Enter your **company code** (e.g., `acme-corp`)
2. Enter your email address
3. Enter your password
4. Click Login

**Important**: Users can only log in to their own company using the correct company code.

### For Employers (Company Admins)

After logging in as an employer, you can:

1. **Add Employees**:
   - Manually add individual employees
   - Bulk invite via email list
   - Bulk import from CSV file

2. **Manage Requests**:
   - Approve or reject employee leave requests
   - Handle overtime and undertime submissions
   - Review profile change requests

3. **Configure Company Settings**:
   - Set work schedules (Monday-Friday, Monday-Saturday, etc.)
   - Define shifts with start and end times
   - Add company holidays
   - Configure leave policies
   - Create custom employee fields

4. **View Reports**:
   - Attendance logs with location data
   - Leave and absence tracking
   - Payroll summaries
   - Export to CSV

5. **Manage Employees**:
   - View all employee profiles
   - Edit employee information
   - Terminate or reactivate accounts
   - Adjust leave balances
   - Track salary history

### For Employees

Employees can:

1. **Clock In/Out**:
   - Take a photo for verification
   - Location is automatically captured
   - Add end-of-day notes when clocking out

2. **Submit Requests**:
   - Request vacation or sick leave
   - File overtime or undertime
   - Request profile information changes

3. **Track Work**:
   - View and update assigned tasks
   - See attendance history
   - Check leave balances

4. **Manage Profile**:
   - Update personal information (requires approval)
   - Upload profile picture
   - Change password
   - View custom fields

## Data Security

### Row Level Security (RLS)

All database tables use PostgreSQL RLS policies to ensure:
- Users can only see data from their own company
- Employers have full access to their company's data
- Employees can view company data but only modify their own records
- No cross-company data leaks are possible

### Password Security

- Passwords are hashed using bcrypt before storage
- Minimum 8-character password requirement
- Passwords are never returned in API responses

### Session Management

- User sessions are stored securely in localStorage
- Email-based context for RLS policy enforcement
- Automatic logout on data access errors

## Database Schema

The multi-tenant database includes:

### Core Tables

- `companies`: Company profiles and settings
- `employees`: Employee records (with company_id)
- `user_accounts`: Login credentials (with company_id)
- `attendance_records`: Clock in/out data (with company_id)
- `requests`: Leave and change requests (with company_id)
- `shifts`: Work shift definitions (with company_id)
- `holidays`: Company holidays (with company_id)
- `tasks`: Task assignments (with company_id)
- `salary_history`: Compensation tracking (linked to employees)
- `leave_policies`: Leave accrual rules (per company)
- `custom_field_definitions`: Custom employee fields (per company)
- `audit_logs`: Change tracking for compliance (per company)

### Key Features

- All tables use UUID primary keys
- Foreign key constraints ensure referential integrity
- Indexes on company_id for fast queries
- Timestamps for audit trails
- JSONB fields for flexible data storage

## API Architecture

The application uses a Supabase-based API (`services/supabaseApi.ts`) with:

- **Authentication**: Company-scoped login and registration
- **Employee Management**: CRUD operations with RLS enforcement
- **Attendance Tracking**: Clock in/out with media storage
- **Request Processing**: Leave and overtime workflows
- **Reporting**: Aggregated data queries
- **Leave Calculations**: Pro-rated accruals with tenure bonuses

## Key Technologies

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Row Level Security)
- **Auth**: bcryptjs for password hashing
- **State Management**: React Context API
- **Build**: Vite
- **Email**: EmailJS (optional, for notifications)

## EmailJS Configuration (Optional)

For email notifications (employee invitations, password resets, payslips):

1. Create a free account at [EmailJS](https://www.emailjs.com/)
2. Update credentials in `services/mockApi.ts` (lines 16-21)
3. Configure email templates in your EmailJS dashboard
4. Add your public key to `index.html` (line 28)

## Troubleshooting

### Build Issues

If you encounter build errors:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Supabase Connection

If you see RLS errors:
1. Verify your `.env.local` file has correct credentials
2. Check that migrations have been applied
3. Ensure the `set_config` function exists in your database

### Login Problems

If login fails:
1. Verify the company code exists (check `companies` table)
2. Confirm email and password are correct
3. Check browser console for detailed error messages

## Development

To run in development mode:
```bash
npm run dev
```

To build for production:
```bash
npm run build
```

To preview production build:
```bash
npm run preview
```

## Support

For issues or questions, please refer to the inline code documentation or contact your system administrator.

## License

This project is proprietary software for WorkLogix.
