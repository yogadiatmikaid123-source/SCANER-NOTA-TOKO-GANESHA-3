require('dotenv').config();

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

    const promptText = `Ekstrak informasi dari nota belanja ini. 
Kembalikan HANYA dalam format JSON murni yang valid.
ATURAN WAJIB: Anda HARUS menggunakan tanda kutip ganda (") untuk semua nama properti/key dan value string. Dilarang menggunakan kutip tunggal (') atau tanpa kutip pada properti.

Contoh format yang Benar:
{"toko": "Nama", "tanggal": "12/12/2023", "total": 50000}

Struktur yang diminta:
{
  "toko": "Nama Toko (jika tidak ada isi string kosong)",
  "tanggal": "Tanggal nota format DD/MM/YYYY (jika tidak ada isi string kosong)",
  "total": angka total belanja (hanya integer murni, tanpa Rp atau titik)
}
Jangan tambahkan penjelasan apapun, keluarkan JSON saja.`;

    // Format request standar OpenAI untuk Vision API (NVIDIA NIM)
    const requestBody = {
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
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
      max_tokens: 65536,
      temperature: 0.6,
      top_p: 0.95,
      // extra_body sesuai skrip python
      extra_body: { chat_template_kwargs: { enable_thinking: true }, reasoning_budget: 16384 }
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
    
    // Format response OpenAI (NVIDIA)
    let aiText = data.choices[0].message.content.trim();

    // Pembersihan JSON yang lebih agresif untuk Llama Vision
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiText = jsonMatch[0];
    } else {
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    // Koreksi otomatis jika Llama lupa pakai kutip ganda pada properti: 
    // Mengubah { toko: "..." } menjadi { "toko": "..." }
    aiText = aiText.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    // Memperbaiki kutip tunggal jika ada: 'value' -> "value"
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
