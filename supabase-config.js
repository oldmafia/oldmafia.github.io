import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm';

const supabaseUrl = 'https://ftfciebnywbondaiarnc.supabase.co';
const supabaseKey = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';

export const supabase = createClient(supabaseUrl, supabaseKey);
