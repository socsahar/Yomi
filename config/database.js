// Database connection and utility functions
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Fix SSL certificate issue in development
if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/**
 * Execute a raw SQL query
 */
async function query(sql, params = []) {
    try {
        const { data, error } = await supabase.rpc('execute_sql', {
            query: sql,
            params: params
        });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

/**
 * Get data from a table
 */
async function select(table, options = {}) {
    try {
        let query = supabase.from(table).select(options.select || '*');
        
        if (options.where) {
            Object.entries(options.where).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }
        
        if (options.order) {
            query = query.order(options.order.column, { 
                ascending: options.order.ascending !== false 
            });
        }
        
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Database select error:', error);
        throw error;
    }
}

/**
 * Insert data into a table
 */
async function insert(table, data) {
    try {
        const { data: result, error } = await supabase
            .from(table)
            .insert(data)
            .select();
        
        if (error) throw error;
        return result;
    } catch (error) {
        console.error('Database insert error:', error);
        throw error;
    }
}

/**
 * Update data in a table
 */
async function update(table, id, data) {
    try {
        const { data: result, error } = await supabase
            .from(table)
            .update(data)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return result;
    } catch (error) {
        console.error('Database update error:', error);
        throw error;
    }
}

/**
 * Delete data from a table
 */
async function deleteRow(table, id) {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Database delete error:', error);
        throw error;
    }
}

module.exports = {
    supabase,
    query,
    select,
    insert,
    update,
    deleteRow
};
