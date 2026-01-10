You are a senior full-stack web developer building a production-ready web application.

Project description:
Build a Hebrew (RTL) web system for creating and managing daily work schedules for MDA (Magen David Adom).
The system is intended for internal use by shift schedulers at different stations.

General requirements:
- The app must be production-ready from the first line of code.
- The app will be deployed on Render.
- Database: Supabase (PostgreSQL). I will provide schema and data later.
- Do NOT use Supabase authentication or any external authentication system.
- Do NOT use TypeScript (JavaScript only).
- Do NOT split server/client apps. One unified app.
- Everything must run with a single command: `npm start`.
- No mock/demo code — everything should be written as real production logic.
- Clean, readable, maintainable code with proper folder structure.

UI / UX:
- The entire site must be in Hebrew and support Right-To-Left (RTL).
- Design must look custom and professional, NOT like an AI-generated template.
- Do NOT use purple color.
- Visual style should be inspired by MDA branding (red/white tones), but NOT copy it exactly.
- Modern, clean, serious, operational system.
- Responsive layout (desktop first, tablet/mobile friendly).
- Avoid overused UI libraries that make the site look generic.

Authentication (simple & internal):
- Implement a simple username + password system.
- No email, no verification, no roles.
- Anyone can register for now.
- All users have the same permissions.
- Registration will be removed later, so design accordingly.
- Passwords must be hashed securely.
- Use Supabase only as a database (users table).

Core scheduling concept:
- A daily schedule is fully data-driven and configurable by the shift schedulers.
- A schedule is composed of:
  - Stations
  - Shifts (e.g., morning / evening / night)
  - Operational units (vehicles, teams, resources)
  - Roles / positions inside each unit

Schedule structure flexibility:
- Shift schedulers must be able to:
  - Add, remove, and modify operational units per station and shift
  - Add, remove, rename, and reorder roles/positions inside each unit
- Roles are NOT fixed or predefined.
- The system must not assume a static schedule structure.

Assignment & interaction requirements (MANDATORY):
- Employees are assigned manually by schedulers.
- The UI MUST support:
  - Drag & drop employees into roles
  - Drag & drop between roles, units, shifts, and stations
  - Removing an employee from an assignment
  - Adding new units or roles dynamically
  - Deleting existing units or roles
- All interactions must be:
  - Immediate
  - Intuitive
  - Reflected instantly in the data model
- The schedule editor should behave like a professional planning tool,
  not a static form.

Main pages / features:
1. Login & Registration
2. Employees management page
   - Display list of employees from the database
   - Later, I will upload a one-time Excel file
   - Implement logic that reads this file and generates SQL or bulk insert queries
     to populate the employees table in Supabase
3. Daily schedule creation & editing
   - Interactive visual schedule editor
   - Full CRUD (create, read, update, delete) for units, roles, and assignments
   - Drag & drop based workflow
4. Schedule export
   - After finishing a daily schedule:
     - Generate a clean, formatted Excel file
     - Generate a clean, printable PDF
   - Layout must match a real daily MDA work schedule
   - I will provide an example Excel file that shows the exact structure to follow

Technical expectations:
- Use Node.js with a lightweight framework (Express or similar).
- Use a modern frontend approach but keep it simple and unified.
- Proper state management (no hacks).
- Clear separation of logic, UI, and data access (even in one app).
- Code should be written as if this system will be actively used in production.

Future-proofing:
- Schedule structure must be flexible and fully data-driven.
- Stations, shifts, units, and roles must be configurable per schedule.
- Authentication and permission logic should be easy to extend later.

Important:
Always assume:
- Hebrew language
- RTL layout
- Production environment
- Real users

When generating code:
- Prefer clarity over cleverness.
- Avoid unnecessary abstractions.
- Comment important business logic.
