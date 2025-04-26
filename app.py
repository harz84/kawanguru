# --- START OF FILE app.py ---

import os
import json
import traceback
import io # Penting: Untuk menangani stream file TXT

# Muat environment variables (terutama API Key)
# Untuk deployment Vercel, environment variables disetel di dashboard,
# tapi load_dotenv membantu untuk pengujian lokal.
from dotenv import load_dotenv
load_dotenv()

# Konfigurasi Google Generative AI
import google.generativeai as genai
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Validasi dan konfigurasi API Key
if not GOOGLE_API_KEY:
    print("FATAL ERROR: GOOGLE_API_KEY tidak ditemukan di environment variables!")
    print("Pastikan Anda telah mengatur GOOGLE_API_KEY di Environment Variables Vercel Dashboard.")
    genai_configured = False
else:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        print("Google Generative AI Dikonfigurasi.")
        genai_configured = True
    except Exception as e:
        print(f"ERROR: Gagal mengkonfigurasi Google Generative AI: {e}")
        genai_configured = False

# Inisialisasi Model Gemini (hanya jika konfigurasi berhasil)
model = None
if genai_configured:
    try:
        # Sesuaikan nama model jika perlu. gemini-1.5-pro-latest direkomendasikan untuk performa dan context window.
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        print(f"Model Gemini '{model.model_name}' berhasil diinisialisasi.")
    except Exception as e:
        print(f"ERROR: Gagal menginisialisasi model Gemini: {e}")
        model = None # Tetap None jika gagal inisialisasi

# Impor library lain yang diperlukan
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename # Masih berguna untuk sanitasi nama file
# dari werkzeug.datastructures import FileStorage # Tipe objek file dari request.files
import PyPDF2
import docx
from whitenoise import WhiteNoise # Import WhiteNoise

# Inisialisasi Aplikasi Flask
app = Flask(__name__)

# --- KONFIGURASI WHITENOISE ---
# WhiteNoise akan menyajikan file dari folder 'static'
# Pastikan folder 'static' berada di root level proyek Anda.
# root='static/' berarti cari file statis di sub-folder 'static'.
# prefix='static/' berarti layani file statis di URL path '/static/'.
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='static/')
print("WhiteNoise dikonfigurasi untuk melayani /static/")
# --- AKHIR KONFIGURASI WHITENOISE ---

# Konfigurasi Folder Upload (folder ini TIDAK AKAN DIGUNAKAN untuk menyimpan file upload di Vercel)
# Karena Vercel Function bersifat read-only di sebagian besar area.
# Kode yang mencoba menulis ke sini akan menyebabkan Errno 30.
# Baris ini dan variabel config UPLOAD_FOLDER tidak relevan untuk menyimpan file upload di Vercel.
# UPLOAD_FOLDER = 'uploads'
# try:
#     os.makedirs(UPLOAD_FOLDER, exist_ok=True)
#     print(f"Info: Folder '{UPLOAD_FOLDER}' tersedia (jika environment mengizinkan penulisan).")
# except Exception as e:
#     print(f"Info: Gagal membuat folder '{UPLOAD_FOLDER}' atau folder read-only: {e}")
# app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER # Variabel config ini tidak relevan lagi untuk save file


# === FUNGSI HELPER ===

# Fungsi untuk mengekstrak teks dari objek file-like (stream)
def extract_text_from_file(file_object, filename):
    """
    Mengekstrak teks dari objek file-like (stream) berdasarkan nama file.
    Mendukung PDF, DOCX, TXT.

    Args:
        file_object: Objek file-like (misal werkzeug.datastructures.FileStorage)
                     yang memiliki atribut 'stream' (binary stream).
        filename (str): Nama asli file (untuk menentukan tipe file).

    Returns:
        str: Teks yang diekstrak, atau pesan error jika gagal.
    """
    text = ""
    print(f"Memulai ekstraksi teks dari stream file: {filename}")

    # Gunakan stream biner dari objek file FileStorage
    file_stream = file_object.stream

    try:
        # --- Penanganan PDF ---
        if filename.lower().endswith('.pdf'):
            print("  -> PDF terdeteksi (membaca dari stream).")
            # PyPDF2.PdfReader dapat membaca langsung dari binary stream
            reader = PyPDF2.PdfReader(file_stream)
            num_pages = len(reader.pages)
            print(f"  -> PDF memiliki {num_pages} halaman.")
            if reader.is_encrypted:
                 print(f"  Peringatan: PDF {filename} terenkripsi. Mungkin gagal diekstrak.")
                 # Bisa return error spesifik di sini jika mau:
                 # return "[Error: PDF terenkripsi, tidak bisa diekstrak]"

            # TODO: Implementasi logika range halaman di sini jika start_page/end_page aktif
            # Anda akan membutuhkan parameter start_page dan end_page di fungsi ini
            # dan menyesuaikan loop range(num_pages) berdasarkan input tersebut.

            for page_num in range(num_pages): # Memproses semua halaman untuk saat ini
                try:
                    page = reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                    # else:
                    #    print(f"  Info: Halaman {page_num + 1} tidak ada teks.")
                except Exception as page_error:
                     print(f"  Error saat memproses halaman {page_num + 1} PDF: {page_error}")
                     text += f"\n[Error halaman {page_num + 1}]\n" # Tambahkan placeholder error di teks hasil

            if not text.strip():
                 print(f"  Peringatan: Tidak ada teks diekstrak dari PDF {filename}. Mungkin hanya gambar, terenkripsi, atau kosong.")

        # --- Penanganan DOCX ---
        elif filename.lower().endswith('.docx'):
            print("  -> DOCX terdeteksi (membaca dari stream).")
            # python-docx.Document dapat membaca langsung dari binary stream
            doc = docx.Document(file_stream)
            full_text = [para.text for para in doc.paragraphs if para.text]
            text = '\n'.join(full_text)

        # --- Penanganan TXT ---
        elif filename.lower().endswith('.txt'):
            print("  -> TXT terdeteksi (membaca dari stream).")
            encodings_to_try = ['utf-8', 'latin-1', 'windows-1252']
            read_success = False
            text = ""
            # Penting: TXT stream adalah biner, perlu di-decode.
            # Reset stream position sebelum mencoba membaca dengan encoding berbeda
            file_stream.seek(0) # Kembali ke awal stream biner
            for enc in encodings_to_try:
                try:
                    # Gunakan io.TextIOWrapper untuk membaca stream biner sebagai teks
                    # errors='ignore' akan mengabaikan karakter yang tidak valid pada encoding yang dicoba
                    stream_wrapper = io.TextIOWrapper(file_stream, encoding=enc, errors='ignore')
                    text = stream_wrapper.read()
                    print(f"  Berhasil membaca TXT dengan encoding: {enc}")
                    read_success = True
                    break # Keluar dari loop jika berhasil
                except Exception as e: # Tangkap exception lain seperti ValueError dari TextIOWrapper
                     print(f"  Gagal membaca TXT dengan encoding {enc} atau error lain: {e}")
                     # Reset stream position untuk percobaan berikutnya atau re-raise
                     file_stream.seek(0)
                     continue # Lanjut ke encoding berikutnya
            if not read_success:
                 raise ValueError("Gagal membaca file TXT stream dengan encoding yang dicoba.")


        # --- Tipe File Tidak Didukung ---
        else:
            raise ValueError(f"Tipe file tidak didukung: '{os.path.splitext(filename)[1]}'. Didukung: .pdf, .docx, .txt")

        print(f"Ekstraksi teks dari stream {filename} selesai.")
        # Penting: Reset stream position ke awal sebelum keluar fungsi,
        # jika stream ini mungkin dibaca lagi nanti. Meskipun di sini tidak, ini praktik baik.
        try: file_stream.seek(0)
        except Exception: pass # Abaikan jika seek tidak didukung/gagal pada stream

        return text.strip() # Kembalikan teks yang sudah dibersihkan dari spasi di awal/akhir

    # --- Penanganan Error Khusus Ekstraksi ---
    except PyPDF2.errors.PdfReadError as e:
         print(f"Error membaca struktur PDF dari stream {filename}: {e}")
         # Reset stream position sebelum return error
         try: file_stream.seek(0)
         except Exception: pass
         return f"[Error: Gagal membaca struktur PDF dari stream - {e}]"
    except Exception as e:
        # Tangkap error lain selama ekstraksi teks (misal docx error, io error pada stream)
        print(f"Error tidak terduga saat ekstraksi teks dari stream: {e}")
        traceback.print_exc()
        # Reset stream position sebelum re-raise
        try: file_stream.seek(0)
        except Exception: pass
        # Lempar ulang error umum dengan pesan yang lebih informatif
        # Ini akan ditangkap oleh except IOError di route /generate-soal
        raise IOError(f"Gagal mengekstrak teks dari file stream: {e}")


# Fungsi untuk membuat prompt untuk API Gemini
def create_gemini_prompt(text_content, difficulty, num_questions, question_type):
    """Membuat prompt terstruktur untuk API Gemini berdasarkan parameter."""
    print(f"Membuat prompt: Kesulitan='{difficulty}', Jumlah='{num_questions}', Tipe='{question_type}'")

    # Menyesuaikan instruksi jenis soal
    type_instruction = ""
    if question_type == 'pilihan_ganda':
        type_instruction = "Buatlah pertanyaan dengan 4 opsi jawaban (a, b, c, d), dimana HANYA SATU jawaban yang benar berdasarkan teks sumber. Tandai jawaban yang benar dalam output JSON dengan tepat."
    elif question_type == 'esai':
        type_instruction = "Buatlah pertanyaan terbuka yang membutuhkan jawaban penjelasan singkat (1-3 kalimat) berdasarkan teks sumber."
    elif question_type == 'benar_salah':
        type_instruction = "Buatlah pernyataan berdasarkan teks sumber dan tanyakan apakah pernyataan itu Benar atau Salah. Jawaban benar harus tepat 'Benar' atau 'Salah'."
    else: # Campuran / Variatif
        type_instruction = "Buatlah kombinasi dari jenis soal pilihan ganda, esai singkat, dan benar/salah. Tentukan jenisnya dengan tepat di output JSON."

    # Prompt utama
    prompt = f"""
PERAN: Anda adalah AI ahli pembuat soal ujian berdasarkan materi pelajaran.
TUGAS: Buat soal HANYA berdasarkan teks sumber yang diberikan.

TEKS SUMBER:
---
{text_content}
---

INSTRUKSI PEMBUATAN SOAL:
1. Buatlah tepat **{num_questions}** buah soal.
2. Tingkat kesulitan soal harus **{difficulty}**.
3. Prioritaskan jenis soal **{question_type}**. {type_instruction}
4. **KRUSIAL**: Semua soal dan jawabannya harus berasal secara eksplisit atau implisit HANYA dari TEKS SUMBER. Jangan gunakan pengetahuan eksternal sama sekali.
5. Soal harus jelas, tidak ambigu, dan relevan dengan konten utama teks sumber.
6. Untuk pilihan ganda, pastikan hanya ada 4 opsi (a,b,c,d). Jawaban benar harus sama persis dengan salah satu opsi yang dibuat.

FORMAT OUTPUT (WAJIB):
Kembalikan respons HANYA dalam format **JSON List** yang valid. TIDAK BOLEH ada teks lain (seperti penjelasan, sapaan, atau ```json``` markup) SEBELUM atau SESUDAH JSON list.
Setiap elemen dalam list adalah object JSON yang merepresentasikan satu soal dengan struktur WAJIB berikut:
{{
  "question_text": "String teks pertanyaan",
  "question_type": "String jenis soal ('pilihan_ganda', 'esai', 'benar_salah')",
  "options": [ "String Opsi A", "String Opsi B", "String Opsi C", "String Opsi D" ], // Array string (kosong [] jika bukan pilihan ganda)
  "correct_answer": "String jawaban benar" // Teks opsi benar (untuk pilihan ganda), atau "Benar"/"Salah" (untuk benar/salah), atau string jawaban singkat (untuk esai)
}}

Contoh JSON List yang valid:
[
  {{"question_text": "Contoh pertanyaan PG?", "question_type": "pilihan_ganda", "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"], "correct_answer": "Opsi A"}},
  {{"question_text": "Contoh pertanyaan Esai?", "question_type": "esai", "options": [], "correct_answer": "Jawaban singkatnya adalah ini."}},
  {{"question_text": "Contoh pernyataan Benar/Salah?", "question_type": "benar_salah", "options": [], "correct_answer": "Benar"}}
]

Mulai pembuatan soal sekarang.
"""
    # print("--- PROMPT UNTUK GEMINI (AWAL) ---")
    # print(prompt[:500] + "\n...") # Debug: Cetak sebagian prompt
    # print("--- AKHIR PROMPT ---")
    return prompt

# Fungsi untuk memanggil API Gemini dan memproses respons
def call_gemini_api(prompt):
    """Memanggil API Gemini, menangani respons, dan mem-parse JSON.
       Mengembalikan list soal (list of dicts) atau dictionary error.
    """
    if not model:
        print("Error Kritis: Model Gemini tidak terinisialisasi saat dipanggil.")
        # Mengembalikan dictionary error agar bisa ditangani di route caller
        return {"error": "Layanan AI tidak siap. Model tidak terinisialisasi."}

    if not genai_configured:
        print("Error Kritis: Konfigurasi Google AI tidak berhasil saat dipanggil.")
        return {"error": "Layanan AI tidak siap. Konfigurasi gagal."}

    try:
        print("Mengirim request ke Gemini API...")
        # Konfigurasi parameter generasi (sesuaikan sesuai kebutuhan)
        generation_config = genai.types.GenerationConfig(
            temperature=0.7, # Kreativitas (0.0 - 1.0). 0.7 cukup seimbang.
            top_p=1.0,
            top_k=30,
            max_output_tokens=4096 # Batasi panjang respons jika perlu, 4096 cukup besar untuk banyak soal.
        )
        # Anda juga bisa menambahkan safety_settings jika perlu.

        # Memanggil model Gemini
        response = model.generate_content(
            prompt,
            generation_config=generation_config,
            # safety_settings=safety_settings # Jika digunakan
            request_options={"timeout": 180} # Tambahkan timeout (detik) untuk request yang lama
        )

        print("Menerima respons dari Gemini API.")

        # Periksa apakah respons diblokir oleh filter keamanan Google
        if not response.candidates:
             print("Error: Respons AI diblokir atau kosong (tidak ada kandidat).")
             print("Prompt Feedback:", response.prompt_feedback)
             block_reason = "Tidak diketahui"
             if response.prompt_feedback and response.prompt_feedback.block_reason:
                  block_reason = response.prompt_feedback.block_reason
                  # print("Detail Blocking:", response.prompt_feedback.block_reason_message) # Opsional: log pesan detail
             # Mengembalikan dictionary error
             return {"error": f"Permintaan ke AI diblokir. Alasan: {block_reason}. Mohon coba lagi atau sesuaikan teks sumber/instruksi."}

        # --- Pemrosesan dan Parsing Respons ---
        response_text = ""
        try:
            # Coba ambil teks dari atribut .text (cara paling umum)
            response_text = response.text
            # Jika .text kosong, coba ambil dari candidates[0].content.parts
            if not response_text and response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                 # Gabungkan teks dari semua part dalam kandidat pertama
                 response_text = "".join([part.text for part in response.candidates[0].content.parts if part.text])
                 print("Mengambil teks dari response.candidates[0].content.parts")

            if not response_text:
                 # Jika teks respons tetap kosong setelah mencoba
                 print("Error: Respons teks dari AI kosong.")
                 return {"error": "Respons dari AI kosong atau tidak berisi teks."}

            # print("Respons Teks Mentah (awal):", response_text[:500] + "...") # Debug log

            # Membersihkan teks respons jika terbungkus markdown JSON (```json ... ```)
            cleaned_text = response_text.strip()
            # Hapus ```json di awal jika ada
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            # Hapus ``` di akhir jika ada
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
            cleaned_text = cleaned_text.strip() # Bersihkan spasi lagi

            # Handle kasus di mana AI mungkin hanya mengembalikan ```
            if cleaned_text.startswith("```"):
                cleaned_text = cleaned_text[3:].strip()
                if cleaned_text.endswith("```"):
                     cleaned_text = cleaned_text[:-3].strip()

            # Coba parse teks yang sudah dibersihkan sebagai JSON
            parsed_json = json.loads(cleaned_text)

            # Validasi sederhana: pastikan hasil parse adalah sebuah list
            if not isinstance(parsed_json, list):
                 print("Error: Respons AI bukan format JSON List.")
                 print("Teks setelah dibersihkan:", cleaned_text)
                 # Mengembalikan dictionary error
                 return {"error": "AI tidak mengembalikan format JSON List yang diharapkan. Respons: " + cleaned_text[:200]} # Beri sedikit cuplikan respons

            print(f"Respons berhasil di-parse sebagai JSON List ({len(parsed_json)} item).")
            return parsed_json # Sukses: mengembalikan list of dicts (soal)

        except json.JSONDecodeError as json_err:
            print(f"Error Kritis: Gagal mem-parse respons Gemini sebagai JSON: {json_err}")
            print("Respons Teks Mentah Lengkap (jika ada):", response_text if response_text else "Respons teks kosong/tidak tersedia")
            # Mengembalikan dictionary error
            return {"error": f"Gagal mem-parse respons AI sebagai JSON yang valid: {json_err}. Respons: {response_text[:200]}..."}

        except Exception as resp_err:
             # Tangkap error lain saat memproses teks respons (misal: AttributeError pada object respons)
             print(f"Error saat memproses teks respons Gemini: {resp_err}")
             traceback.print_exc()
             # Mengembalikan dictionary error
             return {"error": f"Terjadi kesalahan saat memproses respons dari AI: {resp_err}"}

    except Exception as api_err:
        # Tangkap error umum saat memanggil generate_content (misal: koneksi, timeout API, authentication)
        print(f"Error Kritis saat memanggil Gemini API: {api_err}")
        traceback.print_exc()
        # Mengembalikan dictionary error
        return {"error": f"Gagal menghubungi layanan AI: {api_err}. Pastikan GOOGLE_API_KEY valid dan layanan aktif."}


# === ROUTE FLASK ===

@app.route('/')
def serve_index():
    """Menyajikan halaman HTML utama."""
    # render_template akan mencari index.html di folder 'templates' secara default
    # Pastikan index.html ada di dalam sub-folder bernama 'templates'
    return render_template('index.html')

# Route utama untuk generate soal
@app.route('/generate-soal', methods=['POST'])
def generate_questions_api():
    """Endpoint utama untuk menerima file, memproses, dan menghasilkan soal."""
    print("\n--- Menerima Request Baru di /generate-soal ---")

    # 1. Validasi File Upload dari request.files
    # request.files adalah dictionary dari objek FileStorage
    if 'moduleFile' not in request.files:
        print("Error: Bagian file 'moduleFile' tidak ditemukan dalam request.files.")
        return jsonify({"error": "Bagian file ('moduleFile') tidak ditemukan dalam request."}), 400

    file_storage_object = request.files['moduleFile'] # Ini adalah objek FileStorage dari Werkzeug

    if not file_storage_object or file_storage_object.filename == '':
        print("Error: Objek file kosong atau nama file kosong.")
        return jsonify({"error": "Tidak ada file yang dipilih."}), 400

    # Ambil nama file dari objek FileStorage
    original_filename = file_storage_object.filename
    # Jika perlu sanitasi nama file (untuk alasan keamanan atau konsistensi log)
    # sanitized_filename = secure_filename(original_filename)

    extracted_text = ""
    generated_questions = [] # Inisialisasi list soal kosong
    error_from_processing = None # Untuk menyimpan pesan error dari helper functions

    try:
        # *** LANGSUNG EKSTRAKSI TEKS DARI OBJEK FILE (STREAM) ***
        # TIDAK PERLU MENYIMPAN FILE KE DISK SAMA SEKALI DI VERCEL.
        print(f"Mengekstrak teks langsung dari stream objek FileStorage: {original_filename}")
        # Panggil fungsi ekstraksi, passing objek FileStorage dan nama file
        # Fungsi ini akan melempar IOError atau ValueError jika gagal total,
        # atau mengembalikan string error format "[Error: ...]" jika gagal parsial (misal PDF terenkripsi).
        extracted_text = extract_text_from_file(file_storage_object, original_filename)

        # Cek hasil ekstraksi teks. Jika ada string error atau teks kosong:
        if not extracted_text or extracted_text.startswith("[Error:"):
             error_msg = f"Tidak dapat membuat soal karena tidak ada teks valid diekstrak dari file '{original_filename}'. "
             if extracted_text.startswith("[Error:"):
                 # Jika fungsi extract_text_from_file mengembalikan pesan error format [Error:...], gunakan itu
                 error_msg = extracted_text # Gunakan pesan error yang dikembalikan dari helper
             else:
                 error_msg += "Pastikan file tidak kosong, tidak terenkripsi, dan berisi teks yang dapat dibaca."
             print(f"Error Ekstraksi Teks: {error_msg}")
             # Kembalikan error ke frontend dengan status 400
             return jsonify({"error": error_msg}), 400

        print(f"Ekstraksi teks berhasil, jumlah karakter: {len(extracted_text)}")

        # 2. Ambil Parameter Form dari request.form
        # Default values disesuaikan dengan UI atau kebutuhan
        difficulty = request.form.get('difficulty', 'sedang')
        question_type = request.form.get('questionType', 'campuran')
        # start_page = request.form.get('startPage') # Diambil tapi belum diimplementasikan di ekstraksi
        # end_page = request.form.get('endPage')     # Diambil tapi belum diimplementasikan

        # Ambil dan validasi jumlah soal
        num_questions_str = request.form.get('numQuestions', '10') # Default '10' sesuai UI
        num_questions = 10 # Default jika konversi gagal
        try:
             num_questions = int(num_questions_str)
             # Batasi jumlah soal sesuai batasan UI (misal 1-50)
             if num_questions <= 0:
                  num_questions = 1 # Minimal 1 soal
             if num_questions > 50:
                  num_questions = 50 # Maksimal 50 soal (disesuaikan dengan prompt dan model capability)
        except ValueError:
             print(f"Peringatan: Nilai numQuestions '{num_questions_str}' tidak valid. Menggunakan default 10.")
             # num_questions tetap 10 dari nilai default awal

        print(f"Parameter diterima: Diff='{difficulty}', Num='{num_questions}', Type='{question_type}'") # start/end page log opsional

        # 3. Buat Prompt dan Panggil Gemini
        # Cek lagi apakah model AI siap sebelum memanggil
        if not model or not genai_configured:
             print("Error Layanan AI: Model tidak terinisialisasi atau konfigurasi AI gagal (cek sebelum panggil AI).")
             return jsonify({"error": "Layanan AI tidak terkonfigurasi atau tidak siap. Mohon coba lagi nanti."}), 503 # Status 503 Service Unavailable

        # Buat prompt menggunakan teks yang diekstrak dan parameter
        prompt = create_gemini_prompt(extracted_text, difficulty, num_questions, question_type)

        # Panggil fungsi AI. Fungsi ini mengembalikan list soal ATAU dictionary {"error": "Pesan error"}
        gemini_response_data = call_gemini_api(prompt)

        # Cek apakah hasil dari call_gemini_api adalah error dictionary
        if isinstance(gemini_response_data, dict) and "error" in gemini_response_data:
            print(f"Error dari call_gemini_api: {gemini_response_data['error']}")
            # Kembalikan error dari AI ke frontend dengan status yang sesuai (misal 500 Internal Server Error)
            # Anda bisa menyesuaikan status code berdasarkan jenis error dari AI jika perlu
            return jsonify({"error": f"Proses pembuatan soal oleh AI gagal: {gemini_response_data['error']}"}), 500
        else:
            # Jika tidak ada error dictionary, asumsikan hasilnya adalah list soal
            generated_questions = gemini_response_data
            print(f"Call to Gemini API berhasil, {len(generated_questions)} soal dihasilkan.")

        # 4. Kirim Hasil ke Frontend
        # Sertakan pesan sukses yang lebih spesifik
        success_message = f"Berhasil membuat {len(generated_questions)} soal dari file '{original_filename}'."
        if len(generated_questions) == 0:
             # Beri pesan berbeda jika AI tidak menghasilkan soal (meskipun tidak ada error teknis)
             success_message = f"Proses selesai, namun AI tidak dapat membuat soal dari file '{original_filename}'. Mungkin teks terlalu sedikit, tidak relevan, atau respons AI kosong."

        return jsonify({
            "message": success_message,
            "questions": generated_questions
        })

    # --- Penanganan Error Terstruktur ---
    # Tangkap exception yang dilempar dari helper functions atau error lain di route ini
    # Error FileNotFoundError (karena tidak ada penyimpanan file) tidak relevan lagi.
    # Error I/O File (IOError) sekarang menangani kegagalan membaca dari stream di fungsi extract_text_from_file.
    except (ValueError, IOError) as e: # Tangkap ValueError dari validasi form atau IOError dari ekstraksi teks stream
         error_message = str(e)
         print(f"Error Data/Format/I/O Stream: {error_message}")
         # Mengembalikan error ke frontend dengan status 400 (Bad Request) atau 500 (Internal Server Error)
         status_code = 400 if isinstance(e, ValueError) else 500
         return jsonify({"error": f"Gagal memproses file atau data: {error_message}"}), status_code
    # Exception ConnectionError dari call_gemini_api sekarang ditangani *di dalam* fungsi itu sendiri
    # dan mengembalikan dictionary error, yang kemudian ditangkap di bagian 'if isinstance(gemini_response_data, dict)' di atas.
    # Jadi, kita tidak perlu try/except ConnectionError di sini lagi untuk kasus dari call_gemini_api.

    except Exception as e:
        # Tangkap error tidak terduga lainnya yang mungkin terjadi di route ini
        print(f"Error Internal Tidak Terduga di /generate-soal: {e}")
        traceback.print_exc() # Cetak detail error di log server (berguna untuk debugging)
        # Jangan tampilkan detail traceback ke user di produksi untuk keamanan
        return jsonify({"error": "Terjadi kesalahan internal tidak terduga di server. Silakan coba lagi."}), 500

    # Blok finally di sini tidak terlalu dibutuhkan karena tidak ada resource yang perlu dibersihkan
    # seperti file temporer setelah perbaikan membaca dari stream.
    # finally:
    #     pass


# Tambahkan rute untuk melayani file statis secara langsung jika WhiteNoise tidak berfungsi sempurna,
# ATAU jika Anda ingin cara fallback. WhiteNoise seharusnya sudah cukup.
# @app.route('/static/<path:filename>')
# def static_files(filename):
#     # send_from_directory akan mencari filename di dalam direktori 'static' di root proyek
#     # Pastikan folder static ter inklusi dalam build Vercel.
#     return send_from_directory('static', filename)


# === Menjalankan Aplikasi ===
if __name__ == '__main__':
    # Blok ini hanya berjalan saat file ini dieksekusi langsung (misal: python app.py)
    # Di Vercel, aplikasi dijalankan oleh server web (misal gunicorn) menggunakan `app` WSGI object.
    # Jadi, kode di dalam `if __name__ == '__main__':` tidak dieksekusi di Vercel.

    # Untuk menjalankan secara lokal
    # Ambil port dari environment variable jika ada, default 5000
    port = int(os.environ.get("PORT", 5000))
    # host='0.0.0.0' diperlukan agar bisa diakses dari luar localhost jika run di container/VM
    # debug=False untuk produksi (tidak menampilkan traceback error ke browser)
    app.run(debug=False, host='0.0.0.0', port=port)

# --- END OF FILE app.py ---