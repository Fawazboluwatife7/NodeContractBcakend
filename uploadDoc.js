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

// async function uploadDoc(buffer, docId) {
//   const { data, error } = await supabase.storage
//     .from("documents")
//     .upload(`agreements/${docId}.docx`, buffer, {
//       contentType:
//         "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//       upsert: false
//     });

//   if (error) throw error;
//   return data.path;
// }

// module.exports = {uploadDoc};


async function uploadDoc(buffer, docId, contentType) {
    try {
        const extension = contentType === 'application/pdf' ? '.pdf' : '.docx';
        const fileName = `contracts/${docId}${extension}`;

        const { data, error } = await supabase.storage
            .from('documents')
            .upload(fileName, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (error) throw error;

        return fileName;
    } catch (error) {
        console.error("❌ Supabase upload failed:", error);
        throw error;
    }
}

module.exports = {uploadDoc};