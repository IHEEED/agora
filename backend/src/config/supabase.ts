import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ВНИМАНИЕ: этот клиент создан с service_role ключом и обходит Row Level
// Security. Он предназначен только для доверенных серверных роутов
// Express и никогда не должен импортироваться во фронтенд-код или
// попадать в бандл, отдаваемый браузеру.
