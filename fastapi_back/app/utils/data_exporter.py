import pandas as pd
import io
from app.config.db import db

async def export_table_to_excel(table_name: str):
    """
    Exports a database table to an Excel file (in-memory bytes).
    """
    try:
        # Fetch data from DB
        sql = f"SELECT * FROM {table_name}"
        rows = await db.query(sql)
        
        if not rows:
            return None

        # Create DataFrame
        df = pd.DataFrame(rows)
        
        # In-memory buffer
        output = io.BytesIO()
        
        # Write to Excel
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=table_name.capitalize())
            
        return output.getvalue()
    except Exception as e:
        print(f"Export Error: {e}")
        return None
