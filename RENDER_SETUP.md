# Render Deployment Setup Guide

## Adding PostgreSQL Session Store to Render

To eliminate the MemoryStore warning and use proper PostgreSQL session storage, follow these steps:

### Option 1: Get Supabase Direct Connection String

1. Go to your Supabase project dashboard: https://app.supabase.com/project/rbjmlwlgznxrdctpgxze
2. Navigate to **Settings** → **Database**
3. Scroll down to **Connection string** section
4. Select **Connection pooling** mode (recommended for Render)
5. Copy the connection string that looks like:
   ```
   postgresql://postgres.[PROJECT-ID]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
6. Replace `[PASSWORD]` with your actual database password
7. Go to your Render dashboard: https://dashboard.render.com
8. Select your "yomi-fdhf" web service
9. Go to **Environment** tab
10. Add a new environment variable:
    - **Key**: `DATABASE_URL`
    - **Value**: The connection string from step 5
11. Click **Save Changes** - this will trigger an automatic redeploy

### Option 2: Use Supabase Transaction Pooler

If you don't have the direct database password, you can use the transaction pooler:

1. In Supabase dashboard, go to **Settings** → **Database**
2. Under **Connection Info**, find the **Transaction Pooler** section
3. Copy the URI (it should include the pooler port 6543)
4. Add it as `DATABASE_URL` in Render environment variables

### Verify Setup

After adding the DATABASE_URL:
1. Render will automatically redeploy your app
2. Check the logs - you should see: "Using PostgreSQL session store"
3. No more "MemoryStore is not designed for production" warnings
4. Sessions will persist across server restarts and scale horizontally

### Current Behavior (Without DATABASE_URL)

The app is configured to work without DATABASE_URL by falling back to MemoryStore with a warning. This means:
- ✅ App will still function normally
- ⚠️ Sessions stored in memory (lost on restart)
- ⚠️ Warning message in logs
- ⚠️ Not suitable for horizontal scaling

### Benefits of PostgreSQL Session Store

- ✅ Sessions persist across restarts
- ✅ Supports horizontal scaling (multiple instances)
- ✅ No memory leaks from session accumulation
- ✅ Production-ready session management
