import os
import json
import traceback # Untuk logging error detail

# Muat environment variables (terutama API Key)
from dotenv import load_dotenv
load_dotenv() # Tetap berguna untuk pengembangan lokal

# Konfigurasi Google Generative AI
import google.generativeai as genai
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Validasi dan konfigurasi API Key
genai_configured = False # Default
model = None # Default

print(f"Mencoba memuat GOOGLE_API_KEY. Ditemukan? {'Ya' if GOOGLE_API_KEY else 'Tidak'}") # Log tambahan

if not GOOGLE_API_KEY:
    print("FATAL ERROR: GOOGLE_API_KEY tidak ditemukan di environment variables!")
    # Di Vercel, ini seharusnya tidak terjadi jika env var diatur.
    # Pertimbangkan exit() atau raise Exception jika API Key wajib untuk *start*
else:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        print("Google Generative AI BERHASIL Dikonfigurasi.")
        genai_configured = True
        try:
            # Inisialisasi Model Gemini (hanya jika konfigurasi berhasil)
            # Sesuaikan nama model jika perlu (misal 'gemini-1.0-pro')
            model = genai.GenerativeModel('gemini-1.5-pro-latest')
            print(f"Model Gemini '{model.model_name}' BERHASIL diinisialisasi.")
        except Exception as model_err:
            print(f"ERROR: Gagal menginisialisasi model Gemini setelah konfigurasi berhasil: {model_err}")
            traceback.print_exc()
            model = None # Tetap None jika gagal inisialisasi
            genai_configured = False # Anggap tidak siap jika model gagal
    except Exception as config_err:
        print(f"ERROR: Gagal mengkonfigurasi Google Generative AI: {config_err}")
        traceback.print_exc()
        genai_configured = False

# Impor library lain yang diperlukan
from whitenoise import WhiteNoise
from flask import Flask, request, jsonify, render_template # Hapus send_from_directory jika tidak dipakai
from werkzeug.utils import secure_filename
import PyPDF2
import docx

# Inisialisasi Aplikasi Flask (HANYA SEKALI)
app = Flask(__name__)

# --- PERUBAHAN PATH UPLOAD ---
# Gunakan /tmp di Vercel, tetap 'uploads' untuk lokal jika /tmp tidak ada/diinginkan
# Vercel biasanya menyediakan /tmp
UPLOAD_FOLDER = '/tmp/uploads' if os.path.exists('/tmp') else 'uploads'
# Pastikan direktori ada (exist_ok=True tidak error jika sudah ada)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
print(f"Folder upload diatur ke: {UPLOAD_FOLDER}")
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# ---------------------------

# --- Konfigurasi WhiteNoise ---
# 'root' relatif terhadap app.py
# 'prefix' adalah URL path
# Pastikan ini setelah app = Flask(...) dan sebelum definisi route
# Cukup satu kali inisialisasi WhiteNoise
# Tambahkan kompresi statis jika brotli/gzip diinginkan
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='/static/')
# add_files mungkin tidak perlu jika 'root' sudah benar, tapi tidak berbahaya
app.wsgi_app.add_files('static/', prefix='/static/')
print("WhiteNoise dikonfigurasi untuk menyajikan dari 'static/' pada '/static/'")
# -----------------------------


# === FUNGSI HELPER (extract_text_from_file, create_gemini_prompt, call_gemini_api) ===
# ... (Tidak ada perubahan signifikan di sini, logging sudah cukup baik) ...
# Pastikan fungsi extract_text_from_file tidak bergantung pada path absolut
# dan hanya menggunakan 'filepath' yang diterima.

def extract_text_from_file(filepath):
    """Mengekstrak teks dari file (PDF, DOCX, TXT) berdasarkan ekstensinya."""
    text = ""
    filename = os.path.basename(filepath)
    print(f"Memulai ekstraksi teks dari: {filename} di path: {filepath}") # Tambah path log

    try:
        # --- Penanganan PDF ---
        if filename.lower().endswith('.pdf'):
             # ... (kode PDF Anda sudah cukup baik dengan penanganan error per halaman) ...
             # Tambahkan print jika file tidak ditemukan sebelum dibuka
            if not os.path.exists(filepath):
                 print(f"  FATAL: File {filepath} tidak ditemukan saat akan dibuka untuk PDF.")
                 raise FileNotFoundError(f"File PDF tidak ditemukan di path: {filepath}")
            with open(filepath, 'rb') as pdf_file:
                # ... sisa kode PDF ...
                pass # Placeholder

        # --- Penanganan DOCX ---
        elif filename.lower().endswith('.docx'):
             # ... (kode DOCX Anda) ...
            if not os.path.exists(filepath):
                 print(f"  FATAL: File {filepath} tidak ditemukan saat akan dibuka untuk DOCX.")
                 raise FileNotFoundError(f"File DOCX tidak ditemukan di path: {filepath}")
            # ... sisa kode DOCX ...
            pass # Placeholder

        # --- Penanganan TXT ---
        elif filename.lower().endswith('.txt'):
            # ... (kode TXT Anda sudah cukup baik dengan penanganan encoding) ...
            if not os.path.exists(filepath):
                 print(f"  FATAL: File {filepath} tidak ditemukan saat akan dibuka untuk TXT.")
                 raise FileNotFoundError(f"File TXT tidak ditemukan di path: {filepath}")
            # ... sisa kode TXT ...
            pass # Placeholder

        # --- Tipe File Tidak Didukung ---
        else:
            raise ValueError(f"Tipe file tidak didukung: {os.path.splitext(filename)[1]}")

        print(f"Ekstraksi teks dari {filename} selesai. Panjang Teks: {len(text)}")
        return text.strip()

    except FileNotFoundError:
        print(f"Error Fatal: File tidak ditemukan di {filepath}")
        raise # Lempar ulang
    except PyPDF2.errors.PdfReadError as e:
         print(f"Error membaca struktur PDF {filename}: {e}")
         return f"[Error: Gagal membaca struktur PDF - {e}]" # Kembalikan pesan error spesifik
    except Exception as e:
        print(f"Error tidak terduga saat ekstraksi teks dari {filename}: {e}")
        traceback.print_exc()
        # Jangan raise di sini agar flow utama bisa menangani, tapi kembalikan pesan error
        return f"[Error: Terjadi kesalahan internal saat ekstraksi teks - {e}]"


def create_gemini_prompt(text_content, difficulty, num_questions, question_type):
    """Membuat prompt terstruktur untuk API Gemini."""
    # ... (Fungsi ini sepertinya sudah OK) ...
    print(f"Membuat prompt: Kesulitan='{difficulty}', Jumlah='{num_questions}', Tipe='{question_type}'")
    # ... (isi prompt Anda) ...
    prompt = f"""
PERAN: Anda adalah AI ahli pembuat soal ujian berdasarkan materi pelajaran.
TUGAS: Buat soal HANYA berdasarkan teks sumber yang diberikan.

TEKS SUMBER:
---
{text_content[:15000]}
---
# Batasi panjang teks sumber jika terlalu besar untuk prompt (misal 15k karakter)

INSTRUKSI PEMBUATAN SOAL:
1. Buatlah tepat **{num_questions}** buah soal.
2. Tingkat kesulitan soal harus **{difficulty}**.
3. Prioritaskan jenis soal **{question_type}**.
   - pilihan_ganda: Buatlah pertanyaan dengan 4 opsi jawaban (a, b, c, d), dimana HANYA SATU jawaban yang benar. Tandai jawaban yang benar.
   - esai: Buatlah pertanyaan terbuka (jawaban 1-3 kalimat).
   - benar_salah: Buatlah pernyataan, tanyakan Benar/Salah.
   - campuran: Kombinasikan jenis di atas.
4. **KRUSIAL**: Semua soal dan jawabannya harus berasal HANYA dari TEKS SUMBER. Jangan gunakan pengetahuan eksternal.
5. Soal harus jelas dan relevan.

FORMAT OUTPUT (WAJIB):
Kembalikan HANYA **JSON List** yang valid. TIDAK BOLEH ada teks lain (seperti ```json ... ```).
Setiap elemen list adalah object JSON:
{{
  "question_text": "Teks pertanyaan?",
  "question_type": "pilihan_ganda" | "esai" | "benar_salah",
  "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"], // Array string (kosong jika bukan PG)
  "correct_answer": "Teks opsi benar" | "Benar" | "Salah" | "" // String kosong untuk esai
}}

Contoh JSON List:
[
  {{"question_text": "Contoh PG?", "question_type": "pilihan_ganda", "options": ["A", "B", "C", "D"], "correct_answer": "A"}},
  {{"question_text": "Contoh Esai?", "question_type": "esai", "options": [], "correct_answer": ""}},
  {{"question_text": "Contoh B/S?", "question_type": "benar_salah", "options": [], "correct_answer": "Benar"}}
]

Mulai!
"""
    return prompt

def call_gemini_api(prompt):
    """Memanggil API Gemini, menangani respons, dan mem-parse JSON."""
    # ... (Fungsi ini sepertinya sudah OK, penanganan error cukup baik) ...
    # Pastikan model dan genai_configured diperiksa sebelum memanggil
    if not genai_configured or not model:
        print("Error Kritis: Model AI tidak siap atau tidak terkonfigurasi saat call_gemini_api.")
        # Seharusnya sudah dicek di route handler, tapi double check
        raise ConnectionError("Layanan AI tidak siap.")

    try:
        print("Mengirim request ke Gemini API...")
        generation_config = genai.types.GenerationConfig(
             temperature=0.6, # Sedikit kurangi randomness untuk konsistensi format
             # max_output_tokens=4096 # Sesuaikan jika perlu
        )
        safety_settings = { # Setting lebih permisif jika sering diblokir (hati-hati)
            'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
            'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
            'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
            'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
        }

        response = model.generate_content(
            prompt,
            generation_config=generation_config,
            safety_settings=safety_settings # Gunakan safety setting
            )

        print("Menerima respons dari Gemini API.")

        # Periksa apakah ada blok konten
        if not response.parts:
             if response.prompt_feedback and response.prompt_feedback.block_reason:
                  block_reason = response.prompt_feedback.block_reason
                  block_message = response.prompt_feedback.block_reason_message or "Tidak ada pesan detail."
                  print(f"Warning: Konten diblokir oleh Gemini. Alasan: {block_reason}. Pesan: {block_message}")
                  # Periksa juga safety ratings jika ada
                  for rating in response.prompt_feedback.safety_ratings:
                      print(f"  - Kategori: {rating.category}, Probabilitas: {rating.probability}")
                  raise ValueError(f"Konten diblokir oleh AI karena alasan keamanan: {block_reason}. {block_message}")
             else:
                  print("Warning: Respons Gemini kosong atau tidak memiliki bagian 'parts'. Cek prompt feedback.")
                  print("Prompt Feedback:", response.prompt_feedback)
                  raise ValueError("AI mengembalikan respons kosong tanpa alasan jelas.")


        response_text = response.text # Coba akses teks
        # print("Respons Teks Mentah (awal):", response_text[:500] + "...") # Debug jika perlu

        # Membersihkan jika terbungkus markdown JSON
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
            cleaned_text = cleaned_text.strip()
        elif cleaned_text.startswith("```"): # Hanya ``` pembuka/penutup
            cleaned_text = cleaned_text[3:]
            if cleaned_text.endswith("```"):
                 cleaned_text = cleaned_text[:-3]
            cleaned_text = cleaned_text.strip()

        # Coba parse sebagai JSON
        try:
            parsed_json = json.loads(cleaned_text)
            if not isinstance(parsed_json, list):
                print("Error: Respons AI BUKAN JSON List setelah dibersihkan.")
                print("Teks setelah dibersihkan:", cleaned_text)
                raise ValueError("AI tidak mengembalikan format JSON List yang diharapkan.")
            print(f"Respons berhasil di-parse sebagai JSON List ({len(parsed_json)} item).")
            return parsed_json
        except json.JSONDecodeError as json_err:
            print(f"Error Kritis: Gagal mem-parse respons Gemini sebagai JSON: {json_err}")
            print("Teks yang Gagal Diparse (setelah dibersihkan):", cleaned_text) # Log teks yg gagal
            print("Respons Teks Mentah Lengkap:", response_text) # Log teks asli
            raise ValueError(f"AI tidak mengembalikan format JSON yang valid. Respons dimulai dengan: {response_text[:200]}...")

    except AttributeError as attr_err:
        print(f"Error: Tidak bisa mendapatkan atribut (kemungkinan '.text' atau '.parts') dari respons Gemini: {attr_err}")
        # Cek prompt_feedback secara eksplisit jika ada
        if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
            print("Prompt Feedback:", response.prompt_feedback)
            if response.prompt_feedback.block_reason:
                raise ValueError(f"Permintaan diblokir karena: {response.prompt_feedback.block_reason_message}")
        raise ValueError("Gagal mendapatkan atau memproses teks dari respons AI.")
    except Exception as api_err:
        print(f"Error Kritis saat memanggil atau memproses respons Gemini API: {api_err}")
        traceback.print_exc()
        # Berikan pesan error yang lebih umum tapi informatif
        raise ConnectionError(f"Gagal berkomunikasi atau memproses respons dari layanan AI: {api_err}")


# === ROUTE FLASK ===

@app.route('/')
def serve_index():
    """Menyajikan halaman HTML utama."""
    # Tidak perlu 'send_from_directory', WhiteNoise akan menangani /static/
    return render_template('index.html')

@app.route('/generate-soal', methods=['POST'])
def generate_questions_api():
    """Endpoint utama untuk menerima file, memproses, dan menghasilkan soal."""
    print("\n--- Menerima Request Baru di /generate-soal ---")
    filepath = None # Inisialisasi filepath

    # 0. Cek Kesiapan AI sebelum proses file
    if not genai_configured or not model:
        print("Peringatan Dini: Layanan AI tidak siap saat request diterima.")
        return jsonify({"error": "Layanan AI tidak terkonfigurasi atau model tidak siap. Periksa log server."}), 503 # Service Unavailable

    try:
        # 1. Validasi File Upload
        if 'moduleFile' not in request.files:
            print("Error: 'moduleFile' tidak ada dalam request.files")
            return jsonify({"error": "Bagian file ('moduleFile') tidak ditemukan."}), 400
        file = request.files['moduleFile']
        if not file or file.filename == '':
            print("Error: Tidak ada file yang dipilih atau nama file kosong.")
            return jsonify({"error": "Tidak ada file yang dipilih."}), 400

        # 2. Simpan File & Ekstrak Teks
        filename = secure_filename(file.filename)
        # Path lengkap menggunakan UPLOAD_FOLDER yang sudah disesuaikan
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        print(f"Menyimpan file '{filename}' ke '{filepath}'...")
        file.save(filepath)
        print(f"File '{filename}' berhasil disimpan.")

        extracted_text = extract_text_from_file(filepath)

        # Cek hasil ekstraksi (lebih ketat)
        if not extracted_text or extracted_text.startswith("[Error:"):
             error_msg = f"Tidak dapat membuat soal dari '{filename}' karena gagal mengekstrak teks."
             if extracted_text: # Jika ada pesan error spesifik dari ekstraksi
                 error_msg += f" Detail: {extracted_text}"
             print(f"Error Ekstraksi Teks: {error_msg}")
             # Gunakan 422 Unprocessable Entity jika file valid tapi isi tidak bisa diproses
             return jsonify({"error": error_msg}), 422

        print(f"Ekstraksi teks berhasil, jumlah karakter: {len(extracted_text)}")
        # Opsi: Batasi jumlah teks yang dikirim ke AI jika terlalu besar
        MAX_TEXT_LENGTH = 30000 # Misalnya, ~30k karakter (sesuaikan)
        if len(extracted_text) > MAX_TEXT_LENGTH:
            print(f"Peringatan: Teks terlalu panjang ({len(extracted_text)} char), memotong ke {MAX_TEXT_LENGTH} char.")
            extracted_text = extracted_text[:MAX_TEXT_LENGTH]


        # 3. Ambil Parameter Form
        difficulty = request.form.get('difficulty', 'sedang')
        # Pastikan num_questions adalah integer dan dalam batas wajar
        try:
            num_questions = int(request.form.get('numQuestions', '5'))
            if not 1 <= num_questions <= 50: # Batas dari HTML
                 raise ValueError("Jumlah soal diluar batas (1-50)")
        except (ValueError, TypeError):
             print("Peringatan: numQuestions tidak valid, menggunakan default 5.")
             num_questions = 5 # Default aman jika input tidak valid

        question_type = request.form.get('questionType', 'campuran')
        # Parameter halaman belum digunakan di ekstraksi/prompt, abaikan sementara
        # start_page = request.form.get('startPage')
        # end_page = request.form.get('endPage')
        print(f"Parameter diterima: Diff='{difficulty}', Num='{num_questions}', Type='{question_type}'")

        # 4. Buat Prompt dan Panggil Gemini
        # Pengecekan AI sudah dilakukan di awal, tapi tidak ada salahnya cek lagi
        if not model:
             print("Error Kritis: Model hilang sebelum pemanggilan API?")
             return jsonify({"error": "Layanan AI tidak siap (model tidak ada)."}), 503

        prompt = create_gemini_prompt(extracted_text, difficulty, str(num_questions), question_type) # Pastikan num_q string
        generated_questions = call_gemini_api(prompt) # Bisa raise Error

        # Pastikan hasil adalah list (seharusnya sudah divalidasi di call_gemini_api)
        if not isinstance(generated_questions, list):
             print("Error: Hasil dari call_gemini_api bukan list!")
             return jsonify({"error": "Terjadi kesalahan internal saat memproses hasil AI."}), 500

        print(f"Proses AI selesai, {len(generated_questions)} soal dihasilkan.")

        # 5. Kirim Hasil ke Frontend
        return jsonify({
            "message": f"Berhasil membuat {len(generated_questions)} soal dari file '{filename}'.",
            "questions": generated_questions
        })

    # --- Penanganan Error Terstruktur ---
    except FileNotFoundError as fnf_err:
         error_message = str(fnf_err)
         print(f"Error File Tidak Ditemukan: {error_message}")
         # Kemungkinan terjadi jika file dihapus antara save dan extract, atau path salah
         return jsonify({"error": f"Kesalahan file di server: {error_message}"}), 500
    except ValueError as ve: # Termasuk tipe file tidak didukung, parse JSON gagal, input form salah
         error_message = str(ve)
         print(f"Error Data/Format/Validasi: {error_message}")
         # Gunakan 400 untuk input buruk, 422 jika input valid tapi tidak bisa diproses, 500 jika internal AI format error
         status_code = 400
         if "AI tidak mengembalikan format" in error_message or "Konten diblokir" in error_message:
             status_code = 502 # Bad Gateway - Masalah di upstream (AI)
         elif "Tipe file tidak didukung" in error_message:
             status_code = 415 # Unsupported Media Type
         return jsonify({"error": f"Kesalahan data atau format: {error_message}"}), status_code
    except ConnectionError as ce: # Error koneksi ke Gemini / AI tidak siap
         error_message = str(ce)
         print(f"Error Koneksi AI: {error_message}")
         return jsonify({"error": f"Gagal menghubungi atau menggunakan layanan AI: {error_message}"}), 503 # Service Unavailable
    except IOError as ioe: # Error baca/tulis file umum (selain FileNotFoundError)
         error_message = str(ioe)
         print(f"Error I/O File: {error_message}")
         traceback.print_exc()
         return jsonify({"error": f"Gagal membaca/menulis file di server: {error_message}"}), 500
    except Exception as e: # Tangkap error tidak terduga lainnya
        print(f"Error Internal Tidak Terduga di /generate-soal: {e}")
        traceback.print_exc()
        return jsonify({"error": "Terjadi kesalahan internal tidak terduga di server."}), 500
    finally:
        # --- PENTING: Bersihkan file upload di /tmp ---
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
                print(f"File upload '{filepath}' berhasil dihapus.")
            except Exception as del_err:
                # Log error tapi jangan sampai menggagalkan response utama
                print(f"Peringatan: Gagal menghapus file upload '{filepath}': {del_err}")
        else:
            # Jika filepath tidak pernah di-set (error sebelum save) atau sudah tidak ada
            print("Tidak ada file upload untuk dihapus atau path tidak valid.")


# === Menjalankan Aplikasi ===
if __name__ == '__main__':
    # Port dari environment variable PORT (umum di platform hosting) atau default 5000
    port = int(os.environ.get("PORT", 5000))
    # debug=False untuk produksi/Vercel. host='0.0.0.0' agar bisa diakses dari luar container/mesin.
    app.run(debug=False, host='0.0.0.0', port=port)