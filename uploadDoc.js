// const supabase = require("./supabase");

// async function uploadDoc(buffer, docId) {
//   const fileName = `${docId}.docx`;

//   const { error } = await supabase.storage
//     .from("documents")
//     .upload(fileName, buffer, {
//       contentType:
//         "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//       upsert: true
//     });

//   if (error) throw error;

//   return fileName;
// }
// module.exports = {uploadDoc};

const supabase = require("./supabase");

async function uploadDoc(buffer, docId) {
  const { data, error } = await supabase.storage
    .from("documents")
    .upload(`agreements/${docId}.docx`, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}

module.exports = {uploadDoc};


