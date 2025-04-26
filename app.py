import os
import json
import traceback # Untuk logging error detail

# Muat environment variables (terutama API Key)
from dotenv import load_dotenv
load_dotenv()

# Konfigurasi Google Generative AI
import google.generativeai as genai
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Validasi dan konfigurasi API Key
if not GOOGLE_API_KEY:
    print("FATAL ERROR: GOOGLE_API_KEY tidak ditemukan di environment variables atau file .env!")
    # Pertimbangkan exit() atau raise Exception jika API Key wajib
    # exit("API Key Google diperlukan untuk menjalankan fitur AI.")
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
        # Sesuaikan nama model jika perlu (misal 'gemini-1.0-pro')
        model = genai.GenerativeModel('gemini-1.5-pro-latest') 
        print(f"Model Gemini '{model.model_name}' berhasil diinisialisasi.")
    except Exception as e:
        print(f"ERROR: Gagal menginisialisasi model Gemini: {e}")
        model = None # Tetap None jika gagal inisialisasi

# Impor library lain yang diperlukan
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import PyPDF2
import docx

# Inisialisasi Aplikasi Flask
app = Flask(__name__)

# Konfigurasi Folder Upload
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# === FUNGSI HELPER ===

def extract_text_from_file(filepath):
    """Mengekstrak teks dari file (PDF, DOCX, TXT) berdasarkan ekstensinya."""
    text = ""
    filename = os.path.basename(filepath)
    print(f"Memulai ekstraksi teks dari: {filename}")

    try:
        # --- Penanganan PDF ---
        if filename.lower().endswith('.pdf'):
            with open(filepath, 'rb') as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                num_pages = len(reader.pages)
                print(f"  -> PDF terdeteksi ({num_pages} halaman).")
                if reader.is_encrypted:
                     print(f"  Peringatan: PDF {filename} terenkripsi.")
                     # return "[Error: PDF terenkripsi, tidak bisa diekstrak]" # Opsional

                for page_num in range(num_pages):
                    try:
                        page = reader.pages[page_num]
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                        # else:
                        #    print(f"  Info: Halaman {page_num + 1} tidak ada teks (mungkin gambar).")
                    except Exception as page_error:
                         print(f"  Error saat memproses halaman {page_num + 1} PDF: {page_error}")
                         text += f"\n[Error halaman {page_num + 1}]\n"

                if not text.strip():
                     print(f"  Peringatan: Tidak ada teks diekstrak dari PDF {filename}.")

        # --- Penanganan DOCX ---
        elif filename.lower().endswith('.docx'):
            print("  -> DOCX terdeteksi.")
            doc = docx.Document(filepath)
            full_text = [para.text for para in doc.paragraphs if para.text]
            text = '\n'.join(full_text)

        # --- Penanganan TXT ---
        elif filename.lower().endswith('.txt'):
            print("  -> TXT terdeteksi.")
            encodings_to_try = ['utf-8', 'latin-1', 'windows-1252']
            read_success = False
            for enc in encodings_to_try:
                try:
                    with open(filepath, 'r', encoding=enc) as txt_file:
                        text = txt_file.read()
                    print(f"  Berhasil membaca TXT dengan encoding: {enc}")
                    read_success = True
                    break
                except UnicodeDecodeError:
                    print(f"  Gagal membaca TXT dengan encoding {enc}, mencoba berikutnya...")
                    continue
                except Exception as e:
                    raise IOError(f"Error membaca file TXT: {e}") # Lempar error I/O lain
            if not read_success:
                 raise ValueError("Gagal membaca file TXT dengan encoding yang dicoba.")

        # --- Tipe File Tidak Didukung ---
        else:
            raise ValueError(f"Tipe file tidak didukung: {os.path.splitext(filename)[1]}")

        print(f"Ekstraksi teks dari {filename} selesai.")
        return text.strip()

    except FileNotFoundError:
        print(f"Error Fatal: File tidak ditemukan di {filepath}")
        raise # Lempar ulang
    except PyPDF2.errors.PdfReadError as e:
         print(f"Error membaca struktur PDF {filename}: {e}")
         return f"[Error: Gagal membaca struktur PDF - {e}]"
    except Exception as e:
        print(f"Error tidak terduga saat ekstraksi teks: {e}")
        traceback.print_exc()
        raise # Lempar ulang error umum

def create_gemini_prompt(text_content, difficulty, num_questions, question_type):
    """Membuat prompt terstruktur untuk API Gemini."""
    print(f"Membuat prompt: Kesulitan='{difficulty}', Jumlah='{num_questions}', Tipe='{question_type}'")

    # Menyesuaikan instruksi jenis soal
    type_instruction = ""
    if question_type == 'pilihan_ganda':
        type_instruction = "Buatlah pertanyaan dengan 4 opsi jawaban (a, b, c, d), dimana HANYA SATU jawaban yang benar berdasarkan teks sumber. Tandai jawaban yang benar dalam output JSON."
    elif question_type == 'esai':
        type_instruction = "Buatlah pertanyaan terbuka yang membutuhkan jawaban penjelasan singkat (1-3 kalimat) berdasarkan teks sumber."
    elif question_type == 'benar_salah':
        type_instruction = "Buatlah pernyataan berdasarkan teks sumber dan tanyakan apakah pernyataan itu Benar atau Salah."
    else: # Campuran / Variatif
        type_instruction = "Buatlah kombinasi dari jenis soal pilihan ganda, esai singkat, dan benar/salah."

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
4. **KRUSIAL**: Semua soal dan jawabannya harus berasal secara eksplisit atau implisit HANYA dari TEKS SUMBER. Jangan gunakan pengetahuan eksternal.
5. Soal harus jelas, tidak ambigu, dan relevan dengan konten utama teks sumber.

FORMAT OUTPUT (WAJIB):
Kembalikan respons HANYA dalam format **JSON List** yang valid. TIDAK BOLEH ada teks lain sebelum atau sesudah JSON list.
Setiap elemen dalam list adalah object JSON yang merepresentasikan satu soal dengan struktur WAJIB berikut:
{{
  "question_text": "String teks pertanyaan",
  "question_type": "String jenis soal ('pilihan_ganda', 'esai', 'benar_salah')",
  "options": [ "String Opsi A", "String Opsi B", "String Opsi C", "String Opsi D" ], // Array string (kosong jika bukan pilihan ganda)
  "correct_answer": "String jawaban benar" // Teks opsi benar (untuk pilihan ganda), atau "Benar"/"Salah" (untuk benar/salah), atau string kosong "" (untuk esai)
}}

Contoh JSON List yang valid:
[
  {{"question_text": "Contoh pertanyaan PG?", "question_type": "pilihan_ganda", "options": ["A", "B", "C", "D"], "correct_answer": "A"}},
  {{"question_text": "Contoh pertanyaan Esai?", "question_type": "esai", "options": [], "correct_answer": ""}},
  {{"question_text": "Contoh pernyataan Benar/Salah?", "question_type": "benar_salah", "options": [], "correct_answer": "Benar"}}
]

Mulai pembuatan soal sekarang.
"""
    # print("--- PROMPT UNTUK GEMINI (AWAL) ---")
    # print(prompt[:500] + "...") # Debug: Cetak sebagian prompt
    # print("--- AKHIR PROMPT ---")
    return prompt

def call_gemini_api(prompt):
    """Memanggil API Gemini, menangani respons, dan mem-parse JSON."""
    if not model:
        print("Error Kritis: Model Gemini tidak terinisialisasi.")
        raise ConnectionError("Model AI tidak siap.")
    if not genai_configured:
        print("Error Kritis: Konfigurasi Google AI tidak berhasil.")
        raise ConnectionError("Konfigurasi AI gagal.")

    try:
        print("Mengirim request ke Gemini API...")
        # Konfigurasi keamanan (opsional, sesuaikan sesuai kebutuhan)
        # safety_settings = [
        #     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        #     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        #     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        #     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        # ]
        generation_config = genai.types.GenerationConfig(
            # temperature=0.7, # Atur kreativitas (0.0 - 1.0)
            # max_output_tokens=2048 # Batasi panjang respons jika perlu
        )
        
        response = model.generate_content(
            prompt, 
            generation_config=generation_config,
            # safety_settings=safety_settings
            )

        print("Menerima respons dari Gemini API.")
        
        # --- Pemrosesan dan Parsing Respons ---
        try:
            response_text = response.text
            # print("Respons Teks Mentah (awal):", response_text[:500] + "...")

            # Membersihkan jika terbungkus markdown JSON
            cleaned_text = response_text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:] # Hapus ```json
                if cleaned_text.endswith("```"):
                    cleaned_text = cleaned_text[:-3] # Hapus ```
                cleaned_text = cleaned_text.strip()

            # Coba parse sebagai JSON
            parsed_json = json.loads(cleaned_text)

            # Validasi sederhana apakah hasilnya list
            if not isinstance(parsed_json, list):
                 print("Error: Respons AI bukan format JSON List.")
                 print("Teks setelah dibersihkan:", cleaned_text)
                 raise ValueError("AI tidak mengembalikan format JSON List yang diharapkan.")

            print(f"Respons berhasil di-parse sebagai JSON List ({len(parsed_json)} item).")
            return parsed_json # Sukses mengembalikan list of dicts

        except json.JSONDecodeError as json_err:
            print(f"Error Kritis: Gagal mem-parse respons Gemini sebagai JSON: {json_err}")
            print("Respons Teks Mentah Lengkap:", response.text)
            raise ValueError(f"AI tidak mengembalikan format JSON yang valid. Respons:\n{response.text[:1000]}...")
        except AttributeError:
             print("Error: Tidak bisa mendapatkan '.text' dari respons Gemini. Cek 'response.prompt_feedback' atau 'response.candidates'.")
             if response.prompt_feedback:
                  print("Prompt Feedback:", response.prompt_feedback)
                  if response.prompt_feedback.block_reason:
                       raise ValueError(f"Permintaan diblokir karena: {response.prompt_feedback.block_reason_message}")
             raise ValueError("Gagal mendapatkan teks dari respons AI.")
        except Exception as resp_err:
             print(f"Error saat memproses teks respons Gemini: {resp_err}")
             traceback.print_exc()
             raise ValueError(f"Gagal memproses respons dari AI: {resp_err}")

    except Exception as api_err:
        print(f"Error Kritis saat memanggil Gemini API: {api_err}")
        traceback.print_exc()
        raise ConnectionError(f"Gagal menghubungi layanan AI: {api_err}")

# === ROUTE FLASK ===

@app.route('/')
def serve_index():
    """Menyajikan halaman HTML utama."""
    return render_template('index.html')

@app.route('/generate-soal', methods=['POST'])
def generate_questions_api():
    """Endpoint utama untuk menerima file, memproses, dan menghasilkan soal."""
    print("\n--- Menerima Request Baru di /generate-soal ---")

    # 1. Validasi File Upload
    if 'moduleFile' not in request.files:
        return jsonify({"error": "Bagian file ('moduleFile') tidak ditemukan dalam request."}), 400
    file = request.files['moduleFile']
    if not file or file.filename == '':
        return jsonify({"error": "Tidak ada file yang dipilih."}), 400

    # 2. Simpan File & Ekstrak Teks
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    extracted_text = ""

    try:
        file.save(filepath)
        print(f"File '{filename}' berhasil disimpan di: {filepath}")
        extracted_text = extract_text_from_file(filepath)

        # Cek hasil ekstraksi
        if not extracted_text or "[Error:" in extracted_text:
             error_msg = f"Tidak dapat membuat soal karena tidak ada teks valid dari file '{filename}'."
             if "[Error:" in extracted_text:
                 error_msg = f"Gagal membaca file '{filename}': {extracted_text}"
             print(error_msg)
             return jsonify({"error": error_msg}), 400

        print(f"Ekstraksi teks berhasil, jumlah karakter: {len(extracted_text)}")

        # 3. Ambil Parameter Form
        difficulty = request.form.get('difficulty', 'sedang')
        num_questions = request.form.get('numQuestions', '5')
        question_type = request.form.get('questionType', 'campuran')
        # start_page = request.form.get('startPage') # Belum diimplementasikan di ekstraksi/prompt
        # end_page = request.form.get('endPage')     # Belum diimplementasikan
        print(f"Parameter diterima: Diff='{difficulty}', Num='{num_questions}', Type='{question_type}'")


        # 4. Buat Prompt dan Panggil Gemini
        if not model or not genai_configured:
             return jsonify({"error": "Layanan AI tidak terkonfigurasi atau tidak siap."}), 503

        prompt = create_gemini_prompt(extracted_text, difficulty, num_questions, question_type)
        generated_questions = call_gemini_api(prompt) # List of dicts atau raise Error

        print(f"Proses AI selesai, {len(generated_questions)} soal dihasilkan.")

        # 5. Kirim Hasil ke Frontend
        return jsonify({
            "message": f"Berhasil membuat {len(generated_questions)} soal dari file '{filename}'.",
            "questions": generated_questions
        })

    # --- Penanganan Error Terstruktur ---
    except ValueError as ve: # Error tipe file, parse JSON, dll.
         error_message = str(ve)
         print(f"Error Data/Format: {error_message}")
         return jsonify({"error": f"Kesalahan data atau format: {error_message}"}), 400
    except ConnectionError as ce: # Error koneksi ke Gemini
         error_message = str(ce)
         print(f"Error Koneksi AI: {error_message}")
         return jsonify({"error": f"Gagal menghubungi layanan AI: {error_message}"}), 503
    except IOError as ioe: # Error baca/tulis file
         error_message = str(ioe)
         print(f"Error I/O File: {error_message}")
         return jsonify({"error": f"Gagal membaca/menulis file di server: {error_message}"}), 500
    except Exception as e: # Tangkap error tidak terduga lainnya
        print(f"Error Internal Tidak Terduga: {e}")
        traceback.print_exc() # Cetak detail error di log server
        return jsonify({"error": "Terjadi kesalahan internal tidak terduga di server."}), 500
    finally:
        # Membersihkan file upload setelah diproses (opsional)
        # if os.path.exists(filepath):
        #     try:
        #         os.remove(filepath)
        #         print(f"File upload '{filepath}' dihapus.")
        #     except Exception as del_err:
        #         print(f"Gagal menghapus file upload '{filepath}': {del_err}")
        pass # Tidak ada cleanup default


# === Menjalankan Aplikasi ===
if __name__ == '__main__':
    # Port bisa diambil dari environment variable jika perlu: port=int(os.environ.get("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=5000) # debug=False untuk produksi