require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Controller untuk menangani endpoint /api/scan
exports.processReceipt = async (req, res) => {
  try {
    const { image } = req.body; // Gambar base64 yang dikirim dari Frontend

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Gambar tidak ditemukan dalam request. Pastikan mengirim { "image": "base64..." }'
      });
    }

    // Inisialisasi SDK Resmi Google
    const genAI = new GoogleGenerativeAI("AQ.Ab8RN6Jt6ija_3G78TtJ0Upvil1L3AQEvrl5VuZjUyaGzR3pog");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const promptText = `Ekstrak informasi dari nota belanja ini. 
Kembalikan HANYA dalam format JSON murni yang valid.
ATURAN WAJIB: Anda HARUS menggunakan tanda kutip ganda (") untuk semua nama properti/key dan value string.

Contoh format yang Benar:
{"toko": "Nama", "tanggal": "12/12/2023", "total": 50000}

Struktur yang diminta:
{
  "toko": "Nama Toko (jika tidak ada isi string kosong)",
  "tanggal": "Tanggal nota format DD/MM/YYYY (jika tidak ada isi string kosong)",
  "total": angka total belanja (hanya integer murni, tanpa Rp atau titik)
}
Jangan tambahkan penjelasan apapun, keluarkan JSON saja.`;

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    };

    // Panggil API Gemini menggunakan SDK
    const result = await model.generateContent([promptText, imagePart]);
    const responseText = result.response.text();

    let aiText = responseText.trim();

    // Pembersihan JSON yang lebih agresif (Anti-Ngebug)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiText = jsonMatch[0];
    } else {
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    aiText = aiText.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    aiText = aiText.replace(/'/g, '"');

    const parsedData = JSON.parse(aiText);

    // Kirim respons sukses kembali ke Frontend
    return res.status(200).json({
      success: true,
      message: 'Nota berhasil dibaca',
      data: parsedData
    });

  } catch (error) {
    console.error('Scan Controller Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat memproses nota.'
    });
  }
};
