const supabase = require("./supabase");

async function downloadDoc(fileName) {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(fileName);

  if (error) throw error;

  return Buffer.from(await data.arrayBuffer());
}

module.exports = downloadDoc;
