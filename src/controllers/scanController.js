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
Kembalikan HANYA dalam format JSON murni (tanpa blockquote markdown \`\`\`json) dengan struktur berikut:
{
  "toko": "Nama Toko (jika tidak ada isi string kosong)",
  "tanggal": "Tanggal nota format DD/MM/YYYY (jika tidak ada isi string kosong)",
  "total": angka total belanja (hanya integer murni, tanpa Rp atau titik)
}
Pastikan output benar-benar hanya string JSON yang bisa di-parse.`;

    // Format request standar OpenAI untuk Vision API (NVIDIA NIM)
    const requestBody = {
      model: "meta/llama-3.2-11b-vision-instruct",
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
      temperature: 0.1
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

    // Pembersihan JSON yang ketat (Anti-Ngebug)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiText = jsonMatch[0];
    } else {
      aiText = aiText.replace(/```json/g, '').replace(/```/g, ''); // Fallback
    }

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
