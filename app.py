# Import library Flask
from flask import Flask, request, jsonify, send_from_directory
import os # Untuk mengelola file dan folder

# Inisialisasi aplikasi Flask
app = Flask(__name__, static_folder='../frontend', static_url_path='') # Arahkan ke folder frontend

# Konfigurasi folder untuk menyimpan file upload sementara
UPLOAD_FOLDER = 'uploads'
# Pastikan folder uploads ada, jika tidak buat folder tersebut
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Rute dasar untuk menyajikan file index.html dari frontend
@app.route('/')
def serve_index():
    # Pastikan index.html ada di dalam folder 'frontend'
    # Jika nama foldernya beda, sesuaikan 'frontend' di bawah ini
    # Jika nama file html nya beda, sesuaikan 'index.html'
    return send_from_directory('../frontend', 'index.html')

# Rute (endpoint) untuk API pembuatan soal
# Kita akan definisikan ini nanti
# @app.route('/generate-soal', methods=['POST'])
# def generate_questions_api():
#     # Logika akan ditambahkan di sini
#     return jsonify({"message": "Endpoint /generate-soal belum diimplementasikan"})

# Menjalankan server Flask jika file ini dieksekusi langsung
if __name__ == '__main__':
    # debug=True agar server otomatis restart saat ada perubahan kode
    # host='0.0.0.0' agar bisa diakses dari jaringan lokal (opsional)
    app.run(debug=True, port=5000) # Server akan berjalan di http://127.0.0.1:5000/