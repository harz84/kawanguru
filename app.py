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
genai_configured = False # Default
if not GOOGLE_API_KEY:
    print("FATAL ERROR: GOOGLE_API_KEY tidak ditemukan di environment variables atau file .env!")
else:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        print("Google Generative AI Dikonfigurasi.")
        genai_configured = True
    except Exception as e:
        print(f"ERROR: Gagal mengkonfigurasi Google Generative AI: {e}")

# Inisialisasi Model Gemini (hanya jika konfigurasi berhasil)
model = None
if genai_configured:
    try:
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        print(f"Model Gemini '{model.model_name}' berhasil diinisialisasi.")
    except Exception as e:
        print(f"ERROR: Gagal menginisialisasi model Gemini: {e}")

# Impor library lain yang diperlukan
from whitenoise import WhiteNoise # Pastikan ini diimpor
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import PyPDF2
import docx

# ===========================================================
# === Inisialisasi Aplikasi Flask (HANYA SATU KALI) ===
# ===========================================================
app = Flask(__name__)
# ===========================================================


# --- Konfigurasi WhiteNoise ---
# Pastikan ini ada SETELAH inisialisasi app = Flask(__name__)
# Menempel ke app.wsgi_app dari instance app yang benar
print("Mengkonfigurasi WhiteNoise...")
try:
    # 'root' adalah path relatif dari app.py ke folder static
    app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='/static/')
    # Tambahkan dukungan kompresi jika brotli diinstal (opsional, hapus jika bermasalah)
    app.wsgi_app.add_files('static/', prefix='/static/')
    print("WhiteNoise dikonfigurasi untuk menyajikan dari folder 'static/' pada prefix '/static/'.")
except Exception as wn_error:
    print(f"ERROR saat konfigurasi WhiteNoise: {wn_error}")
# -----------------------------


# --- Konfigurasi Folder Upload ---
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
print(f"Folder upload dikonfigurasi di: {UPLOAD_FOLDER}")


# === FUNGSI HELPER ===

def extract_text_from_file(filepath):
    # ... (Kode fungsi ini tetap sama, tidak perlu diubah) ...
    # Pastikan seluruh definisi fungsi extract_text_from_file ada di sini
    text = ""
    filename = os.path.basename(filepath)
    print(f"Memulai ekstraksi teks dari: {filename}")
    try:
        # ... (Logika PDF, DOCX, TXT) ...
        print(f"Ekstraksi teks dari {filename} selesai.")
        return text.strip()
    except FileNotFoundError: # ... (Error handling sama) ...
    except PyPDF2.errors.PdfReadError as e: # ... (Error handling sama) ...
    except Exception as e: # ... (Error handling sama) ...
        print(f"Error tidak terduga saat ekstraksi teks: {e}")
        traceback.print_exc()
        raise

def create_gemini_prompt(text_content, difficulty, num_questions, question_type):
    # ... (Kode fungsi ini tetap sama, tidak perlu diubah) ...
    # Pastikan seluruh definisi fungsi create_gemini_prompt ada di sini
    print(f"Membuat prompt: Kesulitan='{difficulty}', Jumlah='{num_questions}', Tipe='{question_type}'")
    # ... (Logika pembuatan prompt) ...
    return prompt

def call_gemini_api(prompt):
    # ... (Kode fungsi ini tetap sama, tidak perlu diubah) ...
    # Pastikan seluruh definisi fungsi call_gemini_api ada di sini
    if not model or not genai_configured: # ... (cek model dan config) ...
    try:
        print("Mengirim request ke Gemini API...")
        # ... (Panggil model.generate_content) ...
        print("Menerima respons dari Gemini API.")
        # ... (Parsing JSON respons) ...
        print(f"Respons berhasil di-parse sebagai JSON List ({len(parsed_json)} item).")
        return parsed_json
    except Exception as api_err: # ... (Error handling sama) ...
        print(f"Error Kritis saat memanggil Gemini API: {api_err}")
        traceback.print_exc()
        raise ConnectionError(f"Gagal menghubungi layanan AI: {api_err}")

# === ROUTE FLASK ===

@app.route('/')
def serve_index():
    """Menyajikan halaman HTML utama."""
    print("Request diterima untuk route: /")
    return render_template('index.html')

@app.route('/generate-soal', methods=['POST'])
def generate_questions_api():
    """Endpoint utama untuk menerima file, memproses, dan menghasilkan soal."""
    print("\n--- Menerima Request Baru di /generate-soal ---")

    # 1. Validasi File Upload (Sama)
    if 'moduleFile' not in request.files: # ... (return error) ...
    file = request.files['moduleFile']
    if not file or file.filename == '': # ... (return error) ...

    # 2. Simpan File & Ekstrak Teks (Sama)
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    extracted_text = ""

    try:
        # Simpan file (Meskipun di Vercel ini ephemeral)
        # Diperlukan agar extract_text_from_file bisa membacanya
        file.save(filepath)
        print(f"File '{filename}' disimpan (sementara) di: {filepath}")
        extracted_text = extract_text_from_file(filepath)

        if not extracted_text or "[Error:" in extracted_text: # ... (return error) ...

        print(f"Ekstraksi teks berhasil, jumlah karakter: {len(extracted_text)}")

        # 3. Ambil Parameter Form (Sama)
        difficulty = request.form.get('difficulty', 'sedang')
        num_questions = request.form.get('numQuestions', '5')
        question_type = request.form.get('questionType', 'campuran')
        print(f"Parameter diterima: Diff='{difficulty}', Num='{num_questions}', Type='{question_type}'")

        # 4. Buat Prompt dan Panggil Gemini (Sama)
        if not model or not genai_configured: # ... (return error) ...
        prompt = create_gemini_prompt(extracted_text, difficulty, num_questions, question_type)
        generated_questions = call_gemini_api(prompt)

        print(f"Proses AI selesai, {len(generated_questions)} soal dihasilkan.")

        # 5. Kirim Hasil ke Frontend (Sama)
        return jsonify({
            "message": f"Berhasil membuat {len(generated_questions)} soal dari file '{filename}'.",
            "questions": generated_questions
        })

    # --- Penanganan Error Terstruktur (Sama) ---
    except ValueError as ve: # ... (return error) ...
    except ConnectionError as ce: # ... (return error) ...
    except IOError as ioe: # ... (return error) ...
    except Exception as e: # ... (return error) ...
        print(f"Error Internal Tidak Terduga: {e}")
        traceback.print_exc()
        return jsonify({"error": "Terjadi kesalahan internal tidak terduga di server."}), 500
    finally:
        # Hapus file dari /tmp (lokasi tulis Vercel) setelah selesai
        if os.path.exists(filepath):
            try:
                # Vercel seringkali menulis ke /tmp bukan direktori lokal
                # Meskipun kita menentukan UPLOAD_FOLDER, save() mungkin dialihkan ke /tmp
                # Coba hapus dari path asli dan path /tmp jika memungkinkan
                tmp_filepath = os.path.join('/tmp', filename) # Path potensial di Vercel
                
                if os.path.exists(filepath):
                     os.remove(filepath)
                     print(f"File upload '{filepath}' dihapus.")
                elif os.path.exists(tmp_filepath):
                     os.remove(tmp_filepath)
                     print(f"File upload '{tmp_filepath}' dihapus.")
                     
            except Exception as del_err:
                print(f"Gagal menghapus file upload '{filename}': {del_err}")


# === Menjalankan Aplikasi ===
# Baris ini TIDAK akan digunakan oleh Gunicorn/Vercel, tapi bagus untuk lokal
if __name__ == '__main__':
    # Jalankan dengan debug=True HANYA untuk testing lokal
    print("Menjalankan server Flask development lokal...")
    app.run(debug=True, host='0.0.0.0', port=5000) 