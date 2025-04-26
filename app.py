import os
import json
import traceback
import io # <<--- Tambahkan import ini untuk menangani stream file TXT

# Muat environment variables (terutama API Key)
# Meskipun Vercel env vars lebih utama, ini tetap baik untuk lokal/fallback
from dotenv import load_dotenv
load_dotenv()

# Konfigurasi Google Generative AI
import google.generativeai as genai
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Validasi dan konfigurasi API Key
if not GOOGLE_API_KEY:
    print("FATAL ERROR: GOOGLE_API_KEY tidak ditemukan di environment variables!")
    # Pertimbangkan exit() atau raise Exception jika API Key wajib
    # Untuk deployment Vercel, pastikan ini disetel di Settings -> Environment Variables
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
        # Menggunakan model yang lebih baru seperti 1.5-pro mungkin lebih baik
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        print(f"Model Gemini '{model.model_name}' berhasil diinisialisasi.")
    except Exception as e:
        print(f"ERROR: Gagal menginisialisasi model Gemini: {e}")
        model = None # Tetap None jika gagal inisialisasi

# Impor library lain yang diperlukan
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename # Masih berguna untuk sanitasi nama file
# from werkzeug.datastructures import FileStorage # Tipe objek file dari request.files
import PyPDF2
import docx
from whitenoise import WhiteNoise # Import WhiteNoise

# Inisialisasi Aplikasi Flask
app = Flask(__name__)

# --- KONFIGURASI WHITENOISE ---
# WhiteNoise akan menyajikan file dari folder 'static'
# Penting: root='' dan prefix='static/' jika folder static ada di root project
# Jika folder static ada di dalam aplikasi (misal 'your_app/static'), sesuaikan root
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='static/')
print("WhiteNoise dikonfigurasi untuk melayani /static/")
# --- AKHIR KONFIGURASI WHITENOISE ---


# Konfigurasi Folder Upload (folder ini TIDAK AKAN DIGUNAKAN untuk menyimpan file upload di Vercel)
# Ini hanya untuk kompatibilitas atau jika ada kebutuhan lain yang TIDAK melibatkan penyimpanan file upload.
# Baris os.makedirs() ini kemungkinan akan gagal di lingkungan read-only Vercel, tapi aplikasinya tidak crash
# selama tidak ada code yang *mencoba menulis* ke folder ini.
# UPLOAD_FOLDER = 'uploads'
# try:
#     os.makedirs(UPLOAD_FOLDER, exist_ok=True)
#     print(f"Folder '{UPLOAD_FOLDER}' tersedia (jika environment mengizinkan penulisan).")
# except Exception as e:
#     print(f"Info: Gagal membuat folder '{UPLOAD_FOLDER}' atau folder read-only: {e}")
# app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER # Variabel config ini tidak relevan lagi untuk save file


# === FUNGSI HELPER ===

# MODIFIKASI FUNGSI INI: Menerima objek file-like (stream) dan nama file
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

    # Gunakan stream biner dari objek file
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
                 # return "[Error: PDF terenkripsi, tidak bisa diekstrak]" # Opsional

            # TODO: Implementasi logika range halaman di sini jika start_page/end_page aktif
            # Halaman yang akan diproses (saat ini semua halaman)
            # start_page_idx = (int(start_page) - 1) if start_page and start_page.isdigit() else 0
            # end_page_idx = int(end_page) if end_page and end_page.isdigit() else num_pages
            # end_page_idx = min(end_page_idx, num_pages) # Pastikan tidak melebihi jumlah halaman
            # for page_num in range(start_page_idx, end_page_idx):

            for page_num in range(num_pages): # Processing all pages for now
                try:
                    page = reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                    # else:
                    #    print(f"  Info: Halaman {page_num + 1} tidak ada teks (mungkin gambar).")
                except Exception as page_error:
                     print(f"  Error saat memproses halaman {page_num + 1} PDF: {page_error}")
                     text += f"\n[Error halaman {page_num + 1}]\n" # Tambahkan placeholder error di teks

            if not text.strip():
                 print(f"  Peringatan: Tidak ada teks diekstrak dari PDF {filename}. Mungkin hanya gambar atau terenkripsi.")

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
                    stream_wrapper = io.TextIOWrapper(file_stream, encoding=enc, errors='ignore') # 'ignore' error jika ada karakter yang tidak bisa di-decode
                    text = stream_wrapper.read()
                    print(f"  Berhasil membaca TXT dengan encoding: {enc}")
                    read_success = True
                    break # Keluar dari loop jika berhasil
                except Exception as e:
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
        # jika stream ini mungkin dibaca lagi nanti (meskipun dalam kasus ini sepertinya tidak)
        try: file_stream.seek(0)
        except Exception: pass # Abaikan jika seek tidak didukung/gagal
        return text.strip()

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
        raise IOError(f"Gagal mengekstrak teks dari file stream: {e}")


# ... (create_gemini_prompt dan call_gemini_api tetap sama) ...


# === ROUTE FLASK ===

@app.route('/')
def serve_index():
    """Menyajikan halaman HTML utama."""
    # render_template akan mencari index.html di folder 'templates' secara default
    return render_template('index.html')

# MODIFIKASI ROUTE INI
@app.route('/generate-soal', methods=['POST'])
def generate_questions_api():
    """Endpoint utama untuk menerima file, memproses, dan menghasilkan soal."""
    print("\n--- Menerima Request Baru di /generate-soal ---")

    # 1. Validasi File Upload
    # request.files adalah dictionary dari FileStorage objects
    if 'moduleFile' not in request.files:
        print("Error: Kunci 'moduleFile' tidak ditemukan dalam request.files.")
        return jsonify({"error": "Bagian file ('moduleFile') tidak ditemukan dalam request."}), 400

    file_storage_object = request.files['moduleFile'] # Ini adalah objek FileStorage

    if not file_storage_object or file_storage_object.filename == '':
        print("Error: Objek file kosong atau nama file kosong.")
        return jsonify({"error": "Tidak ada file yang dipilih."}), 400

    # Gunakan nama file dari objek FileStorage (opsional disanitasi dengan secure_filename)
    original_filename = file_storage_object.filename
    # sanitized_filename = secure_filename(original_filename) # Bisa dipakai jika butuh sanitasi

    extracted_text = ""

    try:
        # *** LANGSUNG EKSTRAKSI DARI OBJEK FILE (STREAM) ***
        # Tidak perlu menyimpan file ke disk sama sekali.
        print(f"Mengekstrak teks langsung dari stream objek FileStorage: {original_filename}")
        # Pass objek FileStorage dan nama file ke fungsi ekstraksi
        extracted_text = extract_text_from_file(file_storage_object, original_filename)

        # Cek hasil ekstraksi
        if not extracted_text or "[Error:" in extracted_text:
             error_msg = f"Tidak dapat membuat soal karena tidak ada teks valid diekstrak dari file '{original_filename}'. Pastikan file tidak terenkripsi atau hanya berisi gambar."
             if "[Error:" in extracted_text:
                 # Jika fungsi extract_text_from_file mengembalikan pesan error format [Error:...], gunakan itu
                 error_msg = f"Gagal membaca file '{original_filename}': {extracted_text}"
             print(f"Error Ekstraksi Teks: {error_msg}")
             return jsonify({"error": error_msg}), 400

        print(f"Ekstraksi teks berhasil, jumlah karakter: {len(extracted_text)}")

        # 2. Ambil Parameter Form (parameter form tetap diambil seperti biasa dari request.form)
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
                  num_questions = 50 # Maksimal 50 soal
        except ValueError:
             print(f"Peringatan: Nilai numQuestions '{num_questions_str}' tidak valid. Menggunakan default 10.")
             # num_questions tetap 10 dari nilai default awal

        print(f"Parameter diterima: Diff='{difficulty}', Num='{num_questions}', Type='{question_type}'") # start/end page log opsional

        # 3. Buat Prompt dan Panggil Gemini
        if not model or not genai_configured:
             print("Error Layanan AI: Model tidak terinisialisasi atau konfigurasi AI gagal.")
             return jsonify({"error": "Layanan AI tidak terkonfigurasi atau tidak siap."}), 503

        # Pass num_questions (yang sudah divalidasi dan dikonversi int) ke prompt
        prompt = create_gemini_prompt(extracted_text, difficulty, num_questions, question_type)
        generated_questions = call_gemini_api(prompt) # List of dicts atau raise Error

        print(f"Proses AI selesai, {len(generated_questions)} soal dihasilkan.")

        # 4. Kirim Hasil ke Frontend
        # Sertakan pesan sukses yang lebih spesifik
        success_message = f"Berhasil membuat {len(generated_questions)} soal dari file '{original_filename}'."
        if len(generated_questions) == 0:
             success_message = f"Proses selesai, namun AI tidak dapat membuat soal dari file '{original_filename}'. Mungkin teks terlalu sedikit atau tidak relevan."

        return jsonify({
            "message": success_message,
            "questions": generated_questions
        })

    # --- Penanganan Error Terstruktur ---
    # Error FileNotFoundError (karena tidak ada penyimpanan file) tidak relevan lagi.
    # Error I/O File (IOError) sekarang akan menangani kegagalan membaca dari stream di fungsi extract_text_from_file.
    except ValueError as ve: # Error tipe file tidak didukung, format JSON AI, validasi data form, dll.
         error_message = str(ve)
         print(f"Error Data/Format/Validasi: {error_message}")
         return jsonify({"error": f"Kesalahan data atau format: {error_message}"}), 400
    except ConnectionError as ce: # Error koneksi ke Gemini API, model tidak siap
         error_message = str(ce)
         print(f"Error Koneksi AI: {error_message}")
         return jsonify({"error": f"Gagal menghubungi layanan AI: {error_message}"}), 503
    except IOError as ioe: # Error baca dari stream file di fungsi extract_text_from_file
         error_message = str(ioe)
         print(f"Error I/O File Stream: {error_message}")
         return jsonify({"error": f"Gagal membaca file stream di server: {error_message}"}), 500
    except Exception as e: # Tangkap error tidak terduga lainnya di route ini
        print(f"Error Internal Tidak Terduga di /generate-soal: {e}")
        traceback.print_exc() # Cetak detail error di log server
        # Jangan tampilkan detail traceback ke user di produksi
        return jsonify({"error": "Terjadi kesalahan internal tidak terduga di server."}), 500
    finally:
        # Tidak perlu lagi menghapus file upload karena tidak disimpan
        pass


# Tambahkan rute untuk melayani file statis secara langsung jika WhiteNoise tidak berfungsi sempurna,
# ATAU jika Anda ingin cara fallback. WhiteNoise seharusnya sudah cukup.
# @app.route('/static/<path:filename>')
# def static_files(filename):
#     # Ini akan melayani file dari folder 'static' di root proyek Anda
#     # Di Vercel Function, pastikan folder static ter inklusi dalam build
#     return send_from_directory('static', filename)


# === Menjalankan Aplikasi ===
if __name__ == '__main__':
    # Untuk menjalankan secara lokal
    # Vercel menentukan portnya sendiri di environment produksi
    # host='0.0.0.0' diperlukan agar bisa diakses dari luar localhost jika run di container/VM
    # debug=False untuk produksi
    port = int(os.environ.get("PORT", 5000)) # Ambil port dari env var jika ada, default 5000
    app.run(debug=False, host='0.0.0.0', port=port)