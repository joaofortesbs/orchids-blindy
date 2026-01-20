import os
import sys
from supabase import create_client, Client

def run_migration(supabase_url, service_role_key, sql_file):
    supabase: Client = create_client(supabase_url, service_role_key)
    
    with open(sql_file, 'r') as f:
        sql = f.read()
    
    # Supabase Python client doesn't have a direct 'execute_sql' method in the same way 
    # as the dashboard, but we can use the rpc call if we have a function defined,
    # OR we can try to use the admin API if available.
    # However, the most reliable way to run arbitrary SQL via API is usually a custom RPC.
    # Since we don't have that, we'll use a trick: 
    # Most migrations can be done via postgrest for simple table creation if enabled,
    # but for RLS and complex SQL, we really need the SQL API.
    
    print(f"Executing {sql_file}...")
    # NOTE: Supabase doesn't expose a public SQL execution endpoint for security.
    # We would typically use the dashboard. 
    # Since I am an agent with service_role_key, I can try to use the db connection string directly if available.
    return True

if __name__ == "__main__":
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    db_url = os.environ.get("SUPABASE_DB_URL")
    
    if not db_url:
        print("SUPABASE_DB_URL not found. Please provide it as a secret.")
        sys.exit(1)
    
    # If we have SUPABASE_DB_URL, we can use psql!
    # The user has SUPABASE_DB_URL in their secrets.
    import subprocess
    
    for migration in ["migrations/001_organizations.sql", "migrations/002_fix_rls_policies.sql", "migrations/003_kanban_tables.sql"]:
        print(f"Running {migration}...")
        try:
            result = subprocess.run(["psql", db_url, "-f", migration], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"Successfully ran {migration}")
            else:
                print(f"Error running {migration}: {result.stderr}")
        except Exception as e:
            print(f"Failed to execute {migration}: {str(e)}")
