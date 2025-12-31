CREATE OR REPLACE FUNCTION get_tables_with_columns(prefix_name text)
RETURNS JSONB AS $$  -- Change return type to JSONB
DECLARE
    tbl_name text;
    col_json JSONB;  -- Use JSONB type consistently
    result_json JSONB := '[]'::JSONB;  -- Initialize as JSONB empty array
BEGIN
    -- Escape special characters for LIKE pattern
    prefix_name := replace(prefix_name, '\', '\\');
    prefix_name := replace(prefix_name, '_', '\_');
    prefix_name := replace(prefix_name, '%', '\%');
    
    -- Iterate through tables matching the prefix
    FOR tbl_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_name LIKE (prefix_name || '_%') ESCAPE '\'
    LOOP
        -- Get column information for current table (using JSONB functions)
        SELECT jsonb_build_object(
            'table', tbl_name,
            'columns', COALESCE(
                (SELECT jsonb_agg(column_name::text)
                 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = tbl_name),
                '[]'::JSONB  -- Use JSONB type consistently
            )
        )
        INTO col_json;
        
        -- Append to result array using JSONB concatenation
        result_json := result_json || col_json;
    END LOOP;
    
    RETURN result_json;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION get_tables_with_columns(text) 