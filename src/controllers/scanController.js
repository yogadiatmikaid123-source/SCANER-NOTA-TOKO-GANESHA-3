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

    const apiKey = "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";
    const endpoint = `https://integrate.api.nvidia.com/v1/chat/completions`;

    const promptText = `Tugas Anda adalah mengekstrak informasi dari gambar nota belanja (printer dot-matrix).
Karena ini nota dot-matrix, angka 6 sangat sering terlihat seperti angka 4. BACA DENGAN SANGAT TELITI!

LANGKAH 1 (TRANSKRIPSI MENTAH):
Tuliskan seluruh teks dan angka yang Anda lihat di gambar secara persis dari atas sampai bawah. 

LANGKAH 2 (EKSTRAKSI JSON):
Setelah Anda selesai menuliskan transkrip, buatlah ringkasan datanya dalam format JSON murni.
ATURAN WAJIB: Anda HARUS menggunakan tanda kutip ganda (") untuk semua nama properti/key dan value string.

Contoh format JSON:
{"toko": "Nama Toko", "tanggal": "12/12/2023", "total": 50000}

Struktur JSON yang diminta:
{
  "toko": "Nama Toko (jika tidak ada isi string kosong)",
  "tanggal": "Tanggal nota format DD/MM/YYYY (jika tidak ada isi string kosong)",
  "total": angka total belanja (integer murni dari tagihan akhir, tanpa Rp/titik/koma)
}`;

    const requestBody = {
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0.1,
      top_p: 0.95
    };

    // Panggil API NVIDIA
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Server AI sedang sibuk (Rate Limit NVIDIA). Coba beberapa saat lagi.');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gagal terhubung ke NVIDIA API. Status: ${response.status}`);
    }

    const data = await response.json();
    
    // Format response NVIDIA
    let aiText = data.choices[0].message.content.trim();

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
