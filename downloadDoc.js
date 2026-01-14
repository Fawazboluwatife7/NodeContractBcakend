const supabase = require("./supabase");

async function downloadDoc(fileName) {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(fileName);

  if (error) throw error;

  return Buffer.from(await data.arrayBuffer());
}

module.exports = downloadDoc;



// DOWNLOAD FUNCTION
// async function downloadDoc(fileName) {
//     try {
//         const { data, error } = await supabase.storage
//             .from('documents')
//             .download(fileName);

//         if (error) throw error;

//         const buffer = Buffer.from(await data.arrayBuffer());
//         return buffer;
//     } catch (error) {
//         console.error("❌ Supabase download failed:", error);
//         throw error;
//     }
// }

//  module.exports = downloadDoc;
