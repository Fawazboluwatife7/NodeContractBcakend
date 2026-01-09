// const { createClient } = require("@supabase/supabase-js");

// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_KEY
// );

// module.exports = supabase;

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;

console.log(
  "SUPABASE SERVICE KEY LOADED:",
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 20)
    : "❌ MISSING"
);
